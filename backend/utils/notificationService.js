import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import supabase from '../database/db.js';

export const debugLog = (msg) => {
  const time = new Date().toLocaleString();
  const line = `[${time}] ${msg}\n`;
  console.log(msg);
  try {
    fs.appendFileSync(path.join(process.cwd(), 'notification_debug.log'), line);
  } catch (e) { }
};
import { sendSmtpEmail } from './smtpMailer.js';
import { isMissingColumnError, isMissingRelationError } from './organizerData.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.resolve(__dirname, '../templates/notificationEmail.html');
const TICKET_TEMPLATE_PATH = path.resolve(__dirname, '../templates/OfflineEventTicket.html');
const ONLINE_TICKET_TEMPLATE_PATH = path.resolve(__dirname, '../templates/OnlineEventInvite.html');

export const NOTIFICATIONS_NOT_INITIALIZED_MESSAGE =
  'Notifications feature is not initialized. Run backend/database/notifications.sql first.';

const NOTIFICATIONS_TABLE = 'notifications';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized || '';
}

function toBoolean(value, fallback = true) {
  if (value === undefined || value === null) return fallback;
  return !!value;
}

export function buildDisplayName(user) {
  if (!user) return 'Someone';
  const byName = String(user.name || '').trim();
  if (byName) return byName;
  const email = normalizeEmail(user.email);
  if (email) return email.split('@')[0] || email;
  return 'Someone';
}


function serializeNotification(row) {
  if (!row) return null;
  return {
    notificationId: row.notification_id,
    recipientUserId: row.recipient_user_id,
    actorUserId: row.actor_user_id,
    eventId: row.event_id,
    organizerId: row.organizer_id,
    type: row.type,
    title: row.title,
    message: row.message,
    metadata: row.metadata || {},
    isRead: !!row.is_read,
    createdAt: row.created_at,
    readAt: row.read_at || null,
  };
}


export function isNotificationsSchemaError(error) {
  if (!error) return false;
  return (
    isMissingRelationError(error, NOTIFICATIONS_TABLE) ||
    isMissingColumnError(error, 'recipient_user_id') ||
    isMissingColumnError(error, 'notification_id') ||
    isMissingColumnError(error, 'is_read')
  );
}

