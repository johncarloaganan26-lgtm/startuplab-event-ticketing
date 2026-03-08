import crypto from 'crypto';
import path from 'path';
import supabase from '../database/db.js';
import { logAudit } from '../utils/auditLogger.js';
import {
  getOrganizerByOwnerUserId,
  getOrganizerWithStatsById,
  serializeOrganizerRecord,
  getEventsHostedCounts,
  isOrganizerTableMissingError,
  isMissingColumnError,
  isMissingRelationError,
} from '../utils/organizerData.js';
import {
  getUserProfileByAuthId,
  buildDisplayName,
  notifyUserByPreference,
  notifyTeamByPreference,
  debugLog,
} from '../utils/notificationService.js';

const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'startuplab-business-ticketing';
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);
const FOLLOWERS_STORE_VARIANTS = [
  { tableName: 'organizerFollowers', organizerIdCol: 'organizerId', followerUserIdCol: 'followerUserId' },
  { tableName: 'organizerfollowers', organizerIdCol: 'organizerId', followerUserIdCol: 'followerUserId' },
  { tableName: 'organizerfollowers', organizerIdCol: 'organizerid', followerUserIdCol: 'followeruserid' },
  { tableName: 'organizerFollowers', organizerIdCol: 'organizerid', followerUserIdCol: 'followeruserid' },
];

function normalizeTrimmed(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized.length ? normalized : null;
}

function sanitizePlainText(value, { maxLength = 2000, field = 'field' } = {}) {
  const normalized = normalizeTrimmed(value);
  if (!normalized) return null;

  const hasHtmlLikeContent = /<\/?[a-z][\s\S]*>/i.test(normalized);
  if (hasHtmlLikeContent) {
    throw new Error(`${field} must be plain text only`);
  }
  return normalized.slice(0, maxLength);
}

