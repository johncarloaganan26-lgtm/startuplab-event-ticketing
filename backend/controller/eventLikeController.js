import supabase from '../database/db.js';
import { isMissingColumnError, isMissingRelationError } from '../utils/organizerData.js';
import {
  getUserProfileByAuthId,
  buildDisplayName,
  notifyUserByPreference,
  debugLog,
} from '../utils/notificationService.js';

const EVENT_LIKE_STORE_VARIANTS = [
  { tableName: 'eventLikes', eventIdCol: 'eventId', userIdCol: 'userId' },
  { tableName: 'eventlikes', eventIdCol: 'eventId', userIdCol: 'userId' },
  { tableName: 'eventlikes', eventIdCol: 'eventid', userIdCol: 'userid' },
  { tableName: 'eventLikes', eventIdCol: 'eventid', userIdCol: 'userid' },
];

function isEventLikeSchemaError(error) {
  if (!error) return false;
  return (
    isMissingRelationError(error, 'eventLikes') ||
    isMissingRelationError(error, 'eventlikes') ||
    isMissingColumnError(error, 'eventId') ||
    isMissingColumnError(error, 'userId') ||
    isMissingColumnError(error, 'eventid') ||
    isMissingColumnError(error, 'userid')
  );
}

async function withEventLikeStore(operation) {
  let lastSchemaError = null;

  for (const variant of EVENT_LIKE_STORE_VARIANTS) {
    const response = await operation(variant);
    if (!response?.error) {
      return { ...response, variant };
    }
    if (isEventLikeSchemaError(response.error)) {
      lastSchemaError = response.error;
      continue;
    }
    return { ...response, variant };
  }

  return {
    data: null,
    error: lastSchemaError || { message: 'Event like storage is not initialized' },
    variant: null,
  };
}

const NOT_INITIALIZED_MESSAGE = 'Event likes feature is not initialized. Run backend/database/event_likes.sql first.';

async function resolveLikeNotificationContext(eventId) {
  const { data: eventRow, error: eventError } = await supabase
    .from('events')
    .select('eventId, eventName, slug, organizerId, createdBy')
    .eq('eventId', eventId)
    .maybeSingle();
  if (eventError) throw eventError;
  if (!eventRow) return null;

  let organizerOwnerUserId = eventRow.createdBy || null;
  let organizerName = null;

  if (eventRow.organizerId) {
    const { data: organizerRow, error: organizerError } = await supabase
      .from('organizers')
      .select('organizerId, ownerUserId, organizerName')
      .eq('organizerId', eventRow.organizerId)
      .maybeSingle();
    if (organizerError && !isMissingRelationError(organizerError, 'organizers')) {
      throw organizerError;
    }
    if (organizerRow) {
      organizerOwnerUserId = organizerRow.ownerUserId || organizerOwnerUserId;
      organizerName = organizerRow.organizerName || null;
    }
  }

  return {
    eventId: eventRow.eventId,
    eventName: eventRow.eventName || 'Untitled Event',
    eventPath: eventRow.slug ? `/events/${eventRow.slug}` : '',
    organizerId: eventRow.organizerId || null,
    organizerOwnerUserId,
    organizerName,
  };
}