export async function getUserProfileByAuthId(authUserId) {
  if (!authUserId) return null;

  let { data, error } = await supabase
    .from('users')
    .select('userId, name, email')
    .eq('userId', authUserId)
    .maybeSingle();

  if ((!data && !error) || isMissingColumnError(error, 'userId')) {
    const fallback = await supabase
      .from('users')
      .select('id, name, email')
      .eq('id', authUserId)
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw error;
  if (!data) return null;

  return {
    userId: data.userId || data.id || authUserId,
    name: data.name || null,
    email: normalizeEmail(data.email) || null,
  };
}


/**
 * Professional SMTP Configuration Resolution (As per Documentation):
 * 1. Check if the Event Organizer has their own SMTP configuration in organizerEmailSettings.
 * 2. If not found, check the general settings table for the organizer owner.
 * 3. FALLBACK: Use the Superadmin SMTP settings (role = 'ADMIN').
 */
export async function getSmtpConfig(organizerId = null, triggerUserId = null, recipientUserId = null) {
  console.log(`🔍 [SMTP] Resolving config for org: ${organizerId}, user: ${triggerUserId}`);
  let targetUserId = null;

  // 1. Resolve via OrganizerId directly from organizerEmailSettings
  if (organizerId) {
    const config = await fetchSmtpFromOrganizerSettings(organizerId);
    if (config) {
      debugLog(`✅ [SMTP] Found custom organizer settings for org: ${organizerId}`);
      return config;
    }

    // If no direct settings, get owner to check their general settings
    const { data: org } = await supabase
      .from('organizers')
      .select('ownerUserId')
      .eq('organizerId', organizerId)
      .maybeSingle();
    if (org?.ownerUserId) {
      targetUserId = org.ownerUserId;
    }
  }

  // 2. Resolve via Staff membership (If no organizerId provided but we have a triggering user)
  if (!targetUserId && triggerUserId) {
    const { data: ownOrg } = await supabase
      .from('organizers')
      .select('ownerUserId, organizerId')
      .eq('ownerUserId', triggerUserId)
      .maybeSingle();

    if (ownOrg) {
      // First check owner's org settings
      const config = await fetchSmtpFromOrganizerSettings(ownOrg.organizerId);
      if (config) return config;

      targetUserId = ownOrg.ownerUserId;
      console.log(`✅ [SMTP] Triggering user is owner: ${targetUserId}`);
    }
  }

  // 2b. Direct user settings lookup - check if user has their own SMTP settings
  if (!targetUserId && recipientUserId) {
    const config = await fetchSmtpFromSettingsTable(recipientUserId);
    if (config) {
      debugLog('✅ [SMTP] User personal settings loaded.');
      return config;
    }
  }

  // Fetch Settings from general settings table if owner resolved
  if (targetUserId) {
    const config = await fetchSmtpFromSettingsTable(targetUserId);
    if (config) {
      debugLog('✅ [SMTP] Custom general settings loaded.');
      return config;
    }

    if (organizerId && String(recipientUserId) === String(targetUserId)) {
      debugLog(`🚫 [SMTP] Organizer (${targetUserId}) has NO custom settings.`);
      return null;
    }
  }

  // Fetch Settings from general settings table if owner resolved
  if (targetUserId) {
    const config = await fetchSmtpFromSettingsTable(targetUserId);
    if (config) {
      debugLog('✅ [SMTP] Custom general settings loaded.');
      return config;
    }

    if (organizerId && String(recipientUserId) === String(targetUserId)) {
      debugLog(`🚫 [SMTP] Organizer (${targetUserId}) has NO custom settings.`);
      return null;
    }
  }

  // 3. FALLBACK: Use the Superadmin SMTP settings (role = 'ADMIN')
  // This is used for system emails like forgot password, account creation, etc.
  const { data: adminUser } = await supabase
    .from('users')
    .select('userId')
    .eq('role', 'ADMIN')
    .limit(1)
    .maybeSingle();

  if (adminUser?.userId) {
    const config = await fetchSmtpFromSettingsTable(adminUser.userId);
    if (config) {
      debugLog('✅ [SMTP] Admin fallback settings loaded.');
      return config;
    }
  }

  // 4. NO SYSTEM FALLBACK - Admin must configure SMTP for system emails
  debugLog('🔍 [SMTP] No admin SMTP config found. System emails require admin SMTP setup.');
  return null;
}

/**
 * Get Admin SMTP Config specifically for system emails (password reset, account creation)
 * This explicitly fetches the ADMIN user's SMTP settings regardless of organizer hierarchy
 */
export async function getAdminSmtpConfig() {
  debugLog('🔍 [SMTP] Getting Admin SMTP config for system emails...');

  // Look for any user with ADMIN role
  const { data: adminUser } = await supabase
    .from('users')
    .select('userId')
    .eq('role', 'ADMIN')
    .limit(1)
    .maybeSingle();

  if (adminUser?.userId) {
    const config = await fetchSmtpFromSettingsTable(adminUser.userId);
    if (config) {
      debugLog('✅ [SMTP] Admin SMTP config loaded for system emails.');
      return config;
    }
  }

  debugLog('⚠️ [SMTP] No admin SMTP config found.');
  return null;
}

/**
 * NEW: Fetch from the dedicated organizerEmailSettings table
 */
async function fetchSmtpFromOrganizerSettings(organizerId) {
  const { data, error } = await supabase
    .from('organizerEmailSettings')
    .select('*')
    .eq('organizerId', organizerId)
    .maybeSingle();

  if (error || !data || !data.smtpHost || !data.smtpUsername) return null;

  return {
    emailProvider: data.emailProvider || 'SMTP',
    mailDriver: data.mailDriver || 'smtp',
    smtpHost: data.smtpHost,
    smtpPort: parseInt(data.smtpPort, 10) || 587,
    smtpUser: data.smtpUsername,
    smtpPass: data.smtpPassword,
    mailEncryption: data.mailEncryption || 'TLS',
    fromAddress: data.fromAddress || data.smtpUsername,
    fromName: data.fromName || 'Organizer',
    organizerId,
  };
}

/**
 * Helper to fetch from general settings table (legacy/fallback)
 */
async function fetchSmtpFromSettingsTable(userId) {
  // Exact keys from the documentation provided
  const keys = [
    'email_provider',
    'email_driver',
    'email_host',
    'email_port',
    'email_username',
    'email_password',
    'email_encryption',
    'email_from_address',
    'email_from_name'
  ];

  const { data, error } = await supabase
    .from('settings')
    .select('key, value')
    .eq('user_id', userId)
    .in('key', keys);

  if (error || !data || data.length === 0) return null;

  const map = new Map(data.map(item => [item.key, item.value]));

  // Ensure minimum keys exist (host and user are required to send)
  if (!map.get('email_host') || !map.get('email_username')) return null;

  return {
    emailProvider: map.get('email_provider') || 'SMTP',
    mailDriver: map.get('email_driver') || 'smtp',
    smtpHost: map.get('email_host'),
    smtpPort: parseInt(map.get('email_port'), 10) || 587,
    smtpUser: map.get('email_username'),
    smtpPass: map.get('email_password'),
    mailEncryption: map.get('email_encryption') || 'TLS',
    fromAddress: map.get('email_from_address') || map.get('email_username'),
    fromName: map.get('email_from_name') || 'Organizer',
    userId,
  };
}


export async function listNotificationsForUser(userId, limit = 25) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
  const { data, error } = await supabase
    .from(NOTIFICATIONS_TABLE)
    .select('*')
    .eq('recipient_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(safeLimit);

  if (error) throw error;
  return (data || []).map(serializeNotification).filter(Boolean);
}

export async function markNotificationReadForUser(notificationId, userId) {
  const { data, error } = await supabase
    .from(NOTIFICATIONS_TABLE)
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('notification_id', notificationId)
    .eq('recipient_user_id', userId)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return serializeNotification(data);
}

export async function markAllNotificationsReadForUser(userId) {
  const { error } = await supabase
    .from(NOTIFICATIONS_TABLE)
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('recipient_user_id', userId)
    .eq('is_read', false);

  if (error) throw error;
}

async function renderEmailHtml(payload) {
  try {
    const metadata = payload.metadata || {};

    if (payload.type === 'TICKET_DELIVERY') {
      const isOnline = String(metadata.locationType || '').toLowerCase() === 'online';
      const templateToUse = isOnline ? ONLINE_TICKET_TEMPLATE_PATH : TICKET_TEMPLATE_PATH;

      if (!fs.existsSync(templateToUse)) return null;
      let html = fs.readFileSync(templateToUse, 'utf-8');

      const ticketReplacements = {
        '1.name': payload.name || 'Attendee',
        '1.meta.eventName': metadata.eventName || '',
        '1.meta.eventDescription': metadata.eventDescription || '',
        '1.meta.eventLocation': metadata.eventLocation || '',
        '1.meta.eventStartAt': metadata.eventStartAt || '',
        '1.meta.eventEndAt': metadata.eventEndAt || '',
        '1.meta.orderId': metadata.orderId || '',
        '1.meta.streamingPlatform': metadata.streamingPlatform || '',
        '1.meta.ticket.ticketCode': metadata.ticket?.ticketCode || '',
        '1.meta.ticket.qrPayload': metadata.ticket?.qrPayload || '',
        '1.meta.eventImageUrl': metadata.eventImageUrl || 'https://xmjdcbzgdfylbqkjoyyb.supabase.co/storage/v1/object/public/startuplab-business-ticketing/assets/assets/cover-placeholder.png'
      };

      Object.entries(ticketReplacements).forEach(([key, value]) => {
        // Need to escape the dots in key for regex as it has literal dots like 1.meta.eventName
        const regex = new RegExp(`{{${key.replace(/\./g, '\\.')}}}`, 'g');
        html = html.replace(regex, String(value || ''));
      });
      return html;
    }

    if (!fs.existsSync(TEMPLATE_PATH)) return null;
    let html = fs.readFileSync(TEMPLATE_PATH, 'utf-8');

    const typeLabelMap = {
      EVENT_LIKED: 'NEW LIKE',
      LIKE_CONFIRMATION: 'THANKS',
      ORGANIZER_FOLLOWED: 'NEW FOLLOWER',
      FOLLOW_CONFIRMATION: 'THANKS',
      ORDER_PLACED: 'NEW ORDER',
      TICKET_CANCELLED: 'CANCELLED',
      ADMIN_ALERT: 'SYSTEM',
    };

    const typeIconMap = {
      EVENT_LIKED: '❤️',
      LIKE_CONFIRMATION: '💖',
      ORGANIZER_FOLLOWED: '👥',
      FOLLOW_CONFIRMATION: '🙌',
      ORDER_PLACED: '💰',
      TICKET_CANCELLED: '🚫',
      ADMIN_ALERT: '⚡',
    };

    const replacements = {
      typeIcon: metadata.typeIcon || typeIconMap[payload.type] || '🔔',
      tag: metadata.tag || typeLabelMap[payload.type] || 'NOTIFICATION',
      title: payload.title || 'New Notification',
      message: payload.message || '',
      actionLabel: metadata.actionLabel || 'VIEW DASHBOARD',
      actionUrl: metadata.actionUrl || process.env.FRONTEND_URL || 'https://events.moonshotdigital.com.ph',
      eventName: metadata.eventName || 'the platform',
    };

    // Simple replacement loop
    Object.entries(replacements).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, String(value || ''));
    });

    return html;
  } catch (err) {
    console.error('[Notifications] Template rendering failed:', err.message);
    return null;
  }
}

