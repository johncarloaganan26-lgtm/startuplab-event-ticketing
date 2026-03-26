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
      brandColor: req.body?.brandColor || null,
      isOnboarded: normalizeBoolean(req.body?.isOnboarded, existing?.isOnboarded || false),
      coverImageUrl: normalizeTrimmed(req.body?.coverImageUrl) || existing?.coverImageUrl || null,
      updated_at: new Date().toISOString(),
    };

    // --- CHECK BRANDING LIMIT ---
    const canCustomBrand = !!(existing?.plan?.features?.enable_custom_branding || existing?.plan?.features?.custom_branding);
    if (req.body?.brandColor && !canCustomBrand) {
      // If they try to set a color but don't have the feature, we just ignore it or set to default
      delete payload.brandColor;
    }

    if (req.body?.profileImageUrl !== undefined) {
      payload.profileImageUrl = normalizeTrimmed(req.body?.profileImageUrl);
    }

    const userSelect = await (async () => {
      let resp = await supabase.from('users').select('name, imageUrl').eq('userId', ownerUserId).maybeSingle();
      if (resp.error && resp.error.message?.includes('userId')) {
        resp = await supabase.from('users').select('name, imageUrl').eq('id', ownerUserId).maybeSingle();
      }
      return resp;
    })();
    const userData = userSelect.data;

    if (existing?.organizerId) {
      const { data, error } = await supabase
        .from('organizers')
        .update(payload)
        .eq('organizerId', existing.organizerId)
        .select('*')
        .single();
      if (error) return res.status(500).json({ error: error.message });
      
      if (data && data.organizerId && userData) {
        const updates = {};
        if (data.organizerName && !userData.name) updates.name = data.organizerName;
        if (data.profileImageUrl && !userData.imageUrl) updates.imageUrl = data.profileImageUrl;
        
        if (Object.keys(updates).length > 0) {
          let userUpdate = await supabase.from('users').update(updates).eq('userId', ownerUserId);
          if (userUpdate.error && userUpdate.error.message?.includes('userId')) {
            await supabase.from('users').update(updates).eq('id', ownerUserId);
          }
        }
      }

      // Ensure plan is attached for frontend consistency
      if (data && !data.plan && data.currentPlanId) {
        const { data: planData } = await supabase
          .from('plans')
          .select('*')
          .eq('planId', data.currentPlanId)
          .maybeSingle();
        data.plan = planData;
      } else if (data && !data.plan && existing?.plan) {
        data.plan = existing.plan;
      }

      await logAudit({
        actionType: 'ORGANIZER_UPDATED',
        details: { organizerId: data?.organizerId, organizerName: data?.organizerName },
        req
      });

      const counts = await getEventsHostedCounts([data.organizerId]);
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

    // Sync to users table for new organizers too, only if missing
    if (data && userData) {
      const updates = {};
      if (data.organizerName && !userData.name) updates.name = data.organizerName;
      if (data.profileImageUrl && !userData.imageUrl) updates.imageUrl = data.profileImageUrl;
      
      if (Object.keys(updates).length > 0) {
        let userUpdate = await supabase.from('users').update(updates).eq('userId', ownerUserId);
        if (userUpdate.error && userUpdate.error.message?.includes('userId')) {
          await supabase.from('users').update(updates).eq('id', ownerUserId);
        }
      }
    }

    // Ensure plan is attached for frontend consistency
    if (data && !data.plan && data.currentPlanId) {
      const { data: planData } = await supabase
        .from('plans')
        .select('*')
        .eq('planId', data.currentPlanId)
        .maybeSingle();
      data.plan = planData;
    }

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

    return res.json({
      publicUrl,
      path: filePath,
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

export const uploadOrganizerCoverImage = async (req, res) => {
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
    const fileName = `${ownerUserId}/cover_${crypto.randomUUID()}${ext}`;
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

    return res.json({
      publicUrl,
      path: filePath,
    });
  } catch (err) {
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

          // 1. Notify Organizer
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
            emailEnabledOverride: !!organizer?.emailOptIn,
          });

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

        // 1. Notify Organizer
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
          emailEnabledOverride: !!organizer?.emailOptIn,
        });

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
    // Fetch with plan join
    let { data: organizers, error } = await supabase
      .from('organizers')
      .select('*, plan:plans(*)')
      .order('followersCount', { ascending: false });

    if (error && error.code === 'PGRST200') {
      const fallback = await supabase
        .from('organizers')
        .select('*')
        .order('followersCount', { ascending: false });
      organizers = fallback.data;
      error = fallback.error;
    }

    if (error) return res.status(500).json({ error: error.message });

    const organizerIds = (organizers || []).map(o => o.organizerId);
    const [counts, followerProfilesMap] = await Promise.all([
      getEventsHostedCounts(organizerIds),
      getFollowerProfiles(organizerIds)
    ]);

    // If joins were missing or failed, fetch plans separately for all
    const planIds = [...new Set((organizers || []).map(o => o.currentPlanId).filter(Boolean))];
    if (planIds.length > 0 && (organizers || []).some(o => !o.plan)) {
      const { data: plans } = await supabase
        .from('plans')
        .select('*')
        .in('planId', planIds);
      
      const planMap = new Map((plans || []).map(p => [p.planId, p]));
      organizers.forEach(o => {
        if (!o.plan && o.currentPlanId) {
          o.plan = planMap.get(o.currentPlanId);
        }
      });
    }

    const serialized = (organizers || []).map(o => {
      const recent = followerProfilesMap.get(o.organizerId) || [];
      return serializeOrganizerRecord(o, counts.get(o.organizerId) || 0, recent);
    });

    return res.json(serialized);
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

