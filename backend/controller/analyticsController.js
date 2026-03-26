import supabase from '../database/db.js';

const MAX_PAGE_SIZE = 10;
const ADMIN_STAFF_ROLES = ['ADMIN', 'STAFF'];
const ANALYTICS_BUILD = 'analytics-fix-2026-03-04-01';

const logAnalyticsError = (scope, err, extra = {}) => {
  console.error(`[Analytics][${scope}]`, {
    build: ANALYTICS_BUILD,
    message: err?.message || String(err),
    code: err?.code,
    details: err?.details,
    hint: err?.hint,
    ...extra
  });
};

const normalizeRole = (role) => {
  const normalized = String(role || '').toUpperCase();
  if (normalized === 'USER') return 'ORGANIZER';
  return normalized;
};

const resolvePagination = (req) => {
  const rawPage = Number(req.query?.page);
  const rawLimit = Number(req.query?.limit);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const limitInput = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : MAX_PAGE_SIZE;
  const limit = Math.min(limitInput, MAX_PAGE_SIZE);
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  return { page, limit, from, to };
};

const buildPagination = (page, limit, total) => {
  const totalPages = total === 0 ? 1 : Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasMore: page < totalPages
  };
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value) => UUID_RE.test(String(value || ''));
const sanitizeUuidList = (values) => Array.from(new Set((values || []).filter(isUuid)));

const getFilteredEventIds = async (req) => {
  try {
    const requesterId = req.user?.id || null;
    const requesterEmail = String(req.user?.email || '').toLowerCase().trim();
    let userProfile = null;

    // Primary lookup: canonical users.userId mapping from auth user id.
    if (isUuid(requesterId)) {
      const byUserId = await supabase
        .from('users')
        .select('userId, role, email, employerId')
        .eq('userId', requesterId)
        .maybeSingle();
      if (byUserId.error) {
        // Do not hard-fail analytics for profile lookup errors; fallback to email below.
        console.warn('[Analytics] users lookup by userId failed:', byUserId.error.message);
      } else {
        userProfile = byUserId.data || null;
      }
    }

    // Fallback: map by email when auth id and users.userId drift.
    if (!userProfile && requesterEmail) {
      const byEmail = await supabase
        .from('users')
        .select('userId, role, email, employerId')
        .eq('email', requesterEmail)
        .maybeSingle();
      if (byEmail.error) {
        console.warn('[Analytics] users lookup by email failed:', byEmail.error.message);
      } else {
        userProfile = byEmail.data || null;
      }
    }

    const userRole = normalizeRole(userProfile?.role);
    const effectiveUserId = userProfile?.userId || (isUuid(requesterId) ? requesterId : null);

    if (userRole === 'ADMIN') {
      // Admins should ONLY see events created by Admins, isolating them from Organizer data
      const { data: adminUsers } = await supabase.from('users').select('userId').eq('role', 'ADMIN');
      const adminIds = sanitizeUuidList((adminUsers || []).map(u => u.userId));
      const { data: adminEvents } = await supabase.from('events').select('eventId').in('createdBy', adminIds);
      return sanitizeUuidList((adminEvents || []).map(e => e.eventId));
    }

    if (!effectiveUserId) return [];

    let allowedCreatorIds = [effectiveUserId];

    if (userRole === 'STAFF') {
      // Staff sees their own events + their employer's events + their invited organizers' events
      if (userProfile?.employerId) {
        allowedCreatorIds.push(userProfile.employerId);
      }
      const { data: invitedUsers } = await supabase
        .from('users')
        .select('userId')
        .eq('employerId', effectiveUserId);
      if (invitedUsers && invitedUsers.length > 0) {
        allowedCreatorIds = allowedCreatorIds.concat(
          invitedUsers.map(u => u.userId).filter(Boolean)
        );
      }
    }

    // Regular users (Organizers) and Staff only see events they created or are allowed to see
    const { data: myEvents, error: myEventsErr } = await supabase
      .from('events')
      .select('eventId')
      .in('createdBy', allowedCreatorIds);

    if (myEventsErr) {
      logAnalyticsError('getFilteredEventIds.myEvents', myEventsErr, { requesterId, effectiveUserId });
      // Fail-open to global scope ONLY for ADMIN, for Staff/Organizer fail closed to empty array
      return [];
    }

    return sanitizeUuidList((myEvents || []).map(e => e.eventId));
  } catch (err) {
    logAnalyticsError('getFilteredEventIds', err, { requesterId: req.user?.id, requesterEmail: req.user?.email });
    // Fail-secure to empty array instead of exposing global scope
    return [];
  }
};

