import supabase from '../database/db.js';
import { logAudit } from '../utils/auditLogger.js';
import { getEventLikeCountsMap } from './eventLikeController.js';

const DEFAULT_PROMOTION_DURATION_DAYS = 7;
const emptyQuotaResponse = () => ({
  limit: 0,
  used: 0,
  remaining: 0,
  durationDays: DEFAULT_PROMOTION_DURATION_DAYS,
  canPromote: false
});

/**
 * Toggle event promotion on/off
 * Creates a promoted_events record with expiration based on plan duration
 */
export const toggleEventPromotion = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { eventId } = req.params;
    if (!eventId) return res.status(400).json({ error: 'Event ID required' });

    // Get the event
    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('eventId, createdBy, organizerId')
      .eq('eventId', eventId)
      .maybeSingle();

    if (eventErr) throw eventErr;
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Check authorization
    const createdByUser = event.createdBy === userId;
    const isEventOrganizer = event.organizerId === userId || (event.organizerId && event.organizerId.includes(userId));
    if (!createdByUser && !isEventOrganizer) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get organizer's subscription and plan
    const { data: organizer, error: orgErr } = await supabase
      .from('organizers')
      .select('organizerId, currentPlanId')
      .eq('ownerUserId', userId)
      .maybeSingle();

    if (orgErr) throw orgErr;
    if (!organizer) return res.status(403).json({ error: 'Not an organizer' });
    if (!organizer.currentPlanId) {
      return res.status(402).json({
        error: 'Promotion is not available on your current plan.',
        limit: 0,
        activeCount: 0
      });
    }

    // Get the plan details
    const { data: planFeatures, error: planErr } = await supabase
      .from('planFeatures')
      .select('key, value')
      .eq('planId', organizer.currentPlanId);

    if (planErr) throw planErr;

    // Extract promotion limits from plan features
    let maxPromotedEvents = 0;
    let promotionDurationDays = DEFAULT_PROMOTION_DURATION_DAYS;

    (planFeatures || []).forEach(feat => {
      if (feat.key === 'max_promoted_events') {
        const parsed = Number.parseInt(feat.value, 10);
        if (Number.isFinite(parsed) && parsed >= 0) maxPromotedEvents = parsed;
      }
      if (feat.key === 'promotion_duration_days') {
        const parsed = Number.parseInt(feat.value, 10);
        if (Number.isFinite(parsed) && parsed > 0) promotionDurationDays = parsed;
      }
    });

    // Check if promotion exists
    const { data: existingPromo, error: checkErr } = await supabase
      .from('promoted_events')
      .select('promotion_id')
      .eq('eventId', eventId)
      .eq('organizerId', organizer.organizerId)
      .gte('expires_at', new Date().toISOString())
      .maybeSingle();

    if (checkErr && checkErr.code !== 'PGRST116') throw checkErr;

    if (existingPromo) {
      // Remove promotion
      const { error: deleteErr } = await supabase
        .from('promoted_events')
        .delete()
        .eq('promotion_id', existingPromo.promotion_id);

      if (deleteErr) throw deleteErr;

      await logAudit({
        actionType: 'EVENT_PROMOTION_REMOVED',
        details: { eventId, organizerId: organizer.organizerId },
        req
      });

      return res.json({ promoted: false, message: 'Event promotion removed' });
    }

    // Check promotion limit
    const { data: activePromos, error: countErr } = await supabase
      .from('promoted_events')
      .select('promotion_id')
      .eq('organizerId', organizer.organizerId)
      .gte('expires_at', new Date().toISOString());

    if (countErr && countErr.code !== 'PGRST116') throw countErr;
    const activePromoCount = (activePromos || []).length;

    if (maxPromotedEvents > 0 && activePromoCount >= maxPromotedEvents) {
      return res.status(402).json({
        error: `Promotion limit reached. Your plan allows ${maxPromotedEvents} promoted events at a time.`,
        activeCount: activePromoCount,
        limit: maxPromotedEvents
      });
    }

    // Create promotion
    const now = new Date();
    const expiresAt = new Date(now.getTime() + promotionDurationDays * 24 * 60 * 60 * 1000);

    const { data: newPromo, error: insertErr } = await supabase
      .from('promoted_events')
      .insert({
        eventId,
        organizerId: organizer.organizerId,
        createdAt: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        duration_days: promotionDurationDays
      })
      .select('promotion_id, expires_at')
      .single();

    if (insertErr) throw insertErr;

    await logAudit({
      actionType: 'EVENT_PROMOTION_CREATED',
      details: { eventId, organizerId: organizer.organizerId, expiresAt },
      req
    });

    return res.status(201).json({
      promoted: true,
      promotionId: newPromo.promotion_id,
      expiresAt: newPromo.expires_at,
      message: `Event promoted for ${promotionDurationDays} days`
    });
  } catch (error) {
    console.error('toggleEventPromotion error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to toggle promotion' });
  }
};

/**
 * Get promotion status for an event
 */
