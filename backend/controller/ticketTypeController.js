import supabase from '../database/db.js';
import { checkPlanLimits } from '../utils/planValidator.js';
import { getOrganizerByUserId } from '../utils/organizerData.js';

// List ticket types for an event
export const listTicketTypes = async (req, res) => {
  try {
    const { eventId } = req.query;
    if (!eventId) return res.status(400).json({ error: 'eventId is required' });
    const { data, error } = await supabase
      .from('ticketTypes')
      .select('*')
      .eq('eventId', eventId);
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

// Create ticket type
export const createTicketType = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId || null;
    const eventId = req.body?.eventId;

    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    if (!eventId) return res.status(400).json({ error: 'eventId is required' });

    // 1. Get current ticket type count for this event
    const { count, error: countErr } = await supabase
      .from('ticketTypes')
      .select('*', { count: 'exact', head: true })
      .eq('eventId', eventId);

    if (countErr) throw countErr;

    const organizer = await getOrganizerByUserId(userId);
    if (organizer?.organizerId) {
      // 2a. Check total tickets limit
      const limitCheck = await checkPlanLimits(organizer.organizerId, 'max_tickets_per_event', (count || 0) + 1);
      if (!limitCheck.allowed) {
        return res.status(403).json({
          error: limitCheck.message,
          code: 'PLAN_LIMIT_REACHED'
        });
      }

      // 2b. If this is a paid ticket, check if the event is published and if the organizer has reached the paid events limit
      const isPaid = (req.body?.priceAmount || 0) > 0;
      if (isPaid) {
        const { data: event } = await supabase.from('events').select('status').eq('eventId', eventId).single();
        if (event?.status === 'PUBLISHED') {
          // Check if the event already has paid tickets
          const { data: existingPaidTickets } = await supabase
            .from('ticketTypes')
            .select('ticketTypeId')
            .eq('eventId', eventId)
            .gt('priceAmount', 0)
            .limit(1);

          const hasPricedTicketAlready = existingPaidTickets && existingPaidTickets.length > 0;

          // If this is the FIRST paid ticket for a published event, check the limit
          if (!hasPricedTicketAlready) {
            const pricedEventLimit = await checkPlanLimits(organizer.organizerId, 'max_priced_events', 1, { excludeId: eventId });
            if (!pricedEventLimit.allowed) {
              return res.status(403).json({
                error: pricedEventLimit.message,
                code: 'PAID_EVENT_LIMIT_REACHED'
              });
            }
          }
        }
      }
    }

    const { capacityPerTicket, ...rest } = req.body;
    let payload = { 
        ...rest, 
        capacity_per_ticket: capacityPerTicket || 1,
        createdBy: userId 
    };
    
    console.log('[createTicketType] Attempting insert with payload:', payload);

    let { data, error } = await supabase
      .from('ticketTypes')
      .insert(payload)
      .select('*')
      .single();

    // Fallback if the column doesn't exist yet
    if (error && (error.message?.includes('column "capacity_per_ticket" does not exist') || error.code === '42703')) {
      console.warn('[createTicketType] capacity_per_ticket column missing, falling back to basic insert');
      const fallbackPayload = { ...rest, createdBy: userId };
      const { data: retryData, error: retryError } = await supabase
        .from('ticketTypes')
        .insert(fallbackPayload)
        .select('*')
        .single();
      
      data = retryData;
      error = retryError;
    }

    if (error) {
      console.error('[createTicketType] Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }
    return res.status(201).json(data);
  } catch (err) {
    console.error('[createTicketType] Unexpected error:', err);
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

// Update ticket type
export const updateTicketType = async (req, res) => {
  try {
    const { id } = req.params;
    const initialUpdates = req.body;
    const userId = req.user?.id || req.user?.userId || null;

    // 1. If trying to set a price > 0, check plan limits
    if ((initialUpdates.priceAmount || 0) > 0 && userId) {
      const { data: currentTicket } = await supabase
        .from('ticketTypes')
        .select('eventId, priceAmount')
        .eq('ticketTypeId', id)
        .single();
      
      const organizer = await getOrganizerByUserId(userId);
      
      if (currentTicket && (currentTicket.priceAmount || 0) === 0 && organizer?.organizerId) {
        // This ticket is being changed from free to paid
        const { data: event } = await supabase
          .from('events')
          .select('status, organizerId')
          .eq('eventId', currentTicket.eventId)
          .single();
        
        if (event?.status === 'PUBLISHED') {
          // Check if the event already has OTHER paid tickets
          const { data: otherPaidTickets } = await supabase
            .from('ticketTypes')
            .select('ticketTypeId')
            .eq('eventId', currentTicket.eventId)
            .gt('priceAmount', 0)
            .neq('ticketTypeId', id)
            .limit(1);

          const hasOtherPaidTickets = otherPaidTickets && otherPaidTickets.length > 0;

          if (!hasOtherPaidTickets) {
            const pricedEventLimit = await checkPlanLimits(organizer.organizerId, 'max_priced_events', 1, { excludeId: currentTicket.eventId });
            if (!pricedEventLimit.allowed) {
              return res.status(403).json({
                error: pricedEventLimit.message,
                code: 'PAID_EVENT_LIMIT_REACHED'
              });
            }
          }
        }
      }
    }

    const { capacityPerTicket, ...rest } = req.body;
    const updates = { ...rest };
    if (capacityPerTicket !== undefined) {
      updates.capacity_per_ticket = capacityPerTicket;
    }

    let { data, error } = await supabase
      .from('ticketTypes')
      .update(updates)
      .eq('ticketTypeId', id)
      .select('*')
      .single();

    // Fallback if the column doesn't exist yet
    if (error && (error.message?.includes('column "capacity_per_ticket" does not exist') || error.code === '42703')) {
      console.warn('[updateTicketType] capacity_per_ticket column missing, falling back to basic update');
      const { capacity_per_ticket, ...fallbackUpdates } = updates;
      const { data: retryData, error: retryError } = await supabase
        .from('ticketTypes')
        .update(fallbackUpdates)
        .eq('ticketTypeId', id)
        .select('*')
        .single();
      
      data = retryData;
      error = retryError;
    }

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Ticket type not found' });

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

// Delete ticket type
export const deleteTicketType = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('ticketTypes')
      .delete()
      .eq('ticketTypeId', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};