export async function createInAppNotification(payload) {
  const { data, error } = await supabase
    .from(NOTIFICATIONS_TABLE)
    .insert({
      recipient_user_id: payload.recipientUserId,
      actor_user_id: payload.actorUserId || null,
      event_id: payload.eventId || null,
      organizer_id: payload.organizerId || null,
      type: String(payload.type || 'GENERIC'),
      title: String(payload.title || 'Notification'),
      message: String(payload.message || ''),
      metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {},
      is_read: false,
    })
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return serializeNotification(data);
}

export async function notifyUserByPreference({
  recipientUserId,
  recipientFallbackEmail,
  actorUserId,
  eventId,
  organizerId,
  type,
  title,
  message,
  metadata,
  emailSubject,
  emailText,
  emailHtml,
  replyTo,
  fromName,
  fromEmail,
  smtpConfigOverride, // New parameter to force a specific SMTP config
}) {
  if (!recipientUserId && !recipientFallbackEmail) return { inApp: false, email: false };

  // Fetch SMTP config based on professional hierarchy (Organizer -> Superadmin Fallback)
  // OR use the override if provided (for system emails like password reset)
  let smtpConfig = smtpConfigOverride || null;

  if (!smtpConfig) {
    try {
      // Resolve context using both organizerId and actorUserId (for staff detection)
      smtpConfig = await getSmtpConfig(organizerId, actorUserId, recipientUserId);
      debugLog(`🔍 [Notifications] SMTP Config Resolved: ${smtpConfig ? 'YES' : 'NO'}`);
    } catch (err) {
      debugLog(`🚫 [Notifications] Failed to resolve SMTP config: ${err.message}`);
    }
  } else {
    debugLog(`🔍 [Notifications] Using SMTP Config Override (Admin SMTP for system emails)`);
  }

  // Auto-generate HTML if not provided but we have a type
  let finalHtml = emailHtml;
  if (!finalHtml && type) {
    finalHtml = await renderEmailHtml({ type, title, message, metadata });
  }

  let inAppDelivered = false;
  let emailDelivered = false;

  // DELIVER IN-APP (Default Enable)
  if (recipientUserId) {
    try {
      await createInAppNotification({
        recipientUserId,
        actorUserId,
        eventId,
        organizerId,
        type,
        title,
        message,
        metadata: metadata || {},
      });
      inAppDelivered = true;
    } catch (error) {
      if (!isNotificationsSchemaError(error)) throw error;
      console.warn('[Notifications] notifications table missing. Skipping in-app delivery.');
    }
  }

  // RESOLVE RECIPIENT EMAIL + PREFERENCES
  let finalRecipientEmail = normalizeEmail(recipientFallbackEmail || '');
  let emailEnabled = true;

  try {
    const { data: settings } = await supabase
      .from('user_notification_settings')
      .select('notification_email, email_notifications_enabled')
      .eq('user_id', recipientUserId)
      .maybeSingle();

    if (settings) {
      if (settings.notification_email) {
        finalRecipientEmail = normalizeEmail(settings.notification_email);
      }
      emailEnabled = !!settings.email_notifications_enabled;
    }

    if (!finalRecipientEmail) {
      const profile = await getUserProfileByAuthId(recipientUserId);
      finalRecipientEmail = normalizeEmail(profile?.email || '');
    }
  } catch (prefErr) {
    console.warn('[Notifications] Preferences lookup failed:', prefErr.message);
  }

  // DELIVER EMAIL (If enabled and email resolved)
  if (emailEnabled && finalRecipientEmail) {
    if (organizerId && !smtpConfig) {
      debugLog('🚫 [Notifications] Request explicitly requires organizer email config (no system config fallback for tickets). Email SKIPPED.');
      return { inApp: inAppDelivered, email: false };
    }

    const to = finalRecipientEmail;
    const subject = String(emailSubject || title || 'Notification');
    const text = String(emailText || message || '');

    let computedFromName = fromName || smtpConfig?.fromName;
    let finalFrom = fromEmail
      ? (computedFromName ? `${computedFromName} <${fromEmail}>` : fromEmail)
      : (smtpConfig?.fromAddress ? (computedFromName ? `${computedFromName} <${smtpConfig.fromAddress}>` : smtpConfig.fromAddress) : undefined);

    debugLog(`🚀 [Notifications] SMTP Attempt: TO=${to}, FROM=${finalFrom}`);

    const result = await sendSmtpEmail({
      to,
      subject,
      text,
      html: finalHtml,
      replyTo: replyTo || fromEmail || smtpConfig?.fromAddress,
      from: finalFrom,
      config: smtpConfig,
    });
    emailDelivered = !!result?.ok;
    if (emailDelivered) {
      debugLog(`✅ [Notifications] SMTP SUCCESS to ${to}`);
    } else {
      debugLog(`❌ [Notifications] SMTP FAILED to ${to}: ${result.error || result.reason || 'Unknown'}`);
      if (result.skipped) debugLog(`ℹ️ [Notifications] Reason: ${result.reason}`);
    }
  } else {
    debugLog(`⚠️ [Notifications] Email SKIPPED. Enabled: ${emailEnabled}, Address: ${finalRecipientEmail || 'NONE'}`);
  }

  return { inApp: inAppDelivered, email: emailDelivered };
}