export const getEventPromotionStatus = async (req, res) => {
  try {
    const { eventId } = req.params;
    if (!eventId) return res.status(400).json({ error: 'Event ID required' });

    const { data: promo, error: promoErr } = await supabase
      .from('promoted_events')
      .select('promotion_id, expires_at, createdAt')
      .eq('eventId', eventId)
      .gte('expires_at', new Date().toISOString())
      .maybeSingle();

    if (promoErr && promoErr.code !== 'PGRST116') throw promoErr;

    if (!promo) {
      return res.json({ promoted: false });
    }

    const now = new Date();
    const expiresAt = new Date(promo.expires_at);
    const remainingMs = expiresAt.getTime() - now.getTime();
    const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));

    return res.json({
      promoted: true,
      promotionId: promo.promotion_id,
      expiresAt: promo.expires_at,
      remainingDays: Math.max(0, remainingDays),
      createdAt: promo.createdAt
    });
  } catch (error) {
    console.error('getEventPromotionStatus error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to get promotion status' });
  }
};

/**
 * Get all promoted events (for landing page)
 */
export const getPromotedEvents = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;

    const { data: promotedEventIds, error: promoErr } = await supabase
      .from('promoted_events')
      .select('eventId')
      .gte('expires_at', new Date().toISOString())
      .limit(limit);

    if (promoErr && promoErr.code !== 'PGRST116') throw promoErr;

    if (!promotedEventIds || promotedEventIds.length === 0) {
      return res.json({ events: [] });
    }

    const eventIds = promotedEventIds.map(p => p.eventId);

    // Get the events
    const { data: events, error: eventsErr } = await supabase
      .from('events')
      .select('*')
      .in('eventId', eventIds)
      .eq('status', 'PUBLISHED')
      .eq('is_archived', false);

    if (eventsErr) throw eventsErr;

    // Get ticket types for these events
    const { data: ticketTypes } = await supabase
      .from('ticketTypes')
      .select('*')
      .in('eventId', eventIds)
      .eq('status', true);

    const ttMap = new Map();
    (ticketTypes || []).forEach(tt => {
      const list = ttMap.get(tt.eventId) || [];
      list.push(tt);
      ttMap.set(tt.eventId, list);
    });

    // Get likes count
    const likeCountsMap = await getEventLikeCountsMap(eventIds);

    // Fetch registration counts
    let regCountMap = new Map();
    const { data: attendees } = await supabase
      .from('attendees')
      .select('eventId')
      .in('eventId', eventIds);
    (attendees || []).forEach(att => {
      regCountMap.set(att.eventId, (regCountMap.get(att.eventId) || 0) + 1);
    });

    // Get organizer data for each event
    const eventsWithOrganizers = await Promise.all((events || []).map(async (event) => {
      const eventWithData = { 
        ...event, 
        ticketTypes: ttMap.get(event.eventId) || [],
        likesCount: likeCountsMap.get(event.eventId) || 0,
        registrationCount: regCountMap.get(event.eventId) || 0
      };
      if (event.organizerId) {
        const { data: organizer, error: orgErr } = await supabase
          .from('organizers')
          .select('organizerId, organizerName, profileImageUrl, bio, website, followersCount')
          .eq('organizerId', event.organizerId)
          .single();
        
        if (!orgErr && organizer) {
          return { ...eventWithData, organizer };
        }
      }
      return { ...eventWithData, organizer: null };
    }));

    return res.json({ events: eventsWithOrganizers });
  } catch (error) {
    console.error('getPromotedEvents error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to get promoted events' });
  }
};

/**
 * Get promotion quota for organizer
 */
export const getPromotionQuota = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    // Get organizer
    const { data: organizer, error: orgErr } = await supabase
      .from('organizers')
      .select('organizerId, currentPlanId')
      .eq('ownerUserId', userId)
      .maybeSingle();

    if (orgErr) throw orgErr;
    if (!organizer) return res.status(403).json({ error: 'Not an organizer' });
    if (!organizer.currentPlanId) return res.json(emptyQuotaResponse());

    // Get plan features
    const { data: planFeatures, error: planErr } = await supabase
      .from('planFeatures')
      .select('key, value')
      .eq('planId', organizer.currentPlanId);

    if (planErr) throw planErr;

    let maxPromotedEvents = 0;
    let promotionDurationDays = DEFAULT_PROMOTION_DURATION_DAYS;

    (planFeatures || []).forEach(feat => {
      if (feat.key === 'max_promoted_events') {
        const parsed = Number.parseInt(feat.value, 10);
        if (Number.isFinite(parsed) && parsed >= 0) maxPromotedEvents = parsed;
      }
      if (feat.key === 'promotion_duration_days') {
        const parsed = Number.parseInt(feat.value, 10);
        if (Number.isFinite(parsed) && parsed > 0) promotionDurationDays = parsed;
      }
    });

    // Count active promotions
    const { data: activePromos, error: countErr } = await supabase
      .from('promoted_events')
      .select('promotion_id')
      .eq('organizerId', organizer.organizerId)
      .gte('expires_at', new Date().toISOString());

    if (countErr && countErr.code === '42P01') {
      return res.json(emptyQuotaResponse());
    }
    if (countErr && countErr.code !== 'PGRST116') throw countErr;
    const used = (activePromos || []).length;

    return res.json({
      limit: maxPromotedEvents,
      used,
      remaining: maxPromotedEvents - used,
      durationDays: promotionDurationDays,
      canPromote: maxPromotedEvents > 0 && used < maxPromotedEvents
    });
  } catch (error) {
    console.error('getPromotionQuota error:', error);
    if (error?.code === '42P01') {
      return res.json(emptyQuotaResponse());
    }
    return res.status(500).json({ error: error?.message || 'Failed to get promotion quota' });
  }
};
