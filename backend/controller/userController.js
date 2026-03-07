import db from "../database/db.js";
import crypto from 'crypto';
import path from 'path';
import { logAudit } from '../utils/auditLogger.js';

const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'startuplab-business-ticketing';

const normalizeRole = (role) => {
  const normalized = String(role || '').toUpperCase();
  if (normalized === 'USER') return 'ORGANIZER';
  return normalized;
};

export const updateUserAvatar = async (req, res) => {
  try {
    const userId = req.user?.id;
    const file = req.file;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!file) return res.status(400).json({ error: 'Image file is required' });
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Only image uploads are allowed' });
    }

    const ext = path.extname(file.originalname || '') || '.png';
    const fileName = `${userId}/${crypto.randomUUID()}${ext}`;
    const filePath = `avatars/${fileName}`;

    const { error: uploadError } = await db.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) return res.status(500).json({ error: uploadError.message });

    const { data: publicData } = db.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
    const imageUrl = publicData?.publicUrl;
    if (!imageUrl) return res.status(500).json({ error: 'Failed to generate public URL' });

    let { data, error } = await db
      .from('users')
      .update({ imageUrl })
      .eq('userId', userId)
      .select('userId, name, email, role, imageUrl')
      .maybeSingle();

    if ((!data && !error) || (error && error.message?.includes('column "userId"'))) {
      const resp = await db
        .from('users')
        .update({ imageUrl })
        .eq('userId', userId)
        .select('id, name, email, role, imageUrl')
        .maybeSingle();
      data = resp.data; error = resp.error;
    }

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'User not found' });
    return res.json({ imageUrl, user: data, path: filePath });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export const getUser = async (req, res) => {
  try {
    console.log("hi")
  } catch (error) {
    console.log(error)
  }
}

