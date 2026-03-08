import supabase from '../database/db.js';
import { enrichEventsWithOrganizer } from '../utils/organizerData.js';
import { getEventLikeCountsMap } from './eventLikeController.js';

// Utility: filter events by registration window if provided
function withinRegistrationWindow(event) {
  const now = new Date();
  const open = event.regOpenAt ? new Date(event.regOpenAt) : null;
  const close = event.regCloseAt ? new Date(event.regCloseAt) : null;
  if (open && now < open) return false;
  if (close && now > close) return false;
  return true;
}

// Utility: filter ticket types by sales window if provided
function withinSalesWindow(tt) {
  const now = new Date();
  const start = tt.salesStartAt ? new Date(tt.salesStartAt) : null;
  const end = tt.salesEndAt ? new Date(tt.salesEndAt) : null;
  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
}

// Utility: group ticketTypes by eventId
function attachTicketTypes(events, ticketTypes) {
  const map = new Map();
  for (const tt of ticketTypes) {
    const list = map.get(tt.eventId) || [];
    list.push(tt);
    map.set(tt.eventId, list);
  }
  return events.map(e => ({ ...e, ticketTypes: map.get(e.eventId) || [] }));
}

const UUID_V4_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function fetchEventByIdentifier(identifier) {
  const bySlug = await supabase
    .from('events')
    .select('*')
    .eq('slug', identifier)
    .limit(1);

  if (bySlug.error) return { error: bySlug.error, event: null };
  const slugEvent = (bySlug.data || [])[0];
  if (slugEvent) return { error: null, event: slugEvent };

  if (!UUID_V4_LIKE.test(identifier)) return { error: null, event: null };

  const byId = await supabase
    .from('events')
    .select('*')
    .eq('eventId', identifier)
    .limit(1);

  if (byId.error) return { error: byId.error, event: null };
  return { error: null, event: (byId.data || [])[0] || null };
}

