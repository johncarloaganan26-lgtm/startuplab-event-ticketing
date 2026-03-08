import supabase from '../database/db.js';
import crypto from 'crypto';
import path from 'path';
import { getOrCreateOrganizerForUser, getOrganizerByOwnerUserId } from '../utils/organizerData.js';
import { logAudit } from '../utils/auditLogger.js';
import { checkPlanLimits } from '../utils/planValidator.js';

const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'startuplab-business-ticketing';
const ADMIN_ROLES = ['ADMIN', 'STAFF'];

function slugify(text = '') {
  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '')
    .replace(/\-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function ensureEventOwnership(eventId, userId) {
  const { data: event, error } = await supabase
    .from('events')
    .select('eventId, createdBy, status')
    .eq('eventId', eventId)
    .maybeSingle();

  if (error) return { error, status: 500 };
  if (!event) return { status: 404, message: 'Event not found' };
  if (event.createdBy !== userId) return { status: 403, message: 'Forbidden' };
  return { status: 200, event };
}

function toUpperStatus(value) {
  return String(value || '').trim().toUpperCase();
}

async function resolveOrganizerReadinessForUser(userId) {
  try {
    const organizer = await getOrganizerByOwnerUserId(userId);
    if (!organizer?.organizerId) {
      return {
        ok: false,
        status: 409,
        error: 'Complete your organization profile before creating events.',
        code: 'ORG_PROFILE_REQUIRED',
      };
    }

    const organizerName = String(organizer.organizerName || '').trim();
    if (!organizerName) {
      return {
        ok: false,
        status: 409,
        error: 'Organization profile is incomplete. Add an organization name before creating events.',
        code: 'ORG_PROFILE_INCOMPLETE',
      };
    }

    return { ok: true, organizer };
  } catch (error) {
    return {
      ok: false,
      status: 500,
      error: error?.message || 'Failed to resolve organizer profile',
      code: 'ORG_PROFILE_LOOKUP_FAILED',
    };
  }
}

async function hasTicketTypesConfigured(eventId) {
  const { data, error } = await supabase
    .from('ticketTypes')
    .select('ticketTypeId')
    .eq('eventId', eventId)
    .limit(1);

  if (error) {
    throw error;
  }
  return Array.isArray(data) && data.length > 0;
}

async function resolvePersonalProfileReadiness(userId) {
  const lookupByColumn = async (columnName) => (
    supabase
      .from('users')
      .select('name')
      .eq(columnName, userId)
      .maybeSingle()
  );

  let { data, error } = await lookupByColumn('userId');
  if ((!data && !error) || (error && String(error?.message || '').includes('column "userId"'))) {
    const fallback = await lookupByColumn('id');
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    return {
      ok: false,
      status: 500,
      error: error.message || 'Failed to resolve account profile',
      code: 'USER_PROFILE_LOOKUP_FAILED',
    };
  }

  const profileName = String(data?.name || '').trim();
  if (!profileName) {
    return {
      ok: false,
      status: 409,
      error: 'Complete your personal profile before creating events.',
      code: 'USER_PROFILE_REQUIRED',
    };
  }

  return { ok: true };
}

export const listAdminEvents = async (req, res) => {
  try {
    const search = (req.query?.search || '').toString().trim();

    // 1) Build set of allowed creator IDs based on requester role
    const { data: userRows, error: userErr } = await supabase
      .from('users')
      .select('userId, role, employerId');
    if (userErr) return res.status(500).json({ error: userErr.message });

    const requesterId = req.user?.id;
    const requester = userRows.find((u) => String(u.userId) === String(requesterId));
    const requesterRole = String(requester?.role || req.user?.role || '').toUpperCase();

    const allowedCreatorIds = new Set();

    if (requesterRole === 'STAFF') {
      // Staff sees their own events, events from their employer, and events from organizers they invited
      allowedCreatorIds.add(requesterId);
      if (requester?.employerId) {
        allowedCreatorIds.add(String(requester.employerId));
      }
      for (const u of userRows) {
        const empId = String(u.employerId || '');
        if (empId === String(requesterId)) {
          allowedCreatorIds.add(String(u.userId));
        }
      }
    } else {
      // Default Admin behavior: see all ADMIN and STAFF events
      for (const u of userRows) {
        if (ADMIN_ROLES.includes(String(u.role || '').toUpperCase())) {
          allowedCreatorIds.add(String(u.userId || u.id));
        }
      }
    }

    // 2) Query events and then enforce creator-role filtering in code
    let query = supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`eventName.ilike.%${search}%,locationText.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data: events, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const filtered = (events || []).filter((event) => allowedCreatorIds.has(String(event.createdBy)));
    return res.json(filtered);
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

// ─── USER-SPECIFIC: only events created by the authenticated user ───
export const listUserEvents = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const search = (req.query?.search || '').toString().trim();
    let query = supabase
      .from('events')
      .select('*')
      .eq('createdBy', userId)
      .eq('is_archived', false) // Exclude archived events
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`eventName.ilike.%${search}%,locationText.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

export const createUserEvent = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const profileCheck = await resolvePersonalProfileReadiness(userId);
  if (!profileCheck.ok) {
    return res.status(profileCheck.status).json({ error: profileCheck.error, code: profileCheck.code });
  }

  const organizerCheck = await resolveOrganizerReadinessForUser(userId);
  if (!organizerCheck.ok) {
    return res.status(organizerCheck.status).json({ error: organizerCheck.error, code: organizerCheck.code });
  }

  const requestedStatus = toUpperStatus(req.body?.status);
  if (requestedStatus === 'PUBLISHED') {
    return res.status(422).json({
      error: 'Create the event as Draft first. Add at least one ticket before publishing.',
      code: 'TICKET_REQUIRED_BEFORE_PUBLISH',
    });
  }

  // 1. Check Max Events Limit
  const eventLimit = await checkPlanLimits(organizerCheck.organizer.organizerId, 'max_events');
  if (!eventLimit.allowed) {
    return res.status(403).json({
      error: eventLimit.message,
      code: 'PLAN_LIMIT_REACHED',
      limit: eventLimit.limit,
      current: eventLimit.current
    });
  }

  // 2. Check Capacity Limit
  const capacityTotal = req.body?.capacityTotal ? Number(req.body.capacityTotal) : 0;
  if (capacityTotal > 0) {
    const capacityLimit = await checkPlanLimits(organizerCheck.organizer.organizerId, 'max_attendees_per_event', capacityTotal);
    if (!capacityLimit.allowed) {
      return res.status(403).json({
        error: capacityLimit.message,
        code: 'PLAN_LIMIT_REACHED',
        limit: capacityLimit.limit
      });
    }
  }

  req.enforceExistingOrganizer = true;
  return createEvent(req, res);
};

export const updateUserEvent = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const ownership = await ensureEventOwnership(id, userId);
    if (ownership.status !== 200) {
      if (ownership.error) return res.status(500).json({ error: ownership.error.message });
      return res.status(ownership.status).json({ error: ownership.message });
    }

    // 3. Check Capacity Limit on Update
    const requestedCapacity = req.body?.capacityTotal ? Number(req.body.capacityTotal) : 0;
    if (requestedCapacity > (ownership.event?.capacityTotal || 0)) {
      const organizerCheck = await resolveOrganizerReadinessForUser(userId);
      if (organizerCheck.ok) {
        const capacityLimit = await checkPlanLimits(organizerCheck.organizer.organizerId, 'max_attendees_per_event', requestedCapacity);
        if (!capacityLimit.allowed) {
          return res.status(403).json({
            error: capacityLimit.message,
            code: 'PLAN_LIMIT_REACHED',
            limit: capacityLimit.limit
          });
        }
      }
    }

    const requestedStatus = toUpperStatus(req.body?.status);
    const currentStatus = toUpperStatus(ownership.event?.status);
    const isPublishTransition = requestedStatus === 'PUBLISHED' && currentStatus !== 'PUBLISHED';

    if (isPublishTransition) {
      const organizerCheck = await resolveOrganizerReadinessForUser(userId);
      if (!organizerCheck.ok) {
        return res.status(organizerCheck.status).json({ error: organizerCheck.error, code: organizerCheck.code });
      }

      try {
        const hasTickets = await hasTicketTypesConfigured(id);
        if (!hasTickets) {
          return res.status(422).json({
            error: 'Add at least one ticket type before publishing this event.',
            code: 'TICKET_REQUIRED_BEFORE_PUBLISH',
          });
        }
      } catch (ticketError) {
        return res.status(500).json({ error: ticketError?.message || 'Failed to verify ticket setup' });
      }
    }

    return updateEvent(req, res);
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

export const deleteUserEvent = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const ownership = await ensureEventOwnership(id, userId);
    if (ownership.status !== 200) {
      if (ownership.error) return res.status(500).json({ error: ownership.error.message });
      return res.status(ownership.status).json({ error: ownership.message });
    }

    return deleteEvent(req, res);
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

export const uploadEventImage = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Image file is required' });
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Only image uploads are allowed' });
    }

    const ext = path.extname(file.originalname || '') || '.png';
    const fileName = `${crypto.randomUUID()}${ext}`;
    const filePath = `images/${fileName}`;

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

    const eventId = req.body?.eventId;
    let event = null;
    if (eventId) {
      const { data, error } = await supabase
        .from('events')
        .update({ imageUrl: publicUrl, updated_at: new Date().toISOString() })
        .eq('eventId', eventId)
        .select('*')
        .single();
      if (error) return res.status(500).json({ error: error.message });
      event = data;
    }

    return res.json({ publicUrl, path: filePath, event });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Image upload failed' });
  }
};