async function eventExists(eventId) {
  const { data, error } = await supabase
    .from('events')
    .select('eventId')
    .eq('eventId', eventId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

async function getEventLikeSummary(eventId, userId) {
  const { data, error, variant } = await withEventLikeStore((candidate) => (
    supabase
      .from(candidate.tableName)
      .select(`${candidate.eventIdCol},${candidate.userIdCol}`)
      .eq(candidate.eventIdCol, eventId)
  ));

  if (error) throw error;

  const rows = data || [];
  const userIdKey = variant?.userIdCol || 'userId';
  return {
    likesCount: rows.length,
    liked: rows.some((row) => String(row?.[userIdKey] || '') === String(userId || '')),
  };
}

export async function getEventLikeCountsMap(eventIds = []) {
  const countMap = new Map();
  const uniqueEventIds = [...new Set((eventIds || []).filter(Boolean))];
  if (uniqueEventIds.length === 0) return countMap;

  const { data, error, variant } = await withEventLikeStore((candidate) => (
    supabase
      .from(candidate.tableName)
      .select(candidate.eventIdCol)
      .in(candidate.eventIdCol, uniqueEventIds)
  ));

  if (error) {
    if (isEventLikeSchemaError(error)) return countMap;
    throw error;
  }

  const eventIdKey = variant?.eventIdCol || 'eventId';
  for (const row of data || []) {
    const eventId = row?.[eventIdKey];
    if (!eventId) continue;
    countMap.set(eventId, (countMap.get(eventId) || 0) + 1);
  }
  return countMap;
}

export const getMyLikedEvents = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { data, error, variant } = await withEventLikeStore((candidate) => (
      supabase
        .from(candidate.tableName)
        .select(candidate.eventIdCol)
        .eq(candidate.userIdCol, userId)
    ));

    if (error) {
      if (isEventLikeSchemaError(error)) {
        return res.status(503).json({ error: NOT_INITIALIZED_MESSAGE });
      }
      return res.status(500).json({ error: error.message });
    }

    const eventIdKey = variant?.eventIdCol || 'eventId';
    const eventIds = [...new Set((data || []).map((row) => row?.[eventIdKey]).filter(Boolean))];
    return res.json({ eventIds });
  } catch (err) {
    if (isEventLikeSchemaError(err)) {
      return res.status(503).json({ error: NOT_INITIALIZED_MESSAGE });
    }
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

export const likeEvent = async (req, res) => {
  debugLog(`💚 [Controller] likeEvent triggered for eventId: ${req.params?.id}`);
  try {
    const userId = req.user?.id;
    const requesterEmail = req.user?.email || '';
    const eventId = req.params?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!eventId) return res.status(400).json({ error: 'eventId is required' });

    const exists = await eventExists(eventId);
    if (!exists) return res.status(404).json({ error: 'Event not found' });

    const { error: insertError } = await withEventLikeStore((candidate) => (
      supabase
        .from(candidate.tableName)
        .insert({
          [candidate.eventIdCol]: eventId,
          [candidate.userIdCol]: userId,
        })
    ));

    if (insertError && insertError.code !== '23505') {
      if (isEventLikeSchemaError(insertError)) {
        return res.status(503).json({ error: NOT_INITIALIZED_MESSAGE });
      }
      return res.status(500).json({ error: insertError.message });
    }

    const likeCreated = !insertError;
    let attendeeNotif = null;

    if (likeCreated) {
      try {
        const actor = (await getUserProfileByAuthId(userId)) || {
          userId,
          name: null,
          email: requesterEmail || null,
        };
        const context = await resolveLikeNotificationContext(eventId);

        if (context?.organizerOwnerUserId && String(context.organizerOwnerUserId) !== String(userId)) {
          const actorName = buildDisplayName(actor);
          const message = `${actorName} liked your event "${context.eventName}".`;

          // 1. Notify Organizer (If opted-in)
          const { data: orgData } = await supabase
            .from('organizers')
            .select('emailOptIn')
            .eq('ownerUserId', context.organizerOwnerUserId)
            .maybeSingle();

          if (orgData?.emailOptIn) {
            debugLog(`📡 [Like] Sending notification to Organizer: ${context.organizerOwnerUserId}`);
            const recipientProfile = await getUserProfileByAuthId(context.organizerOwnerUserId);
            await notifyUserByPreference({
              recipientUserId: context.organizerOwnerUserId,
              recipientFallbackEmail: recipientProfile?.email || '',
              actorUserId: userId,
              eventId: context.eventId,
              organizerId: context.organizerId,
              type: 'EVENT_LIKED',
              title: 'Your event was liked',
              message,
              metadata: {
                eventName: context.eventName,
                eventPath: context.eventPath,
                organizerName: context.organizerName || null,
                actorName,
                actorEmail: actor?.email || requesterEmail || null,
                actionLabel: 'VIEW EVENT',
                actionUrl: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL.replace(/\/$/, '')}${context.eventPath}` : null,
              },
              emailSubject: 'Your event was liked',
              emailText: `${message}${context.eventPath ? `\nEvent: ${context.eventPath}` : ''}`,
            });
          } else {
            debugLog(`👤 [Like] Organizer ${context.organizerOwnerUserId} has emailOptIn DISABLED. Skipping organizer email.`);
          }

          // 2. Notify Follower (Attendee - Confirmation Email)
          debugLog(`📡 [Like] Sending "Thank You" email to Liker: ${userId}`);
          attendeeNotif = await notifyUserByPreference({
            recipientUserId: userId,
            recipientFallbackEmail: requesterEmail,
            eventId: context.eventId,
            organizerId: context.organizerId,
            type: 'LIKE_CONFIRMATION',
            title: `Thanks for liking ${context.eventName}!`,
            message: `We're thrilled you're interested in ${context.eventName}. Keep an eye out for updates!`,
            metadata: {
              eventName: context.eventName,
              actionLabel: 'EXPLORE EVENTS',
              actionUrl: process.env.FRONTEND_URL || 'https://events.moonshotdigital.com.ph',
            },
            emailSubject: `Thanks for liking ${context.eventName}!`,
          });
        } else {
          debugLog(`ℹ️ [Like] No notification sent. Reason: ${!likeCreated ? 'Already liked' : 'Self-like or No owner'}`);
        }
      } catch (sideEffectError) {
        console.error('[LikeEvent] Notification side-effect failed:', sideEffectError?.message || sideEffectError);
      }
    }

    const summary = await getEventLikeSummary(eventId, userId);
    return res.json({
      eventId,
      liked: true,
      likesCount: summary.likesCount,
      confirmationEmailSent: !!attendeeNotif?.email
    });
  } catch (err) {
    if (isEventLikeSchemaError(err)) {
      return res.status(503).json({ error: NOT_INITIALIZED_MESSAGE });
    }
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

export const unlikeEvent = async (req, res) => {
  try {
    const userId = req.user?.id;
    const eventId = req.params?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!eventId) return res.status(400).json({ error: 'eventId is required' });

    const exists = await eventExists(eventId);
    if (!exists) return res.status(404).json({ error: 'Event not found' });

    const { error: deleteError } = await withEventLikeStore((candidate) => (
      supabase
        .from(candidate.tableName)
        .delete()
        .eq(candidate.eventIdCol, eventId)
        .eq(candidate.userIdCol, userId)
    ));

    if (deleteError) {
      if (isEventLikeSchemaError(deleteError)) {
        return res.status(503).json({ error: NOT_INITIALIZED_MESSAGE });
      }
      return res.status(500).json({ error: deleteError.message });
    }

    const summary = await getEventLikeSummary(eventId, userId);
    return res.json({
      eventId,
      liked: false,
      likesCount: summary.likesCount,
    });
  } catch (err) {
    if (isEventLikeSchemaError(err)) {
      return res.status(503).json({ error: NOT_INITIALIZED_MESSAGE });
    }
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};
