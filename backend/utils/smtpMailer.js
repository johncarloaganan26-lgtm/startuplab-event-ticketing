import nodemailer from 'nodemailer';

let cachedTransporter = null;
let isInitialized = false;

function createTransporter() {
  const host = String(process.env.SMTP_HOST || '').trim();
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port: Number.isFinite(port) ? port : 587,
    secure,
    auth: { user, pass },
  });
}

function getTransporter() {
  if (!isInitialized) {
    cachedTransporter = createTransporter();
    isInitialized = true;
  }
  return cachedTransporter;
}

export async function sendSmtpEmail({ to, subject, text, html, replyTo, from, config }) {
  const recipient = String(to || '').trim();
  const mailSubject = String(subject || '').trim();

  // Resolution Hierarchy for the visible 'From' field:
  // 1. Explicit 'from' passed to function (intended branding)
  // 2. Config-based 'fromAddress' (if custom settings were fetched)
  // 3. System default (env SMTP_FROM or SMTP_USER)
  const defaultFrom = String(process.env.SMTP_FROM || process.env.SMTP_USER || '').trim();
  const configFrom = config?.fromAddress ? (config.fromName ? `${config.fromName} <${config.fromAddress}>` : config.fromAddress) : null;
  const mailFrom = from || configFrom || defaultFrom;

  if (!recipient || !mailSubject || !mailFrom) {
    return { ok: false, skipped: true, reason: 'Missing recipient/subject/from' };
  }

  let transporter;
  if (config && config.smtpHost && config.smtpUser) {
    if (!config.smtpPass) {
      console.warn('[SMTP] Config provided but missing password. Delivery may fail.');
    }
    // Create one-time transporter for this organizer/admin
    transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort || 587,
      secure: config.smtpPort === 465 || config.mailEncryption === 'SSL',
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass, // Handle empty password if allowed by server
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  } else {
    transporter = getTransporter();
  }

  if (!transporter) {
    return { ok: false, skipped: true, reason: 'SMTP not configured' };
  }

  try {
    console.log(`📡 [MAIL] Sending email via ${transporter.options.host}...`);
    const sent = await transporter.sendMail({
      from: mailFrom,
      to: recipient,
      subject: mailSubject,
      text: text || undefined,
      html: html || undefined,
      replyTo: replyTo || undefined,
    });
    console.log(`✅ [MAIL] Email sent! MessageId: ${sent.messageId}`);
    return { ok: true };
  } catch (error) {
    console.error('❌ [MAIL] SMTP sending error:', error.message);
    return { ok: false, error: error.message };
  }
}