function normalizeWebsiteUrl(value) {
  const normalized = normalizeTrimmed(value);
  if (!normalized) return null;

  const withProtocol = /^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`;
  const parsed = new URL(withProtocol);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('websiteUrl must use http or https');
  }
  return parsed.toString();
}

function normalizeFacebookId(value) {
  const normalized = normalizeTrimmed(value);
  if (!normalized) return null;

  return normalized
    .replace(/^https?:\/\/(www\.)?facebook\.com\//i, '')
    .replace(/\?.*$/, '')
    .replace(/^@/, '')
    .slice(0, 120);
}

function normalizeTwitterHandle(value) {
  const normalized = normalizeTrimmed(value);
  if (!normalized) return null;

  return normalized
    .replace(/^https?:\/\/(www\.)?(twitter\.com|x\.com)\//i, '')
    .replace(/\?.*$/, '')
    .replace(/^@/, '')
    .slice(0, 80);
}

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
}

function isFollowersStoreSchemaError(error) {
  if (!error) return false;
  return (
    isMissingRelationError(error, 'organizerFollowers') ||
    isMissingRelationError(error, 'organizerfollowers') ||
    isMissingColumnError(error, 'organizerId') ||
    isMissingColumnError(error, 'followerUserId') ||
    isMissingColumnError(error, 'organizerid') ||
    isMissingColumnError(error, 'followeruserid')
  );
}

async function withFollowersStore(operation) {
  let lastSchemaError = null;

  for (const variant of FOLLOWERS_STORE_VARIANTS) {
    const response = await operation(variant);
    if (!response?.error) {
      return { ...response, variant };
    }
    if (isFollowersStoreSchemaError(response.error)) {
      lastSchemaError = response.error;
      continue;
    }
    return { ...response, variant };
  }

  return {
    data: null,
    error: lastSchemaError || { message: 'Organizer follow storage is not initialized' },
    variant: null,
  };
}

async function syncFollowersCount(organizerId) {
  const { data: followerRows, error: listError } = await withFollowersStore((variant) => (
    supabase
      .from(variant.tableName)
      .select(variant.organizerIdCol)
      .eq(variant.organizerIdCol, organizerId)
  ));
  if (listError) throw listError;

  const followersCount = (followerRows || []).length;
  const { error: updateError } = await supabase
    .from('organizers')
    .update({ followersCount, updated_at: new Date().toISOString() })
    .eq('organizerId', organizerId);

  if (updateError) throw updateError;
  return followersCount;
}

async function adjustFollowersCountFallback(organizerId, delta) {
  const { data: organizerRow, error: organizerError } = await supabase
    .from('organizers')
    .select('followersCount')
    .eq('organizerId', organizerId)
    .maybeSingle();
  if (organizerError) throw organizerError;
  if (!organizerRow) throw new Error('Organizer not found');

  const current = Number(organizerRow.followersCount || 0);
  const next = Math.max(0, current + Number(delta || 0));

  const { error: updateError } = await supabase
    .from('organizers')
    .update({ followersCount: next, updated_at: new Date().toISOString() })
    .eq('organizerId', organizerId);
  if (updateError) throw updateError;
  return next;
}

export const upsertOrganizer = async (req, res) => {
  try {
    const ownerUserId = req.user?.id;
    if (!ownerUserId) return res.status(401).json({ error: 'Unauthorized' });

    const inputOrganizerName = sanitizePlainText(req.body?.organizerName, {
      maxLength: 140,
      field: 'organizerName',
    });

    const existing = await getOrganizerByOwnerUserId(ownerUserId);
    const fallbackName =
      existing?.organizerName ||
      (req.user?.email ? String(req.user.email).split('@')[0] : null) ||
      'Organizer';
    const organizerName = inputOrganizerName || fallbackName;

    const payload = {
      organizerName,
      websiteUrl: normalizeWebsiteUrl(req.body?.websiteUrl),
      bio: sanitizePlainText(req.body?.bio, { maxLength: 4000, field: 'bio' }),
      eventPageDescription: sanitizePlainText(req.body?.eventPageDescription, {
        maxLength: 280,
        field: 'eventPageDescription',
      }),
      facebookId: normalizeFacebookId(req.body?.facebookId),
      twitterHandle: normalizeTwitterHandle(req.body?.twitterHandle),
      emailOptIn: normalizeBoolean(req.body?.emailOptIn, false),
      updated_at: new Date().toISOString(),
    };

    if (req.body?.profileImageUrl !== undefined) {
      payload.profileImageUrl = normalizeTrimmed(req.body?.profileImageUrl);
    }

    if (existing?.organizerId) {
      const { data, error } = await supabase
        .from('organizers')
        .update(payload)
        .eq('organizerId', existing.organizerId)
        .select('*')
        .single();

      if (error) return res.status(500).json({ error: error.message });

      const counts = await getEventsHostedCounts([data.organizerId]);

      await logAudit({
        actionType: 'ORGANIZER_UPDATED',
        details: { organizerId: data?.organizerId, organizerName: data?.organizerName },
        req
      });

      return res.json(serializeOrganizerRecord(data, counts.get(data.organizerId) || 0));
    }

    const { data, error } = await supabase
      .from('organizers')
      .insert({
        ownerUserId,
        followersCount: 0,
        ...payload,
      })
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    const counts = await getEventsHostedCounts([data.organizerId]);

    await logAudit({
      actionType: 'ORGANIZER_CREATED',
      details: { organizerId: data?.organizerId, organizerName: data?.organizerName },
      req
    });

    return res.status(201).json(serializeOrganizerRecord(data, counts.get(data.organizerId) || 0));
  } catch (err) {
    if (isOrganizerTableMissingError(err)) {
      return res.status(503).json({
        error: 'Organizer feature is not initialized. Run backend/database/organizers.sql first.',
      });
    }
    if (err instanceof TypeError || err?.message?.includes('Invalid URL')) {
      return res.status(400).json({ error: 'websiteUrl must be a valid URL' });
    }
    if (err?.message?.includes('plain text only')) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

export const getMyOrganizer = async (req, res) => {
  try {
    const authUserId = req.user?.id;
    if (!authUserId) return res.status(401).json({ error: 'Unauthorized' });

    // 1) Direct owner match (organizer account)
    let organizer = await getOrganizerByOwnerUserId(authUserId);

    // 2) Team/staff fallback: resolve employerId -> organizer owner profile
    if (!organizer) {
      let userRow = null;
      let userErr = null;

      let userResp = await supabase
        .from('users')
        .select('employerId')
        .eq('userId', authUserId)
        .maybeSingle();
      userRow = userResp.data;
      userErr = userResp.error;

      if ((!userRow && !userErr) || (userErr && isMissingColumnError(userErr, 'userId'))) {
        userResp = await supabase
          .from('users')
          .select('employerId')
          .eq('userId', authUserId)
          .maybeSingle();
        userRow = userResp.data;
        userErr = userResp.error;
      }

      if (userErr && isMissingColumnError(userErr, 'employerId')) {
        userResp = await supabase
          .from('users')
          .select('*')
          .eq('userId', authUserId)
          .maybeSingle();
        userRow = userResp.data;
        userErr = userResp.error;

        if ((!userRow && !userErr) || (userErr && isMissingColumnError(userErr, 'userId'))) {
          userResp = await supabase
            .from('users')
            .select('*')
            .eq('userId', authUserId)
            .maybeSingle();
          userRow = userResp.data;
          userErr = userResp.error;
        }
      }

      if (userErr) return res.status(500).json({ error: userErr.message });

      const employerOwnerUserId = userRow?.employerId || userRow?.employerid || null;
      if (employerOwnerUserId) {
        organizer = await getOrganizerByOwnerUserId(employerOwnerUserId);
      }
    }

    if (!organizer) return res.status(404).json({ error: 'Organizer profile not found' });

    return res.json(organizer);
  } catch (err) {
    if (isOrganizerTableMissingError(err)) {
      return res.status(404).json({ error: 'Organizer profile not found' });
    }
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

export const getOrganizerById = async (req, res) => {
  try {
    const { id } = req.params;
    const organizer = await getOrganizerWithStatsById(id);
    if (!organizer) return res.status(404).json({ error: 'Organizer not found' });
    return res.json(organizer);
  } catch (err) {
    if (isOrganizerTableMissingError(err)) {
      return res.status(404).json({ error: 'Organizer not found' });
    }
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

export const uploadOrganizerImage = async (req, res) => {
  try {
    const ownerUserId = req.user?.id;
    const file = req.file;

    if (!ownerUserId) return res.status(401).json({ error: 'Unauthorized' });
    if (!file) return res.status(400).json({ error: 'Image file is required' });
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype || '')) {
      return res.status(400).json({ error: 'Only JPEG and PNG images are allowed' });
    }
    if (file.size > MAX_IMAGE_SIZE) {
      return res.status(400).json({ error: 'Image must be 10MB or smaller' });
    }

    const extFromName = path.extname(file.originalname || '').toLowerCase();
    const ext = extFromName === '.png' ? '.png' : '.jpg';
    const fileName = `${ownerUserId}/${crypto.randomUUID()}${ext}`;
    const filePath = `organizers/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) return res.status(500).json({ error: uploadError.message });

    const { data: publicData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
    const publicUrl = publicData?.publicUrl;
    if (!publicUrl) return res.status(500).json({ error: 'Failed to generate public URL' });

    // Keep this endpoint useful by updating profileImageUrl when profile already exists.
    const existing = await getOrganizerByOwnerUserId(ownerUserId);
    let organizer = existing;

    if (existing?.organizerId) {
      const { data, error } = await supabase
        .from('organizers')
        .update({ profileImageUrl: publicUrl, updated_at: new Date().toISOString() })
        .eq('organizerId', existing.organizerId)
        .select('*')
        .single();

      if (error) return res.status(500).json({ error: error.message });
      const counts = await getEventsHostedCounts([data.organizerId]);
      organizer = serializeOrganizerRecord(data, counts.get(data.organizerId) || 0);
    }

    return res.json({
      publicUrl,
      path: filePath,
      organizer,
    });
  } catch (err) {
    if (isOrganizerTableMissingError(err)) {
      return res.status(503).json({
        error: 'Organizer feature is not initialized. Run backend/database/organizers.sql first.',
      });
    }
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

export const getMyFollowings = async (req, res) => {
  try {
    const followerUserId = req.user?.id;
    if (!followerUserId) return res.status(401).json({ error: 'Unauthorized' });

    const { data, error, variant } = await withFollowersStore((candidate) => (
      supabase
        .from(candidate.tableName)
        .select(candidate.organizerIdCol)
        .eq(candidate.followerUserIdCol, followerUserId)
    ));

    if (error) {
      if (isFollowersStoreSchemaError(error)) {
        return res.json({ organizerIds: [] });
      }
      return res.status(500).json({ error: error.message });
    }

    const organizerIdKey = variant?.organizerIdCol || 'organizerId';
    const organizerIds = [...new Set((data || []).map((row) => row?.[organizerIdKey]).filter(Boolean))];
    return res.json({ organizerIds });
  } catch (err) {
    if (isOrganizerTableMissingError(err) || isFollowersStoreSchemaError(err)) {
      return res.json({ organizerIds: [] });
    }
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

export const followOrganizer = async (req, res) => {
  debugLog(`💙 [Controller] followOrganizer triggered for organizerId: ${req.params?.id}`);
  try {
    const followerUserId = req.user?.id;
    const followerEmail = req.user?.email || '';
    const organizerId = req.params?.id;
    if (!followerUserId) return res.status(401).json({ error: 'Unauthorized' });
    if (!organizerId) return res.status(400).json({ error: 'organizerId is required' });

    debugLog('👤 [Follow] Fetching organizer data...');
    const { data: organizer, error: organizerError } = await supabase
      .from('organizers')
      .select('organizerId, ownerUserId, organizerName, emailOptIn')
      .eq('organizerId', organizerId)
      .maybeSingle();

    debugLog(`👤 [Follow] Organizer Fetch Result: ${organizer ? 'FOUND' : 'NOT FOUND'}, Error: ${organizerError?.message || 'NONE'}`);

    if (organizerError) return res.status(500).json({ error: organizerError.message });
    if (!organizer) return res.status(404).json({ error: 'Organizer not found' });

    debugLog('👤 [Follow] Checking/Inserting follow record...');
    const { error: followError, variant } = await withFollowersStore((candidate) => (
      supabase
        .from(candidate.tableName)
        .insert({
          [candidate.organizerIdCol]: organizerId,
          [candidate.followerUserIdCol]: followerUserId,
        })
    ));
    debugLog(`👤 [Follow] Follow Record Result: Error=${followError?.message || 'NONE'}, Code=${followError?.code || 'NONE'}, Variant=${variant?.tableName || 'NONE'}`);

    if (followError && followError.code !== '23505') {
      if (isFollowersStoreSchemaError(followError)) {
        const followersCount = await adjustFollowersCountFallback(organizerId, 1);
        return res.json({
          organizerId,
          following: true,
          followersCount,
          confirmationEmailSent: false
        });
      }
      return res.status(500).json({ error: followError.message });
    }

    const followCreated = !followError;
    let attendeeNotif = null;

    debugLog(`👤 [Follow] Action: followCreated=${followCreated}, organizerId=${organizerId}`);

    if (!variant) {
      const followersCount = await adjustFollowersCountFallback(organizerId, 1);

      if (followCreated && organizer?.ownerUserId) {
        try {
          const actor = (await getUserProfileByAuthId(followerUserId)) || {
            userId: followerUserId,
            name: null,
            email: followerEmail || null,
          };
          const actorName = buildDisplayName(actor);
          const organizerLabel = organizer.organizerName || 'your organization';

          // 1. Notify Organizer (If opted-in)
          if (organizer?.emailOptIn) {
            console.log(`📡 [Follow] Sending notification to Organizer: ${organizer.ownerUserId}`);
            const message = `${actorName} followed your organization "${organizerLabel}".`;
            await notifyTeamByPreference({
              recipientUserId: organizer.ownerUserId,
              actorUserId: followerUserId,
              organizerId: organizer.organizerId,
              type: 'ORGANIZER_FOLLOWED',
              title: 'Your organization has a new follower',
              message,
              metadata: {
                organizerName: organizerLabel,
                actorName,
                actorEmail: actor?.email || followerEmail || null,
                actionLabel: 'VIEW ORGANIZATION',
                actionUrl: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL.replace(/\/$/, '')}/organizer/${organizer.organizerId}` : null,
                eventName: organizerLabel,
              },
              emailSubject: 'Your organization has a new follower',
              emailText: message,
            });
          } else {
            console.log(`👤 [Follow] Organizer ${organizer.organizerId} has emailOptIn DISABLED. Skipping organizer email.`);
          }

          // 2. Notify Follower (Attendee - Confirmation Email)
          const welcomeMessage = `Thanks for following ${organizerLabel}! You'll stay updated on their latest events.`;
          attendeeNotif = await notifyUserByPreference({
            recipientUserId: followerUserId,
            recipientFallbackEmail: followerEmail,
            organizerId: organizer.organizerId,
            type: 'FOLLOW_CONFIRMATION',
            title: `You are now following ${organizerLabel}`,
            message: welcomeMessage,
            metadata: {
              organizerName: organizerLabel,
              actionLabel: 'EXPLORE EVENTS',
              actionUrl: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL.replace(/\/$/, '')}/events` : null,
              eventName: organizerLabel,
            },
            emailSubject: `You are now following ${organizerLabel}`,
            emailText: welcomeMessage,
          });
        } catch (sideEffectError) {
          console.error('[FollowOrganizer] Notification side-effect failed:', sideEffectError?.message || sideEffectError);
        }
      } else {
        console.log(`ℹ️ [Follow] No notification side-effects for !variant. Reason: ${!followCreated ? 'Already following' : 'No owner ID'}`);
      }

      return res.json({
        organizerId,
        following: true,
        followersCount,
        confirmationEmailSent: !!attendeeNotif?.email
      });
    }

    const followersCount = await syncFollowersCount(organizerId);

    debugLog(`👤 [Follow] syncFollowersCount result: ${followersCount}`);

    if (followCreated && organizer?.ownerUserId) {
      try {
        const actor = (await getUserProfileByAuthId(followerUserId)) || {
          userId: followerUserId,
          name: null,
          email: followerEmail || null,
        };
        const actorName = buildDisplayName(actor);
        const organizerLabel = organizer.organizerName || 'your organization';

        // 1. Notify Organizer (If opted-in)
        if (organizer?.emailOptIn) {
          console.log(`📡 [Follow] Sending notification to Organizer: ${organizer.ownerUserId}`);
          const message = `${actorName} followed your organization "${organizerLabel}".`;
          await notifyTeamByPreference({
            recipientUserId: organizer.ownerUserId,
            actorUserId: followerUserId,
            organizerId: organizer.organizerId,
            type: 'ORGANIZER_FOLLOWED',
            title: 'Your organization has a new follower',
            message,
            metadata: {
              organizerName: organizerLabel,
              actorName,
              actorEmail: actor?.email || followerEmail || null,
              actionLabel: 'VIEW ORGANIZATION',
              actionUrl: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL.replace(/\/$/, '')}/organizer/${organizer.organizerId}` : null,
              eventName: organizerLabel,
            },
            emailSubject: 'Your organization has a new follower',
            emailText: message,
          });
        } else {
          console.log(`👤 [Follow] Organizer ${organizer.organizerId} has emailOptIn DISABLED. Skipping organizer email.`);
        }

        // 2. Notify Follower (Attendee - Confirmation Email)
        const welcomeMessage = `Thanks for following ${organizerLabel}! You'll stay updated on their latest events.`;
        attendeeNotif = await notifyUserByPreference({
          recipientUserId: followerUserId,
          recipientFallbackEmail: followerEmail,
          organizerId: organizer.organizerId,
          type: 'FOLLOW_CONFIRMATION',
          title: `You are now following ${organizerLabel}`,
          message: welcomeMessage,
          metadata: {
            organizerName: organizerLabel,
            actionLabel: 'EXPLORE EVENTS',
            actionUrl: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL.replace(/\/$/, '')}/events` : null,
            eventName: organizerLabel,
          },
          emailSubject: `You are now following ${organizerLabel}`,
          emailText: welcomeMessage,
        });
      } catch (sideEffectError) {
        console.error('[FollowOrganizer] Notification side-effect failed:', sideEffectError?.message || sideEffectError);
      }
    } else {
      console.log(`ℹ️ [Follow] No notification side-effects. Reason: ${!followCreated ? 'Already following' : 'No owner ID'}`);
    }

    return res.json({
      organizerId,
      following: true,
      followersCount,
      confirmationEmailSent: !!attendeeNotif?.email
    });
  } catch (err) {
    if (isOrganizerTableMissingError(err) || isFollowersStoreSchemaError(err)) {
      return res.status(500).json({ error: 'Unable to follow organizer with current schema' });
    }
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

export const unfollowOrganizer = async (req, res) => {
  try {
    const followerUserId = req.user?.id;
    const organizerId = req.params?.id;
    if (!followerUserId) return res.status(401).json({ error: 'Unauthorized' });
    if (!organizerId) return res.status(400).json({ error: 'organizerId is required' });

    const { error: deleteError } = await withFollowersStore((candidate) => (
      supabase
        .from(candidate.tableName)
        .delete()
        .eq(candidate.organizerIdCol, organizerId)
        .eq(candidate.followerUserIdCol, followerUserId)
    ));

    if (deleteError) {
      if (isFollowersStoreSchemaError(deleteError)) {
        const followersCount = await adjustFollowersCountFallback(organizerId, -1);
        return res.json({
          organizerId,
          following: false,
          followersCount,
        });
      }
      return res.status(500).json({ error: deleteError.message });
    }

    const followersCount = await syncFollowersCount(organizerId);
    return res.json({
      organizerId,
      following: false,
      followersCount,
    });
  } catch (err) {
    if (isOrganizerTableMissingError(err) || isFollowersStoreSchemaError(err)) {
      return res.status(500).json({ error: 'Unable to unfollow organizer with current schema' });
    }
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

export const getAllOrganizers = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('organizers')
      .select('*')
      .order('followersCount', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const counts = await getEventsHostedCounts((data || []).map(o => o.organizerId));
    const serialized = (data || []).map(o => serializeOrganizerRecord(o, counts.get(o.organizerId) || 0));

    return res.json(serialized);
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};