const loadOrderDetails = async (orderId) => {
  if (!orderId) return null;
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('orderId, eventId, status, totalAmount, currency, buyerName, buyerEmail, buyerPhone, metadata, expiresAt, created_at')
    .eq('orderId', orderId)
    .maybeSingle();
  if (orderErr) throw orderErr;
  if (!order) return null;

  const [eventResp, orderItemsResp, attendeesResp, ticketsResp, paymentsResp] = await Promise.all([
    order.eventId
      ? supabase
        .from('events')
        .select('eventId, eventName, startAt, endAt, timezone, locationText')
        .eq('eventId', order.eventId)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from('orderItems')
      .select('orderItemId, ticketTypeId, quantity, price, lineTotal')
      .eq('orderId', orderId),
    supabase
      .from('attendees')
      .select('attendeeId, name, email, phoneNumber, company')
      .eq('orderId', orderId),
    supabase
      .from('tickets')
      .select('ticketId, ticketCode, qrPayload, status, issuedAt, usedAt, attendeeId, ticketTypeId')
      .eq('orderId', orderId),
    supabase
      .from('paymentTransactions')
      .select('paymentTransactionId, hitpayReferenceId, amount, currency, status, gateway, created_at, updated_at, rawPayload')
      .eq('orderId', orderId)
      .order('created_at', { ascending: false })
  ]);

  if (eventResp.error) throw eventResp.error;
  if (orderItemsResp.error) throw orderItemsResp.error;
  if (attendeesResp.error) throw attendeesResp.error;
  if (ticketsResp.error) throw ticketsResp.error;
  if (paymentsResp.error) throw paymentsResp.error;

  const orderItems = orderItemsResp.data || [];
  const tickets = ticketsResp.data || [];
  const attendees = attendeesResp.data || [];
  const ticketTypeIds = Array.from(new Set([
    ...orderItems.map(item => item.ticketTypeId),
    ...tickets.map(ticket => ticket.ticketTypeId)
  ].filter(Boolean)));

  const { data: ticketTypes, error: ttErr } = ticketTypeIds.length
    ? await supabase
      .from('ticketTypes')
      .select('ticketTypeId, name, priceAmount, currency')
      .in('ticketTypeId', ticketTypeIds)
    : { data: [], error: null };
  if (ttErr) throw ttErr;

  const ticketTypeMap = new Map((ticketTypes || []).map(tt => [tt.ticketTypeId, tt]));
  const attendeeMap = new Map(attendees.map(att => [att.attendeeId, att]));

  const orderItemsDetailed = orderItems.map(item => ({
    ...item,
    ticketType: ticketTypeMap.get(item.ticketTypeId) || null
  }));

  const ticketsDetailed = tickets.map(ticket => ({
    ...ticket,
    attendee: attendeeMap.get(ticket.attendeeId) || null,
    ticketType: ticketTypeMap.get(ticket.ticketTypeId) || null
  }));

  return {
    order,
    event: eventResp.data || null,
    orderItems: orderItemsDetailed,
    attendees,
    tickets: ticketsDetailed,
    payments: paymentsResp.data || []
  };
};