export const updateUserName = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { name } = req.body;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' });
    }
    // Try userId column first
    let { data, error } = await db
      .from('users')
      .update({ name })
      .eq('userId', userId)
      .select('userId, name, email, role, imageUrl')
      .maybeSingle();
    // Fallback to id
    if ((!data && !error) || (error && error.message?.includes('column "userId"'))) {
      const resp = await db
        .from('users')
        .update({ name })
        .eq('userId', userId)
        .select('id, name, email, role, imageUrl')
        .maybeSingle();
      data = resp.data; error = resp.error;
    }
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'User not found' });
    return res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export const getRole = async (req, res) => {
  try {
    const userId = req.user?.id;
    const email = String(req.user?.email || '').toLowerCase().trim();
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    let data = null;
    let error = null;

    const byUserId = await db
      .from('users')
      .select('role')
      .eq('userId', userId)
      .maybeSingle();
    data = byUserId.data;
    error = byUserId.error;

    // Fallback to email when auth userId and users.userId drift.
    if (!data && !error && email) {
      const byEmail = await db
        .from('users')
        .select('role')
        .eq('email', email)
        .maybeSingle();
      data = byEmail.data;
      error = byEmail.error;
    }

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'User not found' });

    // Return as an array to maintain compatibility with front-end which expects data?.[0]?.role
    return res.json([{ role: normalizeRole(data.role) }]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export const whoAmI = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Attempt by userId column first
    let data = null;
    let error = null;
    let resp = await db
      .from('users')
      .select("userId, name, email, role, imageUrl, canviewevents, caneditevents, canmanualcheckin")
      .eq("userId", userId)
      .maybeSingle();
    data = resp.data; error = resp.error;

    // Fallback: some schemas use id instead of userId
    if ((!data && !error) || (error && error.message?.includes('column "userId"'))) {
      resp = await db
        .from('users')
        .select("id, name, email, role, imageUrl, canviewevents, caneditevents, canmanualcheckin")
        .eq("id", userId)
        .maybeSingle();
      data = resp.data; error = resp.error;
    }

    // If permission columns missing, fallback to select minimal with userId
    if (error && error.message?.includes('column')) {
      resp = await db
        .from('users')
        .select("*")
        .eq('userId', userId)
        .maybeSingle();
      data = resp.data; error = resp.error;
    }
    // Fallback with id for minimal select
    if ((!data && !error) || (error && error.message?.includes('column'))) {
      resp = await db
        .from('users')
        .select("*")
        .eq('userId', userId)
        .maybeSingle();
      data = resp.data; error = resp.error;
    }

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'User not found' });

    const role = normalizeRole(data.role);
    const defaultStaff = role === 'STAFF';
    // Normalize response with permissive defaults for staff unless explicitly false
    return res.json({
      userId: data.userId || data.id,
      name: data.name,
      email: data.email,
      role,
      imageUrl: data.imageUrl,
      canViewEvents: data.canviewevents === undefined || data.canviewevents === null ? defaultStaff : !!data.canviewevents,
      canEditEvents: data.caneditevents === undefined || data.caneditevents === null ? defaultStaff : !!data.caneditevents,
      canManualCheckIn: data.canmanualcheckin === undefined || data.canmanualcheckin === null ? defaultStaff : !!data.canmanualcheckin,
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export const getAllUsers = async (req, res) => {
  try {
    let requesterRole = normalizeRole(req.user?.role || '');
    const requesterId = req.user?.id;
    const requesterEmail = String(req.user?.email || '').toLowerCase().trim();
    const teamOnlyRequested = String(req.query.teamOnly || '').toLowerCase() === 'true';

    if (requesterRole !== 'ADMIN' && requesterRole !== 'ORGANIZER') {
      // Look up role in DB using userId/id/email when token role is generic (e.g. "authenticated")
      let roleRow = null;
      if (requesterId) {
        let resp = await db.from('users').select('role').eq('userId', requesterId).maybeSingle();
        roleRow = resp.data;
        if (!roleRow || resp.error) {
          resp = await db.from('users').select('role').eq('userId', requesterId).maybeSingle();
          roleRow = resp.data;
        }
      }
      if (!roleRow && requesterEmail) {
        const byEmail = await db.from('users').select('role').eq('email', requesterEmail).maybeSingle();
        roleRow = byEmail.data;
      }
      requesterRole = normalizeRole(roleRow?.role || '');
    }

    if (requesterRole !== 'ADMIN' && requesterRole !== 'ORGANIZER' && requesterRole !== 'STAFF') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Scope rules:
    // - ORGANIZER or STAFF: only their own invited team/organizers (employerId = requester auth id)
    // - ADMIN (teamOnly=true): only admin's own scoped team
    // - ADMIN (default): exclude members of other organizations for privacy
    const shouldScopeToRequesterTeam =
      requesterRole === 'ORGANIZER' || requesterRole === 'STAFF' || (requesterRole === 'ADMIN' && teamOnlyRequested);

    console.log('[getAllUsers] requesterId:', requesterId, 'requesterRole:', requesterRole, 'teamOnly:', teamOnlyRequested);

    const isRequesterRecord = (user) =>
      String(user?.userId || user?.id || '') === String(requesterId || '');

    let query = db
      .from("users")
      .select("userId, id, name, email, role, imageUrl, canviewevents, caneditevents, canmanualcheckin, employerId");

    let { data, error } = await query;
    console.log('[getAllUsers] db response data length:', data?.length, 'error:', error);

    if (error && error.message?.includes('column')) {
      const fallbackQuery = db.from("users").select("*");
      if (shouldScopeToRequesterTeam) {
        let fallback = await fallbackQuery;
        data = fallback.data || [];
        error = fallback.error;
        if (!error && data.length > 0 && !('employerId' in data[0])) {
          // Migration not run: at least keep the requester's own account visible.
          data = data.filter((u) => isRequesterRecord(u));
        } else if (!error) {
          data = data.filter(
            (u) =>
              isRequesterRecord(u) ||
              String(u.employerId || u.employerid || '') === String(requesterId || '')
          );
        }
      } else {
        const fallback = await fallbackQuery;
        data = fallback.data; error = fallback.error;
      }
    }

    if (error) return res.status(500).json({ error: error.message });

    let filtered = Array.isArray(data) ? data : [];

    if (shouldScopeToRequesterTeam) {
      filtered = filtered.filter((user) => {
        const employerId = user?.employerId || user?.employerid || null;
        return isRequesterRecord(user) || String(employerId || '') === String(requesterId || '');
      });
    }

    if (requesterRole === 'ADMIN' && !teamOnlyRequested) {
      filtered = filtered.filter((user) => {
        const employerId = user?.employerId || user?.employerid || null;
        // Keep users not tied to any organizer team, or tied to this admin's own scoped team.
        return !employerId || String(employerId) === String(requesterId || '');
      });
    }

    return res.json(filtered.map(user => ({
      ...user,
      userId: user.userId || user.id || null,
      role: normalizeRole(user.role),
      canViewEvents: user.canviewevents,
      canEditEvents: user.caneditevents,
      canManualCheckIn: user.canmanualcheckin,
      employerId: user.employerId || user.employerid || null
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updatePermissions = async (req, res) => {
  try {
    const requesterId = req.user?.id;
    let requesterRole = normalizeRole(req.user?.role || '');
    if (requesterRole !== 'ADMIN') {
      // Fallback: look up role in DB using userId/id/email
      const requesterEmail = req.user?.email;
      let roleRow = null;
      if (requesterId) {
        const byUserId = await db.from('users').select('role').eq('userId', requesterId).maybeSingle();
        roleRow = byUserId.data;
        if (!roleRow || byUserId.error) {
          const byId = await db.from('users').select('role').eq('userId', requesterId).maybeSingle();
          roleRow = byId.data;
        }
      }
      if (!roleRow && requesterEmail) {
        const byEmail = await db.from('users').select('role').eq('email', requesterEmail).maybeSingle();
        roleRow = byEmail.data;
      }
      requesterRole = normalizeRole(roleRow?.role || '');
    }

    if (requesterRole !== 'ADMIN' && requesterRole !== 'ORGANIZER' && requesterRole !== 'STAFF') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { id } = req.params;
    const { canViewEvents = false, canEditEvents = false, canManualCheckIn = false } = req.body || {};

    // Resolve target user ownership to enforce privacy boundaries.
    let target = null;
    let targetError = null;

    let targetResp = await db
      .from('users')
      .select('userId, role, employerId')
      .eq('userId', id)
      .maybeSingle();
    target = targetResp.data;
    targetError = targetResp.error;

    if ((!target && !targetError) || (targetError && targetError.message?.includes('column "userId"'))) {
      targetResp = await db
        .from('users')
        .select('id, role, employerId')
        .eq('userId', id)
        .maybeSingle();
      target = targetResp.data;
      targetError = targetResp.error;
    }

    if (targetError && targetError.message?.includes('column')) {
      targetResp = await db.from('users').select('*').eq('userId', id).maybeSingle();
      target = targetResp.data;
      targetError = targetResp.error;
      if ((!target && !targetError) || (targetError && targetError.message?.includes('column "userId"'))) {
        targetResp = await db.from('users').select('*').eq('userId', id).maybeSingle();
        target = targetResp.data;
        targetError = targetResp.error;
      }
    }

    if (targetError) return res.status(500).json({ error: targetError.message });
    if (!target) return res.status(404).json({ error: 'User not found' });

    const targetEmployerId = target.employerId || target.employerid || null;
    const targetRole = normalizeRole(target.role);

    if (requesterRole === 'ORGANIZER' || requesterRole === 'STAFF') {
      if (!targetEmployerId || String(targetEmployerId) !== String(requesterId || '')) {
        return res.status(403).json({ error: 'Forbidden: team scope mismatch' });
      }
      if (targetRole !== 'STAFF' && targetRole !== 'ORGANIZER') {
        return res.status(403).json({ error: 'Forbidden: you cannot manage this role' });
      }
    }

    if (requesterRole === 'ADMIN') {
      if (targetEmployerId && String(targetEmployerId) !== String(requesterId || '')) {
        return res.status(403).json({ error: 'Forbidden: cannot manage another organization team' });
      }
    }

    let { data, error } = await db
      .from('users')
      .update({ canviewevents: canViewEvents, caneditevents: canEditEvents, canmanualcheckin: canManualCheckIn })
      .eq('userId', id)
      .select('userId, name, email, role, canviewevents, caneditevents, canmanualcheckin')
      .maybeSingle();

    if ((!data && !error) || (error && error.message?.includes('column "userId"'))) {
      const resp = await db
        .from('users')
        .update({ canviewevents: canViewEvents, caneditevents: canEditEvents, canmanualcheckin: canManualCheckIn })
        .eq('userId', id)
        .select('id, name, email, role, canviewevents, caneditevents, canmanualcheckin')
        .maybeSingle();
      data = resp.data; error = resp.error;
    }

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'User not found' });

    await logAudit({
      actionType: 'USER_PERMISSIONS_UPDATED',
      details: { targetUserId: id, targetEmail: data?.email, permissions: { canViewEvents, canEditEvents, canManualCheckIn } },
      req
    });

    return res.json({
      ...data,
      canViewEvents: data.canviewevents,
      canEditEvents: data.caneditevents,
      canManualCheckIn: data.canmanualcheckin,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const getRoleByEmail = async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) return res.status(400).json({ error: "Email is required" });
    const { data, error } = await db.from("users").select("role").eq("email", email).maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "User not found" });
    return res.json({ role: normalizeRole(data.role) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