export async function notifyTeamByPreference(params) {
  const { organizerId, recipientUserId } = params;

  if (!organizerId && !recipientUserId) return { inApp: false, email: false };

  let ownerUserId = recipientUserId;
  if (!ownerUserId && organizerId) {
    const { data: orgRow } = await supabase
      .from('organizers')
      .select('ownerUserId')
      .eq('organizerId', organizerId)
      .maybeSingle();
    if (orgRow?.ownerUserId) {
      ownerUserId = orgRow.ownerUserId;
    }
  }

  if (!ownerUserId) return { inApp: false, email: false };

  // 1. Get the owner explicitly
  const { data: ownerDetails } = await supabase
    .from('users')
    .select('userId, email')
    .eq('userId', ownerUserId)
    .maybeSingle();

  // 2. Get all staff exactly reporting to this owner (employerId = ownerUserId)
  const { data: staffBatch, error: staffErr } = await supabase
    .from('users')
    .select('userId, email, canreceivenotifications, employerId')
    .eq('employerId', ownerUserId)
    .eq('role', 'STAFF');

  let team = [];

  // Add Owner
  if (ownerDetails) {
    team.push({ userId: ownerDetails.userId, email: ownerDetails.email });
  } else {
    team.push({ userId: ownerUserId, email: params.recipientFallbackEmail });
  }

  // Add staff with specific notifications enabled
  if (staffBatch && !staffErr) {
    for (const member of staffBatch) {
      // If notification permission is true OR default NULL staff logic
      const canReceive = member.canreceivenotifications === undefined || member.canreceivenotifications === null ? true : !!member.canreceivenotifications;
      if (canReceive) {
        team.push({ userId: member.userId, email: member.email });
      }
    }
  }

  let results = [];
  // Ensure unique members logic (no double messaging if owner somehow duplicated in staff array)
  const uniqueTeam = team.filter((v, i, a) => a.findIndex(t => t.userId === v.userId) === i);

  // If the actor is the owner testing the attendee mode, skip notifying the team entirely!
  if (params.actorUserId && String(params.actorUserId) === String(ownerUserId)) {
    debugLog(`[TeamNotify] Actor is the Owner testing attendee mode. Skipping team notifications.`);
    return { deliveredTo: 0, success: true };
  }

  if (params.actorEmail && ownerDetails?.email && String(params.actorEmail) === String(ownerDetails.email)) {
    debugLog(`[TeamNotify] Actor Email matches the Owner testing attendee mode. Skipping team notifications.`);
    return { deliveredTo: 0, success: true };
  }

  for (const recipient of uniqueTeam) {
    // Skip notifying the person who triggered the action
    if (params.actorUserId && String(recipient.userId) === String(params.actorUserId)) {
      continue;
    }
    if (params.actorEmail && recipient.email && String(recipient.email) === String(params.actorEmail)) {
      continue;
    }

    debugLog(`[TeamNotify] Sending to team member: ${recipient.userId}`);
    const res = await notifyUserByPreference({
      ...params,
      recipientUserId: recipient.userId,
      recipientFallbackEmail: recipient.email,
    });
    results.push(res);
  }

  return { deliveredTo: results.length, success: results.some(r => r.inApp || r.email) };
}