async function getFollowerProfiles(organizerIds) {
  const profileMap = new Map();
  if (!organizerIds || organizerIds.length === 0) return profileMap;

  // 1. Fetch recent follower records
  const { data, error, variant } = await withFollowersStore(async (candidate) => {
    return supabase
      .from(candidate.tableName)
      .select(`${candidate.organizerIdCol}, ${candidate.followerUserIdCol}`)
      .in(candidate.organizerIdCol, organizerIds)
      .order('created_at', { ascending: false });
  });

  if (error || !data) return profileMap;

  const orgIdKey = variant?.organizerIdCol || 'organizerId';
  const userIdKey = variant?.followerUserIdCol || 'followerUserId';

  // 2. Identify up to 3 unique user IDs per organizer
  const allUserIds = new Set();
  const orgToUserIds = new Map();
  
  for (const row of data) {
    const orgId = row[orgIdKey];
    const userId = row[userIdKey];
    if (!orgId || !userId) continue;

    if (!orgToUserIds.has(orgId)) orgToUserIds.set(orgId, []);
    const list = orgToUserIds.get(orgId);
    if (list.length < 3) {
      list.push(userId);
      allUserIds.add(userId);
    }
  }

  if (allUserIds.size === 0) return profileMap;

  // 3. Fetch user profile info (name, imageUrl) for all identified users
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('userId, name, imageUrl')
    .in('userId', Array.from(allUserIds));

  if (userError || !userData) return profileMap;

  const userProfileMap = new Map(userData.map(u => [u.userId, u]));

  // 4. Map profiles back to organizers
  for (const [orgId, userIds] of orgToUserIds.entries()) {
    const profiles = userIds
      .map(id => userProfileMap.get(id))
      .filter(Boolean)
      .map(u => ({
        userId: u.userId,
        name: u.name,
        imageUrl: u.imageUrl
      }));
    profileMap.set(orgId, profiles);
  }

  return profileMap;
}

export const getEmailQuotaStatus = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Import emailQuotaManager
    const emailQuotaManager = (await import('../utils/emailQuotaManager.js')).default;

    // Get organizer associated with this user
    const organizer = await getOrganizerByOwnerUserId(userId);
    if (!organizer) {
      return res.status(404).json({ error: 'Organizer not found' });
    }

    // Get quota status
    const quotaStatus = await emailQuotaManager.getQuotaStatus(organizer.organizerId);

    return res.json({
      remaining: quotaStatus.remaining,
      limit: quotaStatus.limit,
      sent: quotaStatus.sent,
      canSend: quotaStatus.canSend,
      quotaStatus: quotaStatus.quotaStatus,
    });
  } catch (err) {
    console.error('Error fetching email quota status:', err);
    return res.status(500).json({ error: err?.message || 'Failed to fetch email quota status' });
  }
};