export const uploadUserEventImage = async (req, res) => {
  try {
    const userId = req.user?.id;
    const eventId = req.body?.eventId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    if (eventId) {
      const ownership = await ensureEventOwnership(eventId, userId);
      if (ownership.status !== 200) {
        if (ownership.error) return res.status(500).json({ error: ownership.error.message });
        return res.status(ownership.status).json({ error: ownership.message });
      }
    }

    return uploadEventImage(req, res);
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Image upload failed' });
  }
};

export const getAdminEventById = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('eventId', id)
      .single();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Event not found' });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

export const createEvent = async (req, res) => {
  try {
    const {
      eventName,
      slug,
      description,
      startAt,
      endAt,
      timezone,
      locationType,
      locationText,
      capacityTotal,
      regOpenAt,
      regCloseAt,
      status = 'DRAFT',
      imageUrl,
      streamingPlatform,
      streaming_url
    } = req.body || {};

    if (!eventName) return res.status(400).json({ error: 'eventName is required' });

    let organizerId = null;
    const enforceExistingOrganizer = req.enforceExistingOrganizer === true;
    if (req.user?.id) {
      try {
        const organizer = enforceExistingOrganizer
          ? await getOrganizerByOwnerUserId(req.user.id)
          : await getOrCreateOrganizerForUser(req.user.id);
        if (enforceExistingOrganizer && !organizer?.organizerId) {
          return res.status(409).json({
            error: 'Complete your organization profile before creating events.',
            code: 'ORG_PROFILE_REQUIRED',
          });
        }
        organizerId = organizer?.organizerId || null;
      } catch (organizerError) {
        return res.status(500).json({ error: organizerError?.message || 'Failed to resolve organizer profile' });
      }
    }

    const payload = {
      eventName,
      slug: slug && slug.length ? slug : slugify(eventName),
      description: description || null,
      startAt: startAt || null,
      endAt: endAt || null,
      timezone: timezone || null,
      locationType: locationType || null,
      locationText: locationText || null,
      capacityTotal: Number.isFinite(Number(capacityTotal)) ? Number(capacityTotal) : null,
      regOpenAt: regOpenAt || null,
      regCloseAt: regCloseAt || null,
      status,
      imageUrl: imageUrl || null,
      streamingPlatform: streamingPlatform || null,
      streaming_url: streaming_url || null,
      organizerId,
      createdBy: req.user?.id || null,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('events')
      .insert(payload)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });

    await logAudit({
      actionType: 'EVENT_CREATED',
      details: { eventId: data?.eventId, eventName: data?.eventName },
      req
    });

    return res.status(201).json(data);
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

export const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    delete updates.createdBy;
    delete updates.eventId;
    delete updates.created_at;
    delete updates.organizerId;

    if (updates.capacityTotal !== undefined) {
      updates.capacityTotal = Number.isFinite(Number(updates.capacityTotal))
        ? Number(updates.capacityTotal)
        : null;
    }
    if (updates.eventName && !updates.slug) {
      updates.slug = slugify(updates.eventName);
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('events')
      .update(updates)
      .eq('eventId', id)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Event not found' });

    await logAudit({
      actionType: 'EVENT_UPDATED',
      details: { eventId: data?.eventId, eventName: data?.eventName, updates },
      req
    });

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

export const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    // Check if event is already archived
    const { data: existingEvent } = await supabase
      .from('events')
      .select('is_archived, deleted_at')
      .eq('eventId', id)
      .maybeSingle();

    // If already archived, do permanent delete
    if (existingEvent?.is_archived && existingEvent?.deleted_at) {
      // Permanent delete - remove all related data first
      await supabase.from('tickets').delete().eq('eventId', id);
      await supabase.from('ticket_types').delete().eq('eventId', id);
      await supabase.from('orders').delete().eq('eventId', id);
      await supabase.from('event_likes').delete().eq('eventId', id);

      const { error } = await supabase
        .from('events')
        .delete()
        .eq('eventId', id);

      if (error) return res.status(500).json({ error: error.message });

      await logAudit({
        actionType: 'EVENT_PERMANENTLY_DELETED',
        details: { eventId: id },
        req
      });

      return res.status(200).json({ message: 'Event permanently deleted', permanent: true });
    }

    // Soft delete - archive the event
    const { error } = await supabase
      .from('events')
      .update({
        is_archived: true,
        deleted_at: new Date().toISOString(),
        archived_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('eventId', id);

    if (error) return res.status(500).json({ error: error.message });

    await logAudit({
      actionType: 'EVENT_ARCHIVED',
      details: { eventId: id },
      req
    });

    return res.status(200).json({ message: 'Event archived successfully', archived: true });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

export const restoreEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const { data, error } = await supabase
      .from('events')
      .update({
        is_archived: false,
        deleted_at: null,
        archived_by: null,
        updated_at: new Date().toISOString()
      })
      .eq('eventId', id)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Event not found' });

    await logAudit({
      actionType: 'EVENT_RESTORED',
      details: { eventId: id, restoredBy: userId },
      req
    });

    return res.status(200).json({ message: 'Event restored successfully', event: data });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

export const listArchivedEvents = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Get organizer's events that are archived
    const { data: organizer } = await supabase
      .from('organizers')
      .select('organizerId')
      .eq('ownerUserId', userId)
      .maybeSingle();

    let query = supabase
      .from('events')
      .select('*', { count: 'exact' })
      .eq('is_archived', true)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // If user has organizer profile, filter to their events only
    if (organizer?.organizerId) {
      query = query.eq('organizerId', organizer.organizerId);
    }

    const { data, error, count } = await query;

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({
      events: data || [],
      total: count || 0,
      page: Number(page),
      limit: Number(limit)
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

export const publishEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('events')
      .update({ status: 'PUBLISHED', updated_at: new Date().toISOString() })
      .eq('eventId', id)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Event not found' });

    await logAudit({
      actionType: 'EVENT_PUBLISHED',
      details: { eventId: data?.eventId, eventName: data?.eventName },
      req
    });

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

export const closeEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('events')
      .update({ status: 'CLOSED', updated_at: new Date().toISOString() })
      .eq('eventId', id)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Event not found' });

    await logAudit({
      actionType: 'EVENT_CLOSED',
      details: { eventId: data?.eventId, eventName: data?.eventName },
      req
    });

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};
