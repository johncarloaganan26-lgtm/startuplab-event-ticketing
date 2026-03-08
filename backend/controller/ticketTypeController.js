import supabase from '../database/db.js';
import { checkPlanLimits } from '../utils/planValidator.js';
import { getOrganizerByOwnerUserId } from '../utils/organizerData.js';

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

    // 2. Check Plan Limits
    const organizer = await getOrganizerByOwnerUserId(userId);
    if (organizer?.organizerId) {
      const limitCheck = await checkPlanLimits(organizer.organizerId, 'max_tickets_per_event', (count || 0) + 1);
      if (!limitCheck.allowed) {
        return res.status(403).json({
          error: limitCheck.message,
          code: 'PLAN_LIMIT_REACHED'
        });
      }
    }

    let payload = { ...req.body, createdBy: userId };
    const { data, error } = await supabase
      .from('ticketTypes')
      .insert(payload)
      .select('*')
      .single();
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.status(201).json(data);
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

// Update ticket type
export const updateTicketType = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const { data, error } = await supabase
      .from('ticketTypes')
      .update(updates)
      .eq('ticketTypeId', id)
      .select('*')
      .single();
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