const loadTicketDetails = async (ticketId) => {
  if (!ticketId) return null;
  const { data: ticket, error: ticketErr } = await supabase
    .from('tickets')
    .select('ticketId, ticketCode, qrPayload, status, issuedAt, usedAt, attendeeId, eventId, orderId, ticketTypeId')
    .eq('ticketId', ticketId)
    .maybeSingle();
  if (ticketErr) throw ticketErr;
  if (!ticket) return null;

  const [attendeeResp, eventResp, orderResp, ticketTypeResp] = await Promise.all([
    ticket.attendeeId
      ? supabase
        .from('attendees')
        .select('attendeeId, name, email, phoneNumber, company')
        .eq('attendeeId', ticket.attendeeId)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    ticket.eventId
      ? supabase
        .from('events')
        .select('eventId, eventName, startAt, endAt, timezone, locationText')
        .eq('eventId', ticket.eventId)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    ticket.orderId
      ? supabase
        .from('orders')
        .select('orderId, status, totalAmount, currency, buyerName, buyerEmail, buyerPhone, created_at')
        .eq('orderId', ticket.orderId)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    ticket.ticketTypeId
      ? supabase
        .from('ticketTypes')
        .select('ticketTypeId, name, priceAmount, currency')
        .eq('ticketTypeId', ticket.ticketTypeId)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);

  if (attendeeResp.error) throw attendeeResp.error;
  if (eventResp.error) throw eventResp.error;
  if (orderResp.error) throw orderResp.error;
  if (ticketTypeResp.error) throw ticketTypeResp.error;

  return {
    ticket,
    attendee: attendeeResp.data || null,
    event: eventResp.data || null,
    order: orderResp.data || null,
    ticketType: ticketTypeResp.data || null
  };
};

export const getSummary = async (req, res) => {
  try {
    res.set('x-analytics-build', ANALYTICS_BUILD);
    console.log(`[Analytics] getSummary build=${ANALYTICS_BUILD} user=${req.user?.id || 'unknown'}`);
    const filteredEventIds = await getFilteredEventIds(req);

    // If no events allowed, return zero stats immediately to avoid global leak
    if (!Array.isArray(filteredEventIds) || filteredEventIds.length === 0) {
      console.log(`[Analytics] No authorized events for user ${req.user?.id || 'unknown'}, returning empty summary`);
      return res.json({
        totalRegistrations: 0,
        ticketsSoldToday: 0,
        totalRevenue: 0,
        revenueToday: 0,
        attendanceRate: 0,
        paymentSuccessRate: 0,
      });
    }

    // Tickets and attendance
    const { data: tickets, error: ticketErr } = await supabase
      .from('tickets')
      .select('ticketId, status, issuedAt, eventId')
      .in('eventId', filteredEventIds);

    if (ticketErr) {
      logAnalyticsError('getSummary.tickets', ticketErr, { requesterId: req.user?.id });
      return res.status(500).json({ error: ticketErr.message, build: ANALYTICS_BUILD });
    }

    const totalRegistrations = tickets?.length || 0;
    const usedCount = (tickets || []).filter(t => t.status === 'USED').length;
    const attendanceRate = totalRegistrations ? (usedCount / totalRegistrations) * 100 : 0;

    // Orders and revenue
    const { data: orders, error: orderErr } = await supabase
      .from('orders')
      .select('orderId, totalAmount, status, created_at, eventId')
      .in('eventId', filteredEventIds);

    if (orderErr) {
      logAnalyticsError('getSummary.orders', orderErr, { requesterId: req.user?.id });
      return res.status(500).json({ error: orderErr.message, build: ANALYTICS_BUILD });
    }

    const paidOrders = (orders || []).filter(o => o.status === 'PAID');
    const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const paymentSuccessRate = (orders || []).length
      ? (paidOrders.length / orders.length) * 100
      : 0;

    // Today ranges
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startIso = today.toISOString();
    const ticketsSoldToday = (tickets || []).filter(t => t.issuedAt && t.issuedAt >= startIso).length;
    const revenueToday = paidOrders
      .filter(o => o.created_at && o.created_at >= startIso)
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    // To accurately count "paid" events, we need to know which events have paid tickets.
    const { data: ticketTypes, error: ttErr } = await supabase
      .from('ticketTypes')
      .select('eventId, priceAmount')
      .in('eventId', filteredEventIds);

    let totalPaidEvents = 0;
    if (!ttErr && ticketTypes) {
      const paidEventIds = new Set(
        ticketTypes
          .filter(tt => (tt.priceAmount || 0) > 0)
          .map(tt => tt.eventId)
      );
      totalPaidEvents = paidEventIds.size;
    }

    // Organizer Subscription Analytics (Global for Admin)
    let totalPlanRevenue = 0;
    let activeSubscriptions = 0;
    
    try {
      const { data: subsData, error: subsErr } = await supabase
        .from('organizersubscriptions')
        .select('priceAmount, status')
        .in('status', ['active', 'paid', 'ACTIVE', 'PAID']);
        
      if (!subsErr && subsData) {
        totalPlanRevenue = subsData.reduce((sum, s) => sum + (Number(s.priceAmount) || 0), 0);
        activeSubscriptions = subsData.length;
      }
    } catch (subsExc) {
      console.warn('[Analytics] Failed to fetch subscription summary:', subsExc);
    }

    return res.json({
      totalRegistrations,
      ticketsSoldToday,
      totalRevenue,
      revenueToday,
      attendanceRate,
      paymentSuccessRate,
      totalPaidEvents,
      totalPlanRevenue,
      activeSubscriptions
    });
  } catch (err) {
    logAnalyticsError('getSummary.catch', err, { requesterId: req.user?.id });
    return res.status(500).json({ error: err?.message || 'Unexpected error', build: ANALYTICS_BUILD });
  }
};

export const getRecentTransactions = async (req, res) => {
  try {
    res.set('x-analytics-build', ANALYTICS_BUILD);
    console.log(`[Analytics] getRecentTransactions build=${ANALYTICS_BUILD} user=${req.user?.id || 'unknown'} page=${req.query?.page || 1}`);
    const { page, limit, from, to } = resolvePagination(req);
    const filteredEventIds = await getFilteredEventIds(req);
    const requesterId = req.user?.id || null;

    // Resolve role (default organizer)
    let userRole = 'ORGANIZER';
    if (requesterId) {
      const { data: userRow } = await supabase
        .from('users')
        .select('role')
        .eq('userId', requesterId)
        .maybeSingle();
      userRole = normalizeRole(userRow?.role);
    }

    // For non-admin users, no events means no transactions.
    if (userRole !== 'ADMIN' && (!Array.isArray(filteredEventIds) || filteredEventIds.length === 0)) {
      return res.json({
        transactions: [],
        total: 0,
        pagination: buildPagination(page, limit, 0)
      });
    }

    const { data, error, count } = Array.isArray(filteredEventIds) && filteredEventIds.length
      ? await supabase
      .from('orders')
      .select('orderId, eventId, buyerName, buyerEmail, totalAmount, currency, status, created_at, deleted_at', { count: 'exact' })
      .in('eventId', filteredEventIds)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(from, to)
      : { data: [], error: null, count: 0 };

    if (error) {
      logAnalyticsError('getRecentTransactions.query', error, { requesterId: req.user?.id, page, limit });
      return res.status(500).json({ error: error.message, build: ANALYTICS_BUILD });
    }
    const ordersTotal = typeof count === 'number' ? count : 0;
    const items = data || [];
    const eventIds = sanitizeUuidList(items.map(item => item.eventId));
    let eventMap = new Map();

    if (eventIds.length) {
      const { data: eventRows, error: eventErr } = await supabase
        .from('events')
        .select('eventId, eventName')
        .in('eventId', eventIds);
      if (eventErr) {
        logAnalyticsError('getRecentTransactions.events', eventErr, { requesterId: req.user?.id, eventIdsCount: eventIds.length });
        return res.status(500).json({ error: eventErr.message, build: ANALYTICS_BUILD });
      }
      eventMap = new Map((eventRows || []).map(row => [row.eventId, row.eventName]));
    }

    const enrichedOrderItems = items.map(item => ({
      orderId: item.orderId,
      eventId: item.eventId,
      customerName: item.buyerName,
      customerEmail: item.buyerEmail || null,
      amount: item.totalAmount,
      currency: item.currency,
      paymentStatus: item.status,
      createdAt: item.created_at,
      eventName: eventMap.get(item.eventId) || null,
      kind: 'order'
    }));

    // Include organizer subscription purchases for Admin view
    let subscriptionItems = [];
    let subscriptionTotal = 0;
    if (userRole === 'ADMIN') {
      const { data: subs, error: subsErr, count: subsCount } = await supabase
        .from('organizersubscriptions')
        .select('subscriptionId, organizerId, planId, priceAmount, currency, status, billingInterval, created_at, plan:plans(name), organizers:organizers(organizerName, ownerUserId)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (subsErr) {
        logAnalyticsError('getRecentTransactions.subscriptions', subsErr, { requesterId });
      } else {
        subscriptionTotal = typeof subsCount === 'number' ? subsCount : 0;
        const ownerIds = sanitizeUuidList((subs || []).map(s => s.organizers?.ownerUserId).filter(Boolean));
        let ownerEmailMap = new Map();
        if (ownerIds.length) {
          const { data: owners, error: ownersErr } = await supabase
            .from('users')
            .select('userId, email')
            .in('userId', ownerIds);
          if (ownersErr) {
            logAnalyticsError('getRecentTransactions.subscriptions.ownerEmails', ownersErr, { requesterId, ownerCount: ownerIds.length });
          } else {
            ownerEmailMap = new Map((owners || []).map(o => [o.userId, o.email]));
          }
        }

        subscriptionItems = (subs || []).map(sub => ({
          orderId: sub.subscriptionId,
          eventId: null,
          customerName: sub.organizers?.organizerName || 'Organizer Plan',
          customerEmail: ownerEmailMap.get(sub.organizers?.ownerUserId) || null,
          amount: Number(sub.priceAmount || 0),
          currency: sub.currency || 'PHP',
          paymentStatus: (sub.status || '').toUpperCase() === 'ACTIVE' ? 'PAID' : (sub.status || '').toUpperCase(),
          createdAt: sub.created_at,
          eventName: `Plan: ${sub.plan?.name || 'Subscription'} (${sub.billingInterval || 'interval'})`,
          kind: 'subscription'
        }));
      }
    }

    // Merge and sort by createdAt desc, then slice to requested page size
    const combined = [...enrichedOrderItems, ...subscriptionItems].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const paged = combined.slice(0, limit);
    const total = ordersTotal + (subscriptionTotal || 0);

    return res.json({
      transactions: paged,
      total: total,
      pagination: buildPagination(page, limit, total)
    });
  } catch (err) {
    logAnalyticsError('getRecentTransactions.catch', err, { requesterId: req.user?.id, page: req.query?.page, limit: req.query?.limit });
    return res.status(500).json({ error: err?.message || 'Unexpected error', build: ANALYTICS_BUILD });
  }
};


export const getTransactionDetail = async (req, res) => {
  const { orderId } = req.params;
  if (!orderId) return res.status(400).json({ error: 'orderId required' });
  try {
    const details = await loadOrderDetails(orderId);
    if (!details) return res.status(404).json({ error: 'Order not found' });
    return res.json(details);
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

export const getOrderDetail = async (req, res) => {
  const { orderId } = req.params;
  if (!orderId) return res.status(400).json({ error: 'orderId required' });
  try {
    const details = await loadOrderDetails(orderId);
    if (!details) return res.status(404).json({ error: 'Order not found' });
    return res.json(details);
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

export const getAuditLogDetail = async (req, res) => {
  const { auditLogId } = req.params;
  if (!auditLogId) return res.status(400).json({ error: 'auditLogId required' });
  try {
    const { data: log, error: logErr } = await supabase
      .from('auditLogs')
      .select('auditLogId, actionType, orderId, ticketId, paymentTransactionId, webhookEventsId, actorUserId, details, createdAt')
      .eq('auditLogId', auditLogId)
      .maybeSingle();
    if (logErr) return res.status(500).json({ error: logErr.message });
    if (!log) return res.status(404).json({ error: 'Audit log not found' });

    let actor = null;
    if (log.actorUserId) {
      let actorResp = await supabase
        .from('users')
        .select('userId, name, email, role')
        .eq('userId', log.actorUserId)
        .maybeSingle();
      actor = actorResp.data;

      if ((!actor && !actorResp.error) || (actorResp.error && actorResp.error.message?.includes('column "userId"'))) {
        const fallbackResp = await supabase
          .from('users')
          .select('id, name, email, role')
          .eq('userId', log.actorUserId)
          .maybeSingle();
        actor = fallbackResp.data;
      }

      if (actor) {
        actor = {
          userId: actor.userId || actor.id,
          name: actor.name,
          email: actor.email,
          role: actor.role
        };
      }
    }

    const [orderDetails, ticketDetails, webhookResp, paymentResp] = await Promise.all([
      log.orderId ? loadOrderDetails(log.orderId) : Promise.resolve(null),
      log.ticketId ? loadTicketDetails(log.ticketId) : Promise.resolve(null),
      log.webhookEventsId
        ? supabase
          .from('webhookEvents')
          .select('webhookEventsId, eventType, externalId, payload, receivedAt, processedAt, processingStatus')
          .eq('webhookEventsId', log.webhookEventsId)
          .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      log.paymentTransactionId
        ? supabase
          .from('paymentTransactions')
          .select('paymentTransactionId, orderId, hitpayReferenceId, amount, currency, status, gateway, created_at, updated_at, rawPayload')
          .eq('paymentTransactionId', log.paymentTransactionId)
          .maybeSingle()
        : Promise.resolve({ data: null, error: null })
    ]);

    if (webhookResp?.error) return res.status(500).json({ error: webhookResp.error.message });
    if (paymentResp?.error) return res.status(500).json({ error: paymentResp.error.message });

    return res.json({
      log,
      actor,
      orderDetails: orderDetails || null,
      ticketDetails: ticketDetails || null,
      webhookEvent: webhookResp?.data || null,
      paymentTransaction: paymentResp?.data || null
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

export const getRecentOrders = async (req, res) => {
  try {
    res.set('x-analytics-build', ANALYTICS_BUILD);
    console.log(`[Analytics] getRecentOrders build=${ANALYTICS_BUILD} user=${req.user?.id || 'unknown'} page=${req.query?.page || 1}`);
    const { page, limit, from, to } = resolvePagination(req);
    const filteredEventIds = await getFilteredEventIds(req);

    if (!Array.isArray(filteredEventIds) || filteredEventIds.length === 0) {
      return res.json({
        items: [],
        pagination: buildPagination(page, limit, 0)
      });
    }

    const { data, error, count } = await supabase
      .from('orders')
      .select('orderId, eventId, buyerName, buyerEmail, totalAmount, currency, status, created_at', { count: 'exact' })
      .in('eventId', filteredEventIds)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      logAnalyticsError('getRecentOrders.query', error, { requesterId: req.user?.id, page, limit });
      return res.status(500).json({ error: error.message, build: ANALYTICS_BUILD });
    }
    const total = typeof count === 'number' ? count : 0;
    const items = data || [];
    const eventIds = sanitizeUuidList(items.map(item => item.eventId));
    let eventMap = new Map();

    if (eventIds.length) {
      const { data: eventRows, error: eventErr } = await supabase
        .from('events')
        .select('eventId, eventName')
        .in('eventId', eventIds);
      if (eventErr) {
        logAnalyticsError('getRecentOrders.events', eventErr, { requesterId: req.user?.id, eventIdsCount: eventIds.length });
        return res.status(500).json({ error: eventErr.message, build: ANALYTICS_BUILD });
      }
      eventMap = new Map((eventRows || []).map(row => [row.eventId, row.eventName]));
    }

    const enrichedItems = items.map(item => ({
      ...item,
      eventName: eventMap.get(item.eventId) || null
    }));
    return res.json({
      items: enrichedItems,
      pagination: buildPagination(page, limit, total)
    });
  } catch (err) {
    logAnalyticsError('getRecentOrders.catch', err, { requesterId: req.user?.id, page: req.query?.page, limit: req.query?.limit });
    return res.status(500).json({ error: err?.message || 'Unexpected error', build: ANALYTICS_BUILD });
  }
};




export const getAuditLogs = async (req, res) => {
  try {
    const { page, limit, from, to } = resolvePagination(req);
    const requesterId = req.user?.id || null;
    const requesterEmail = String(req.user?.email || '').toLowerCase().trim();

    // 1. Resolve true role from DB
    let userProfile = null;
    if (isUuid(requesterId)) {
      const { data } = await supabase.from('users').select('userId, role').eq('userId', requesterId).maybeSingle();
      userProfile = data;
    }
    if (!userProfile && requesterEmail) {
      const { data } = await supabase.from('users').select('userId, role').eq('email', requesterEmail).maybeSingle();
      userProfile = data;
    }

    const role = normalizeRole(userProfile?.role);
    const effectiveUserId = userProfile?.userId || requesterId;
    const allowedEventIds = (role !== 'ADMIN') ? await getFilteredEventIds(req) : [];

    let query = supabase
      .from('auditLogs')
      .select('auditLogId, actionType, orderId, ticketId, paymentTransactionId, webhookEventsId, actorUserId, details, createdAt', { count: 'exact' });

    // ADMIN role sees ALL audit logs
    if (role === 'ADMIN') {
      const { data, error, count } = await query
        .order('createdAt', { ascending: false })
        .range(from, to);
      if (error) return res.status(500).json({ error: error.message });

      const items = data || [];
      const actorUserIds = [...new Set(items.map(l => l.actorUserId).filter(Boolean))];
      let userMap = new Map();

      if (actorUserIds.length > 0) {
        const { data: usersData } = await supabase
          .from('users')
          .select('userId, name, email')
          .in('userId', actorUserIds);
        (usersData || []).forEach(u => userMap.set(u.userId, u.name || u.email || 'System User'));
      }

      const mappedItems = items.map(log => {
        let target = 'System';
        if (log.orderId) target = `Order #${log.orderId.slice(-8)}`;
        else if (log.ticketId) target = `Ticket #${log.ticketId.slice(-8)}`;
        else if (log.details?.eventName) target = log.details.eventName;
        else if (log.details?.organizerName) target = log.details.organizerName;

        return {
          id: log.auditLogId,
          action: (log.actionType || 'SYSTEM_ACTION').replace(/_/g, ' '),
          actorName: userMap.get(log.actorUserId) || 'System',
          performedBy: userMap.get(log.actorUserId) || 'System',
          target,
          timestamp: log.createdAt,
          details: log.details || {}
        };
      });

      return res.json({
        items: mappedItems,
        pagination: buildPagination(page, limit, typeof count === 'number' ? count : 0)
      });
    }

    const { data: eventOrders } = allowedEventIds && allowedEventIds.length > 0
      ? await supabase.from('orders').select('orderId').in('eventId', allowedEventIds)
      : { data: [] };

    const orderIds = (eventOrders || []).map(o => o.orderId);

    if (orderIds.length > 0) {
      query = query.or(`actorUserId.eq.${effectiveUserId},orderId.in.(${orderIds.join(',')})`);
    } else {
      query = query.eq('actorUserId', effectiveUserId);
    }

    const { data, error, count } = await query
      .order('createdAt', { ascending: false })
      .range(from, to);

    if (error) return res.status(500).json({ error: error.message });

    const items = data || [];
    const actorUserIds = [...new Set(items.map(l => l.actorUserId).filter(Boolean))];
    let userMap = new Map();

    if (actorUserIds.length > 0) {
      const { data: usersData } = await supabase
        .from('users')
        .select('userId, name, email')
        .in('userId', actorUserIds);
      (usersData || []).forEach(u => userMap.set(u.userId, u.name || u.email || 'System User'));
    }

    const finalMappedItems = items.map(log => {
      let target = 'System';
      if (log.orderId) target = `Order #${log.orderId.slice(-8)}`;
      else if (log.ticketId) target = `Ticket #${log.ticketId.slice(-8)}`;
      else if (log.details?.eventName) target = log.details.eventName;
      else if (log.details?.organizerName) target = log.details.organizerName;

      return {
        id: log.auditLogId,
        action: (log.actionType || 'SYSTEM_ACTION').replace(/_/g, ' '),
        actorName: userMap.get(log.actorUserId) || 'System',
        performedBy: userMap.get(log.actorUserId) || 'System',
        target,
        timestamp: log.createdAt,
        details: log.details || {}
      };
    });

    return res.json({
      items: finalMappedItems,
      pagination: buildPagination(page, limit, typeof count === 'number' ? count : 0)
    });
  } catch (err) {
    console.error('[getAuditLogs] error:', err);
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

export const exportEventReport = async (req, res) => {
  try {
    const { eventId } = req.params;
    if (!eventId) return res.status(400).json({ error: 'eventId required' });

    const filteredEventIds = await getFilteredEventIds(req);
    if (!filteredEventIds.includes(eventId)) {
      return res.status(403).json({ error: 'Not authorized to export this event' });
    }

    const { data: orders, error: orderErr } = await supabase
      .from('orders')
      .select('orderId, buyerName, buyerEmail, totalAmount, status, created_at')
      .eq('eventId', eventId)
      .eq('status', 'PAID');

    if (orderErr) return res.status(500).json({ error: orderErr.message });
    if (!orders || orders.length === 0) return res.status(404).json({ error: 'No data to export' });

    const oIds = orders.map(o => o.orderId);
    const [attResp, ticketResp, ttResp] = await Promise.all([
      supabase.from('attendees').select('attendeeId, orderId, name, email, company').in('orderId', oIds),
      supabase.from('tickets').select('ticketCode, attendeeId, status, issuedAt, ticketTypeId').in('orderId', oIds),
      supabase.from('ticketTypes').select('ticketTypeId, name, priceAmount').eq('eventId', eventId)
    ]);

    if (attResp.error) throw attResp.error;
    if (ticketResp.error) throw ticketResp.error;
    if (ttResp.error) throw ttResp.error;

    const ticketTypeMap = new Map((ttResp.data || []).map(tt => [tt.ticketTypeId, tt]));
    const orderMap = new Map(orders.map(o => [o.orderId, o]));
    const ticketMap = new Map((ticketResp.data || []).map(t => [t.attendeeId, t]));

    const csvHeaders = ['Attendee Name', 'Attendee Email', 'Company', 'Ticket Code', 'Ticket Type', 'Ticket Price', 'Ticket Status', 'Order Purchase Date'];
    let csvRows = [csvHeaders.join(',')];

    for (const attendee of (attResp.data || [])) {
      const order = orderMap.get(attendee.orderId);
      const ticket = ticketMap.get(attendee.attendeeId);
      const ticketType = ticket ? ticketTypeMap.get(ticket.ticketTypeId) : null;
      
      const row = [
        `"${(attendee.name || '').replace(/"/g, '""')}"`,
        `"${(attendee.email || '').replace(/"/g, '""')}"`,
        `"${(attendee.company || '').replace(/"/g, '""')}"`,
        `"${(ticket?.ticketCode || '')}"`,
        `"${(ticketType?.name || 'Unknown').replace(/"/g, '""')}"`,
        ticketType?.priceAmount || 0,
        `"${(ticket?.status || 'UNKNOWN')}"`,
        `"${order?.created_at ? new Date(order.created_at).toISOString() : ''}"`
      ];
      csvRows.push(row.join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="event_report_${eventId}.csv"`);
    return res.status(200).send(csvRows.join('\n'));

  } catch (err) {
    console.error('[exportEventReport] error:', err);
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

export const exportAllReports = async (req, res) => {
  try {
    // Ensure authorized access
    const filteredEventIds = await getFilteredEventIds(req);
    
    if (!filteredEventIds || filteredEventIds.length === 0) {
      return res.status(404).json({ error: 'No data to export' });
    }

    // Load orders
    const { data: orders, error: orderErr } = await supabase
      .from('orders')
      .select('orderId, buyerName, buyerEmail, totalAmount, status, created_at, eventId')
      .in('eventId', filteredEventIds)
      .eq('status', 'PAID');

    if (orderErr) return res.status(500).json({ error: orderErr.message });

    if (!orders || orders.length === 0) {
      return res.status(404).json({ error: 'No data to export' });
    }

    const orderIds = orders.map(o => o.orderId);

    // Load events for names
    const { data: events, error: evErr } = await supabase
      .from('events')
      .select('eventId, eventName')
      .in('eventId', filteredEventIds);

    if (evErr) return res.status(500).json({ error: evErr.message });

    const eventMap = new Map((events || []).map(e => [e.eventId, e.eventName]));

    // Load attendees for those orders
    const { data: attendees, error: attErr } = await supabase
      .from('attendees')
      .select('attendeeId, orderId, name, email, company')
      .in('orderId', orderIds);

    if (attErr) return res.status(500).json({ error: attErr.message });

    // Load ticket info for the attendees
    const { data: tickets, error: ticketErr } = await supabase
      .from('tickets')
      .select('ticketCode, attendeeId, status, issuedAt, ticketTypeId')
      .in('orderId', orderIds);
      
    if (ticketErr) return res.status(500).json({ error: ticketErr.message });

    // Load ticket types
    const { data: ticketTypes, error: ttErr } = await supabase
      .from('ticketTypes')
      .select('ticketTypeId, name, priceAmount')
      .in('eventId', filteredEventIds);

    if (ttErr) return res.status(500).json({ error: ttErr.message });

    const ticketTypeMap = new Map((ticketTypes || []).map(tt => [tt.ticketTypeId, tt]));
    const orderMap = new Map((orders || []).map(o => [o.orderId, o]));
    const ticketMap = new Map((tickets || []).map(t => [t.attendeeId, t]));

    // Construct CSV Data
    const csvHeaders = ['Event', 'Attendee Name', 'Attendee Email', 'Company', 'Ticket Code', 'Ticket Type', 'Ticket Price', 'Ticket Status', 'Order Purchase Date'];
    let csvRows = [csvHeaders.join(',')];

    for (const attendee of (attendees || [])) {
      const order = orderMap.get(attendee.orderId);
      const ticket = ticketMap.get(attendee.attendeeId);
      const ticketType = ticket ? ticketTypeMap.get(ticket.ticketTypeId) : null;
      const eventName = order ? eventMap.get(order.eventId) : 'Unknown';
      
      const row = [
        `"${(eventName || 'Unknown').replace(/"/g, '""')}"`,
        `"${(attendee.name || '').replace(/"/g, '""')}"`,
        `"${(attendee.email || '').replace(/"/g, '""')}"`,
        `"${(attendee.company || '').replace(/"/g, '""')}"`,
        `"${(ticket?.ticketCode || '')}"`,
        `"${(ticketType?.name || 'Unknown').replace(/"/g, '""')}"`,
        ticketType?.priceAmount || 0,
        `"${(ticket?.status || 'UNKNOWN')}"`,
        `"${order?.created_at ? new Date(order.created_at).toISOString() : ''}"`
      ];
      csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="all_events_report.csv"`);
    return res.status(200).send(csvContent);

  } catch (err) {
    console.error('[exportAllReports] error:', err);
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};export const archiveTransaction = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { data, error } = await supabase
      .from('orders')
      .update({ deleted_at: new Date().toISOString() })
      .eq('orderId', orderId)
      .select();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

export const restoreTransaction = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { data, error } = await supabase
      .from('orders')
      .update({ deleted_at: null })
      .eq('orderId', orderId)
      .select();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

export const deleteTransaction = async (req, res) => {
  try {
    const { orderId } = req.params;
    await supabase.from('tickets').delete().eq('orderId', orderId);
    await supabase.from('attendees').delete().eq('orderId', orderId);
    await supabase.from('orderItems').delete().eq('orderId', orderId);
    
    const { data, error } = await supabase
      .from('orders')
      .delete()
      .eq('orderId', orderId)
      .select();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};


export const getArchivedTransactions = async (req, res) => {
  try {
    const filteredEventIds = await getFilteredEventIds(req);
    const { from, to } = resolvePagination(req);

    const { data, error, count } = await supabase
      .from('orders')
      .select('orderId, eventId, buyerName, buyerEmail, totalAmount, currency, status, created_at, deleted_at', { count: 'exact' })
      .in('eventId', filteredEventIds)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .range(from, to);

    if (error) return res.status(500).json({ error: error.message });

    const eventIds = sanitizeUuidList((data || []).map(item => item.eventId));
    let eventMap = new Map();
    if (eventIds.length) {
      const { data: eventRows } = await supabase
        .from('events')
        .select('eventId, eventName')
        .in('eventId', eventIds);
      eventMap = new Map((eventRows || []).map(row => [row.eventId, row.eventName]));
    }

    const items = (data || []).map(item => ({
      orderId: item.orderId,
      customerName: item.buyerName,
      customerEmail: item.buyerEmail,
      amount: item.totalAmount,
      currency: item.currency,
      paymentStatus: item.status,
      createdAt: item.created_at,
      archivedAt: item.deleted_at,
      eventName: eventMap.get(item.eventId) || 'Unknown Event'
    }));

    return res.json({
      transactions: items,
      total: count || 0
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

export const getPlanMetrics = async (req, res) => {
  try {
    const { data: plans } = await supabase.from('plans').select('planId, name');
    const planMap = new Map((plans || []).map(p => [p.planId, p.name]));

    const { data: subs, error } = await supabase
      .from('organizersubscriptions')
      .select('planId, priceAmount, created_at, status')
      .in('status', ['active', 'paid', 'ACTIVE', 'PAID']);

    if (error) throw error;

    // Revenue by Plan
    const revenueByPlan = {};
    (subs || []).forEach(s => {
      const name = planMap.get(s.planId) || 'Unknown';
      revenueByPlan[name] = (revenueByPlan[name] || 0) + (Number(s.priceAmount) || 0);
    });

    // Subscriptions over time (last 30 days)
    const last30Days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      last30Days.push({
        date: d.toISOString().split('T')[0],
        count: 0,
        revenue: 0
      });
    }

    (subs || []).forEach(s => {
      const date = new Date(s.created_at).toISOString().split('T')[0];
      const day = last30Days.find(d => d.date === date);
      if (day) {
        day.count++;
        day.revenue += (Number(s.priceAmount) || 0);
      }
    });

    return res.json({
      revenueByPlan: Object.entries(revenueByPlan).map(([name, value]) => ({ name, value })),
      dailyMetrics: last30Days
    });
  } catch (err) {
    console.error('[Analytics] getPlanMetrics error:', err);
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

export const getSubscriptionHealth = async (req, res) => {
  try {
    const { data: plans } = await supabase.from('plans').select('planId, name');
    const { data: subs } = await supabase
      .from('organizersubscriptions')
      .select('planId, status')
      .in('status', ['active', 'paid', 'ACTIVE', 'PAID']);

    const planCounts = {};
    (subs || []).forEach(s => {
      planCounts[s.planId] = (planCounts[s.planId] || 0) + 1;
    });

    const metrics = (plans || []).map(p => ({
      name: p.name,
      count: planCounts[p.planId] || 0
    }));

    // Get total organizers for conversion rate
    const { count: totalOrganizers } = await supabase
      .from('organizers')
      .select('organizerId', { count: 'exact', head: true });

    return res.json({
      planDistribution: metrics,
      totalOrganizers: totalOrganizers || 0,
      activeSubscribers: subs.length
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};
