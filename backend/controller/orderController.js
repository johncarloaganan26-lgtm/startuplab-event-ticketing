// orderController.js
// Implements order/registration flow per knowledge base

// Supabase client
import supabase from '../database/db.js';
import { randomUUID } from 'crypto';
import { sendMakeNotification } from '../utils/makeWebhook.js';
import { logAudit } from '../utils/auditLogger.js';
import {
  getUserProfileByAuthId,
  notifyUserByPreference,
} from '../utils/notificationService.js';

const getReservationTtlMs = () => {
  const raw = process.env.RESERVATION_TTL_MINUTES;
  if (!raw) return 15 * 60 * 1000;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 15 * 60 * 1000;
  return parsed * 60 * 1000;
};
/**
 * POST /api/orders
 * Body: { eventId, buyerName, buyerEmail, items: [{ ticketTypeId, quantity, price }], totalAmount, currency }
 */
export const createOrder = async (req, res) => {
  const { eventId, buyerName, buyerEmail, buyerPhone, company, items, totalAmount, currency } = req.body;
  if (!eventId || !buyerName || !buyerEmail || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // track reserved stock to roll back on failure (optimistic CAS)
  const reservations = [];
  const rollbackReservations = async () => {
    for (const r of reservations.reverse()) {
      await supabase
        .from('ticketTypes')
        .update({ quantitySold: r.from })
        .eq('ticketTypeId', r.ticketTypeId)
        .eq('quantitySold', r.to);
    }
  };

  let orderId = null;
  const cleanupOrder = async () => {
    if (orderId) {
      await supabase.from('tickets').delete().eq('orderId', orderId);
      await supabase.from('attendees').delete().eq('orderId', orderId);
      await supabase.from('orderItems').delete().eq('orderId', orderId);
      await supabase.from('orders').delete().eq('orderId', orderId);
    }
    await rollbackReservations();
  };

  try {
    // [REMOVED] Duplicate registration check removed as per user request to allow multiple registrations per email.
    /*
    const { data: existingAttendee, error: exAttErr } = await supabase
      .from('attendees')
      .select('attendeeId')
      .eq('eventId', eventId)
      .eq('email', buyerEmail)
      .limit(1)
      .maybeSingle();

    if (existingAttendee) {
      return res.status(400).json({ error: 'You are already registered for this event with this email address.' });
    }

    // Also check for active (not failed/cancelled/expired) orders
    const { data: existingOrder, error: exOrdErr } = await supabase
      .from('orders')
      .select('orderId')
      .eq('eventId', eventId)
      .eq('buyerEmail', buyerEmail)
      .in('status', ['PAID', 'PENDING_PAYMENT', 'DRAFT'])
      .limit(1)
      .maybeSingle();

    if (existingOrder) {
      return res.status(400).json({ error: 'You have an existing order for this event. Please check your tickets or complete the existing payment.' });
    }
    */

    // 1) Validate inventory and reserve with CAS update
    const ids = items.map(i => i.ticketTypeId);
    const { data: ticketTypes, error: ttErr } = await supabase
      .from('ticketTypes')
      .select('ticketTypeId, quantityTotal, quantitySold')
      .in('ticketTypeId', ids);
    if (ttErr) return res.status(500).json({ error: ttErr.message });
    const map = new Map((ticketTypes || []).map(tt => [tt.ticketTypeId, tt]));

    for (const item of items) {
      const tt = map.get(item.ticketTypeId);
      if (!tt) return res.status(400).json({ error: 'Ticket type not found' });
      const currentSold = tt.quantitySold || 0;
      const newSold = currentSold + item.quantity;
      if (newSold > (tt.quantityTotal || 0)) {
        return res.status(400).json({ error: 'Insufficient ticket inventory' });
      }

      // CAS: only succeed if quantitySold has not changed since read
      const { data: reservedRow, error: reserveErr } = await supabase
        .from('ticketTypes')
        .update({ quantitySold: newSold })
        .eq('ticketTypeId', item.ticketTypeId)
        .eq('quantitySold', currentSold)
        .select('ticketTypeId, quantitySold')
        .maybeSingle();
      if (reserveErr) {
        await rollbackReservations();
        return res.status(409).json({ error: 'Inventory reservation failed', detail: reserveErr.message });
      }
      if (!reservedRow) {
        await rollbackReservations();
        return res.status(409).json({ error: 'Inventory changed, please retry' });
      }
      reservations.push({ ticketTypeId: item.ticketTypeId, from: currentSold, to: newSold });
    }

    // 2) Create order
    const isFree = totalAmount === 0;
    const expiresAt = isFree ? null : new Date(Date.now() + getReservationTtlMs()).toISOString();
    const { data: orderData, error: orderErr } = await supabase
      .from('orders')
      .insert({
        eventId,
        buyerName,
        buyerEmail,
        buyerPhone: buyerPhone || null,
        totalAmount,
        currency,
        metadata: company ? { company } : null,
        status: isFree ? 'PAID' : 'PENDING_PAYMENT',
        expiresAt
      })
      .select('*')
      .single();
    if (orderErr) {
      await cleanupOrder();
      return res.status(500).json({ error: orderErr.message });
    }
    orderId = orderData.orderId;

    console.log('[Orders] Created', {
      orderId,
      eventId,
      totalAmount,
      currency,
      status: orderData.status,
      expiresAt
    });

    await logAudit({
      actionType: 'ORDER_CREATED',
      orderId,
      details: {
        eventId,
        totalAmount,
        currency,
        status: orderData.status,
        expiresAt,
        isFree
      },
      req
    });

    // 3) Create order items
    for (const item of items) {
      const { ticketTypeId, quantity, price } = item;
      const { error: oiErr } = await supabase
        .from('orderItems')
        .insert({
          orderId,
          ticketTypeId,
          quantity,
          price,
          lineTotal: price * quantity
        });
      if (oiErr) {
        await cleanupOrder();
        return res.status(500).json({ error: oiErr.message });
      }
    }

    // 4) Issue attendees/tickets only for free orders (paid orders will be issued after payment success webhook)
    const issuedTickets = [];
    if (isFree) {
      for (const item of items) {
        const { ticketTypeId, quantity } = item;
        for (let i = 0; i < quantity; i++) {
          const { data: attendee, error: attErr } = await supabase
            .from('attendees')
            .insert({
              eventId,
              orderId,
              name: buyerName,
              email: buyerEmail,
              phoneNumber: buyerPhone || null,
              company: company || null,
              consent: true
            })
            .select('*')
            .single();
          if (attErr) {
            await cleanupOrder();
            return res.status(500).json({ error: attErr.message });
          }

          const ticketCode = randomUUID();
          const { data: ticketData, error: ticketErr } = await supabase
            .from('tickets')
            .insert({
              eventId,
              ticketTypeId,
              orderId,
              attendeeId: attendee.attendeeId,
              ticketCode,
              qrPayload: ticketCode,
              status: 'ISSUED'
            })
            .select('ticketId')
            .maybeSingle();
          if (ticketErr) {
            await cleanupOrder();
            return res.status(500).json({ error: ticketErr.message });
          }
          await logAudit({
            actionType: 'TICKET_ISSUED',
            orderId,
            ticketId: ticketData?.ticketId || null,
            details: {
              ticketTypeId,
              source: 'FREE_ORDER'
            },
            req
          });
          issuedTickets.push({ ticketCode, qrPayload: ticketCode, status: 'ISSUED' });
        }
      }
    }

    if (isFree && issuedTickets.length) {
      console.log('[Tickets] Issued for free order', { orderId, count: issuedTickets.length });
    }

    // Notify Make.com for free orders (one webhook per ticket)
    if (isFree && issuedTickets.length) {
      // fetch event details
      const { data: event, error: eventErr } = await supabase
        .from('events')
        .select('eventName, description, startAt, endAt, locationText, locationType, imageUrl, streamingPlatform, organizerId')
        .eq('eventId', eventId)
        .maybeSingle();
      for (const t of issuedTickets) {
        const notificationPayload = {
          type: 'ticket',
          email: buyerEmail,
          name: buyerName,
          meta: {
            eventId,
            orderId,
            eventName: event?.eventName || '',
            eventDescription: event?.description || '',
            eventStartAt: event?.startAt ? new Date(event.startAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : '',
            eventEndAt: event?.endAt ? new Date(event.endAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : '',
            eventLocation: event?.locationText || '',
            eventImageUrl: event?.imageUrl || '',
            locationType: event?.locationType || '',
            streamingPlatform: event?.streamingPlatform || '',
            ticket: t
          }
        };
        // LEGACY: The Maker webhook formerly sent tickets via "robiemail". Disabled.
        console.log('[MakeWebhook] Skipping Send - only using Organizer SMTP:', notificationPayload.type);
        // sendMakeNotification(notificationPayload).catch(() => { });

        // NEW: Notify Attendee directly via SMTP with ACTUAL TICKET format
        try {
          await notifyUserByPreference({
            name: buyerName, // Needed for ticket templating
            recipientFallbackEmail: buyerEmail,
            eventId,
            organizerId: event?.organizerId,
            type: 'TICKET_DELIVERY',
            title: `Your Ticket Confirmed: ${event?.eventName || 'the event'}!`,
            message: `Thank you for registering! Your tickets for "${event?.eventName}" are attached below.`,
            metadata: {
              ...notificationPayload.meta // Injects all the make.com properties to match the ticket template variables
            }
          });
        } catch (err) {
          console.error('[Orders] Attendee notification failed:', err.message);
        }
      }

      // Notify Organizer about New Free Order
      try {
        const { data: eventRow } = await supabase
          .from('events')
          .select('eventName, slug, organizerId, createdBy')
          .eq('eventId', eventId)
          .maybeSingle();

        if (eventRow) {
          let recipientUserId = eventRow.createdBy;
          let organizerName = 'your organization';

          if (eventRow.organizerId) {
            const { data: org } = await supabase
              .from('organizers')
              .select('ownerUserId, organizerName')
              .eq('organizerId', eventRow.organizerId)
              .maybeSingle();
            if (org?.ownerUserId) {
              recipientUserId = org.ownerUserId;
              organizerName = org.organizerName || organizerName;
            }
          }

          if (recipientUserId) {
            const recipientProfile = await getUserProfileByAuthId(recipientUserId);
            const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
            const message = `${buyerName} just registered for ${totalQty} free ticket(s) for your event "${eventRow.eventName}".`;

            await notifyUserByPreference({
              recipientUserId,
              recipientFallbackEmail: recipientProfile?.email || '',
              eventId,
              organizerId: eventRow.organizerId,
              type: 'ORDER_PLACED',
              title: 'New Free Registration!',
              message,
              metadata: {
                eventName: eventRow.eventName,
                tag: 'NEW REGISTRATION',
                typeIcon: '🎫',
                actionLabel: 'VIEW ORDER',
                actionUrl: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL.replace(/\/$/, '')}/orders/${orderId}` : null,
              }
            });
          }
        }
      } catch (err) {
        console.error('[Orders] Organizer notification failed:', err.message);
      }
    }

    return res.status(201).json({ orderId });
  } catch (err) {
    await cleanupOrder();
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

// Cancel or refund an order: update statuses and release inventory
export const cancelOrder = async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body; // expected: 'CANCELLED' or 'REFUNDED'
  if (!orderId) return res.status(400).json({ error: 'orderId required' });
  if (!['CANCELLED', 'REFUNDED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Use CANCELLED or REFUNDED.' });
  }

  try {
    // fetch order items to know quantities per ticket type
    const { data: orderItems, error: itemsErr } = await supabase
      .from('orderItems')
      .select('ticketTypeId, quantity')
      .eq('orderId', orderId);
    if (itemsErr) return res.status(500).json({ error: itemsErr.message });
    if (!orderItems || !orderItems.length) {
      return res.status(404).json({ error: 'Order not found or has no items' });
    }

    // update order status
    const { error: orderErr } = await supabase
      .from('orders')
      .update({ status })
      .eq('orderId', orderId);
    if (orderErr) return res.status(500).json({ error: orderErr.message });

    // update tickets status
    const { error: ticketErr } = await supabase
      .from('tickets')
      .update({ status })
      .eq('orderId', orderId);
    if (ticketErr) return res.status(500).json({ error: ticketErr.message });

    // decrement sold counts
    const qtyByType = {};
    for (const item of orderItems) {
      qtyByType[item.ticketTypeId] = (qtyByType[item.ticketTypeId] || 0) + item.quantity;
    }
    const typeIds = Object.keys(qtyByType);
    const { data: tts, error: ttErr } = await supabase
      .from('ticketTypes')
      .select('ticketTypeId, quantitySold')
      .in('ticketTypeId', typeIds);
    if (ttErr) return res.status(500).json({ error: ttErr.message });

    for (const tt of tts || []) {
      const dec = qtyByType[tt.ticketTypeId] || 0;
      const newSold = Math.max(0, (tt.quantitySold || 0) - dec);
      const { error: updErr } = await supabase
        .from('ticketTypes')
        .update({ quantitySold: newSold })
        .eq('ticketTypeId', tt.ticketTypeId);
      if (updErr) return res.status(500).json({ error: updErr.message });
    }

    return res.status(200).json({ orderId, status });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

// GET /api/orders/my - fetch orders for authenticated user
export const getMyOrders = async (req, res) => {
  try {
    const userId = req.user?.id;
    const email = req.user?.email || req.user?.new_email; // Fallback to email in auth user object

    if (!userId || !email) {
      return res.status(401).json({ error: 'Unauthorized: missing user identifier or email' });
    }

    console.log(`[Orders] Fetching orders for email: ${email}`);

    // Fetch orders by buyer email and join with events to get event name and date
    // Fetch orders with events (slug, name, date) and ticket statuses
    const { data: rawOrders, error: ordersErr } = await supabase
      .from('orders')
      .select('*, events(eventName, startAt, slug), tickets(status)')
      .ilike('buyerEmail', email)
      .order('created_at', { ascending: false });

    if (ordersErr) {
      console.error('[Orders] Fetch error:', ordersErr);
      return res.status(500).json({ error: ordersErr.message });
    }

    // Flatten and enrich order data
    const orders = (rawOrders || []).map(order => {
      const tickets = order.tickets || [];
      const totalTickets = tickets.length;
      const usedTickets = tickets.filter(t => t.status === 'USED').length;

      return {
        ...order,
        eventName: order.events?.eventName || 'Untitled Event',
        eventStartAt: order.events?.startAt,
        eventSlug: order.events?.slug,
        ticketStats: {
          total: totalTickets,
          used: usedTickets,
          allUsed: totalTickets > 0 && usedTickets === totalTickets,
          someUsed: usedTickets > 0 && usedTickets < totalTickets
        }
      };
    });

    return res.json({ orders: orders || [], count: (orders || []).length });
  } catch (err) {
    console.error('[Orders] Unexpected error in getMyOrders:', err);
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

// GET /api/orders/:orderId - fetch order status/details
export const getOrderById = async (req, res) => {
  const { orderId } = req.params;
  if (!orderId) return res.status(400).json({ error: 'orderId required' });
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('orderId', orderId)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Order not found' });
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};