export const listLiveEvents = async (req, res) => {
  try {
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .in('status', ['LIVE', 'PUBLISHED'])
      .order('startAt', { ascending: false });

    if (eventsError) return res.status(500).json({ error: eventsError.message });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const filteredEvents = (events || []).filter(e => {
      const start = new Date(e.startAt);
      const end = new Date(e.endAt);
      const hasContent = (e.locationText && e.locationText.trim() !== '') || (e.streaming_url && e.streaming_url.trim() !== '');

      // Show if the event date overlaps with today and it has broadcast info
      const isToday = start <= endOfToday && end >= startOfToday;
      return hasContent && isToday;
    });

    const enrichedEvents = await enrichEventsWithOrganizer(filteredEvents);
    return res.json({ success: true, data: enrichedEvents });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

export const listEvents = async (req, res) => {
  try {
    const statusStr = req.query.status ? req.query.status.toString() : 'PUBLISHED,LIVE';
    const statuses = statusStr.split(',');
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').toString().trim();
    const location = (req.query.location || '').toString().trim();
    const organizerId = (req.query.organizerId || '').toString().trim();

    // Advanced filters
    const category = req.query.category;
    const price = req.query.price; // 'free' | 'paid'
    const format = req.query.format; // 'online' | 'in-person'
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const sortBy = req.query.sortBy;

    // 1) Fetch candidate events
    let query = supabase.from('events').select('*');
    if (statuses.length > 0) query = query.in('status', statuses);
    if (organizerId) query = query.eq('organizerId', organizerId);

    if (search) {
      query = query.or(`eventName.ilike.%${search}%,locationText.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (location) {
      if (location === 'Online Events') {
        query = query.in('locationType', ['ONLINE', 'HYBRID']);
      } else {
        query = query.ilike('locationText', `%${location}%`);
      }
    }

    if (format === 'online') {
      query = query.in('locationType', ['ONLINE', 'HYBRID']);
    } else if (format === 'in-person') {
      query = query.eq('locationType', 'IN_PERSON');
    }

    const { data: events, error: eventsError } = await query;
    if (eventsError) return res.status(500).json({ error: eventsError.message });

    // 2) Fetch ticket types for all candidate events (required for price filtering and return)
    const allEventIds = (events || []).map(e => e.eventId);
    let allTicketTypes = [];
    if (allEventIds.length > 0) {
      const { data: ttData } = await supabase
        .from('ticketTypes')
        .select('*')
        .eq('status', true)
        .in('eventId', allEventIds);
      allTicketTypes = ttData || [];
    }
    const ttMap = new Map();
    allTicketTypes.forEach(tt => {
      const list = ttMap.get(tt.eventId) || [];
      list.push(tt);
      ttMap.set(tt.eventId, list);
    });

    // 3) Apply JS-side filters (Date, Price, Category)
    let filtered = (events || []).filter(withinRegistrationWindow);

    if (startDate) {
      const start = new Date(startDate);
      filtered = filtered.filter(e => new Date(e.startAt) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      filtered = filtered.filter(e => new Date(e.startAt) <= end);
    }

    if (price === 'free' || price === 'paid') {
      filtered = filtered.filter(e => {
        const etts = ttMap.get(e.eventId) || [];
        const minPrice = etts.length ? Math.min(...etts.map(t => t.priceAmount)) : 0;
        return price === 'free' ? minPrice === 0 : minPrice > 0;
      });
    }

    // Category filtering (Keyword based - simplistic replicate of frontend logic)
    if (category && category !== 'all') {
      // Replicate some keywords for common categories if needed, or better:
      // The frontend could pass keywords in search, but search is already used.
      // For now, we'll just check if the category name itself appears in the event text if it's a specific category.
      const catLower = category.toLowerCase();
      filtered = filtered.filter(e => {
        const source = `${e.eventName} ${e.description} ${e.locationText}`.toLowerCase();
        // This is a minimal implementation of the frontend's keyword system
        return source.includes(catLower);
      });
    }

    // 4) Rank and Paginate
    const filteredEventIds = filtered.map(e => e.eventId);
    const allLikeCountMap = await getEventLikeCountsMap(filteredEventIds);

    let ranked = [...filtered].sort((a, b) => {
      if (sortBy === 'date_soon') return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
      if (sortBy === 'newest') return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();

      const likeDiff = (allLikeCountMap.get(b.eventId) || 0) - (allLikeCountMap.get(a.eventId) || 0);
      if (likeDiff !== 0) return likeDiff;
      return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
    });

    const total = ranked.length;
    const totalPages = total ? Math.ceil(total / limit) : 1;
    const pagedEvents = ranked.slice(offset, offset + limit);

    if (pagedEvents.length === 0) {
      return res.json({ events: [], pagination: { page, limit, total: 0, totalPages: 0 } });
    }

    // 5) Build final response objects
    const eventIdsForPage = pagedEvents.map(e => e.eventId);
    // Already have ticket types in ttMap, so we can just use those.

    // Fetch registration counts for page
    let regCountMap = new Map();
    const { data: attendees } = await supabase
      .from('attendees')
      .select('eventId')
      .in('eventId', eventIdsForPage);
    (attendees || []).forEach(att => {
      regCountMap.set(att.eventId, (regCountMap.get(att.eventId) || 0) + 1);
    });

    const withTicketTypes = pagedEvents.map(e => {
      const usableTTs = (ttMap.get(e.eventId) || []).filter(withinSalesWindow);
      return {
        ...e,
        ticketTypes: usableTTs,
        registrationCount: regCountMap.get(e.eventId) || 0,
        likesCount: allLikeCountMap.get(e.eventId) || 0,
      };
    });

    const enrichedEvents = await enrichEventsWithOrganizer(withTicketTypes);

    return res.json({
      events: enrichedEvents,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

export const getEventBySlug = async (req, res) => {
  try {
    const identifier = req.params.slug || req.params.id || req.params.identifier;

    // 1) Fetch event by slug first, then by eventId if identifier looks like UUID.
    const { event, error: eventError } = await fetchEventByIdentifier(identifier);
    if (eventError) return res.status(500).json({ error: eventError.message });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // 2) Fetch ticket types for this event
    const { data: ticketTypes, error: ttError } = await supabase
      .from('ticketTypes')
      .select('*')
      .eq('status', true)
      .eq('eventId', event.eventId);

    if (ttError) return res.status(500).json({ error: ttError.message });

    // 3) Filter by sales window, attach and return
    const usableTicketTypes = (ticketTypes || []).filter(withinSalesWindow);
    const likeCounts = await getEventLikeCountsMap([event.eventId]);
    const [enrichedEvent] = await enrichEventsWithOrganizer([{
      ...event,
      ticketTypes: usableTicketTypes,
      likesCount: likeCounts.get(event.eventId) || 0,
    }]);
    return res.json(enrichedEvent || {
      ...event,
      ticketTypes: usableTicketTypes,
      likesCount: likeCounts.get(event.eventId) || 0,
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};
