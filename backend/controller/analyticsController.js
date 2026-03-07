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
    if (Array.isArray(filteredEventIds) && filteredEventIds.length === 0) {
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
    let ticketsQuery = supabase.from('tickets').select('ticketId, status, issuedAt, eventId');
    if (Array.isArray(filteredEventIds) && filteredEventIds.length > 0) {
      ticketsQuery = ticketsQuery.in('eventId', filteredEventIds);
    }
    const { data: tickets, error: ticketErr } = await ticketsQuery;
    if (ticketErr) {
      logAnalyticsError('getSummary.tickets', ticketErr, { requesterId: req.user?.id });
      return res.status(500).json({ error: ticketErr.message, build: ANALYTICS_BUILD });
    }

    const totalRegistrations = tickets?.length || 0;
    const usedCount = (tickets || []).filter(t => t.status === 'USED').length;
    const attendanceRate = totalRegistrations ? (usedCount / totalRegistrations) * 100 : 0;

    // Orders and revenue
    let ordersQuery = supabase.from('orders').select('orderId, totalAmount, status, created_at, eventId');
    if (Array.isArray(filteredEventIds) && filteredEventIds.length > 0) {
      ordersQuery = ordersQuery.in('eventId', filteredEventIds);
    }
    const { data: orders, error: orderErr } = await ordersQuery;
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

    return res.json({
      totalRegistrations,
      ticketsSoldToday,
      totalRevenue,
      revenueToday,
      attendanceRate,
      paymentSuccessRate,
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
    if (Array.isArray(filteredEventIds) && filteredEventIds.length === 0) {
      return res.json({
        items: [],
        pagination: buildPagination(page, limit, 0)
      });
    }

    let query = supabase
      .from('orders')
      .select('orderId, eventId, buyerName, totalAmount, currency, status, created_at', { count: 'exact' });

    if (Array.isArray(filteredEventIds) && filteredEventIds.length > 0) {
      query = query.in('eventId', filteredEventIds);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) {
      logAnalyticsError('getRecentTransactions.query', error, { requesterId: req.user?.id, page, limit });
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
        logAnalyticsError('getRecentTransactions.events', eventErr, { requesterId: req.user?.id, eventIdsCount: eventIds.length });
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
    if (Array.isArray(filteredEventIds) && filteredEventIds.length === 0) {
      return res.json({
        items: [],
        pagination: buildPagination(page, limit, 0)
      });
    }

    let query = supabase
      .from('orders')
      .select('orderId, eventId, buyerName, buyerEmail, totalAmount, currency, status, created_at', { count: 'exact' });

    if (Array.isArray(filteredEventIds) && filteredEventIds.length > 0) {
      query = query.in('eventId', filteredEventIds);
    }

    const { data, error, count } = await query
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
    console.log('[getAuditLogs] req.user:', req.user);
    console.log('[getAuditLogs] req.user?.role:', req.user?.role);
    
    const { page, limit, from, to } = resolvePagination(req);
    const filteredEventIds = await getFilteredEventIds(req);
    console.log('[getAuditLogs] filteredEventIds:', filteredEventIds);

    let query = supabase
      .from('auditLogs')
      .select('auditLogId, actionType, orderId, ticketId, paymentTransactionId, webhookEventsId, actorUserId, createdAt', { count: 'exact' });
    const role = normalizeRole(req.user?.role);
    console.log('[getAuditLogs] normalized role:', role);
    const allowedEventIds = filteredEventIds;

    // ADMIN role sees ALL audit logs
    if (role === 'ADMIN') {
      const { data, error, count } = await query
        .order('createdAt', { ascending: false })
        .range(from, to);
      console.log('[getAuditLogs] admin query result:', { data, error, count });
      if (error) return res.status(500).json({ error: error.message });
      const total = typeof count === 'number' ? count : 0;
      return res.json({
        items: data || [],
        pagination: buildPagination(page, limit, total)
      });
    }

    const { data: eventOrders } = allowedEventIds && allowedEventIds.length > 0
      ? await supabase.from('orders').select('orderId').in('eventId', allowedEventIds)
      : { data: [] };

    const orderIds = (eventOrders || []).map(o => o.orderId);

    if (orderIds.length > 0) {
      query = query.or(`actorUserId.eq.${req.user.id},orderId.in.(${orderIds.join(',')})`);
    } else {
      query = query.eq('actorUserId', req.user.id);
    }

    const { data, error, count } = await query
      .order('createdAt', { ascending: false })
      .range(from, to);
    console.log('[getAuditLogs] non-admin query result:', { data, error, count });
    if (error) return res.status(500).json({ error: error.message });
    const total = typeof count === 'number' ? count : 0;
    return res.json({
      items: data || [],
      pagination: buildPagination(page, limit, total)
    });
  } catch (err) {
    console.error('[getAuditLogs] error:', err);
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};
