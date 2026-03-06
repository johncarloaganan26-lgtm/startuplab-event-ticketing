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

  // Fetch Settings from general settings table if owner resolved
  if (targetUserId) {
    const config = await fetchSmtpFromSettingsTable(targetUserId);
    if (config) {
      debugLog('✅ [SMTP] Custom general settings loaded.');
      return config;
    }

    if (organizerId && String(recipientUserId) === String(targetUserId)) {
      debugLog(`🚫 [SMTP] Organizer (${targetUserId}) has NO custom settings. Blocking Admin fallback for owner.`);
      return null;
    }
  }

  // 3. SYSTEM FALLBACK (Superadmin)
  debugLog('🔍 [SMTP] Fallback to Superadmin settings...');
  const { data: admins } = await supabase
    .from('users')
    .select('userId')
    .eq('role', 'ADMIN')
    .order('created_at', { ascending: true });

  if (admins && admins.length > 0) {
    for (const admin of admins) {
      const adminConfig = await fetchSmtpFromSettingsTable(admin.userId);
      if (adminConfig) return adminConfig;
    }
  }

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
    if (!fs.existsSync(TEMPLATE_PATH)) return null;
    let html = fs.readFileSync(TEMPLATE_PATH, 'utf-8');

    const metadata = payload.metadata || {};
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
}) {
  if (!recipientUserId && !recipientFallbackEmail) return { inApp: false, email: false };

  // Fetch SMTP config based on professional hierarchy (Organizer -> Superadmin Fallback)
  let smtpConfig = null;
  try {
    // Resolve context using both organizerId and actorUserId (for staff detection)
    smtpConfig = await getSmtpConfig(organizerId, actorUserId, recipientUserId);
    debugLog(`🔍 [Notifications] SMTP Config Resolved: ${smtpConfig ? 'YES' : 'NO'}`);
  } catch (err) {
    debugLog(`🚫 [Notifications] Failed to resolve SMTP config: ${err.message}`);
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
    const to = finalRecipientEmail;
    const subject = String(emailSubject || title || 'Notification');
    const text = String(emailText || message || '');

    let finalFrom = fromEmail
      ? (fromName ? `${fromName} <${fromEmail}>` : fromEmail)
      : (smtpConfig?.fromAddress ? (smtpConfig.fromName ? `${smtpConfig.fromName} <${smtpConfig.fromAddress}>` : smtpConfig.fromAddress) : undefined);

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
