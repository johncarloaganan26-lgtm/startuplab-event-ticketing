import crypto from 'crypto';
import db, { supabase } from '../database/db.js';
import nodemailer from 'nodemailer';
import { sendMakeNotification } from '../utils/makeWebhook.js';

// Generate invite token and send email
export async function inviteUser(req, res) {
  const { email, role } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h expiry

  // Store invite token in DB (assume invites table exists)
  await db.from('invites').insert({ email, token, role, expiresAt });

  // Send invite email (replace with your SMTP config)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  const link = `${process.env.FRONTEND_URL}/accept-invite?token=${token}`;
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: 'You are invited!',
    html: `<p>You have been invited. <a href="${link}">Accept invite</a></p>`
  });
  res.json({ message: 'Invite sent' });
}

// Create invite link and call Make.com webhook
export async function createInviteAndSend(req, res) {
  try {
    const { email, role, name } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    if (!role) return res.status(400).json({ error: 'Role required' });
    // sendMakeNotification will no-op/skip if MAKE_WEBHOOK_URL is missing
    if (typeof fetch !== 'function') {
      return res.status(500).json({ error: 'Fetch is not available. Use Node 18+ or add node-fetch.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

    const { error: inviteError } = await db.from('invites').insert({ email, token, role, expiresAt });
    if (inviteError) return res.status(500).json({ error: inviteError.message });

    const frontendUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    if (!frontendUrl) {
      return res.status(500).json({ error: 'FRONTEND_URL is not set' });
    }
    const inviteLink = `${frontendUrl}/#/accept-invite?token=${token}`;

    const webhookRes = await sendMakeNotification({
      type: 'invite',
      email,
      name,
      meta: { inviteLink, role }
    });
    if (!webhookRes?.ok) {
      return res.status(502).json({ error: 'Failed to send invite via Make.com', details: webhookRes?.text || webhookRes?.reason || webhookRes?.error });
    }

    return res.json({ inviteLink, email, role, name });
  } catch (err) {
    return res.status(500).json({ error: 'Invite webhook error', details: err?.message || err });
  }
}

// Accept invite and set password
export async function acceptInvite(req, res) {
  const { token, password } = req.body;
  const { data: invites, error } = await db.from('invites').select('*').eq('token', token).gt('expiresAt', new Date().toISOString());
  if (error || !invites.length) return res.status(400).json({ error: 'Invalid or expired invite' });
  const invite = invites[0];

  let userId;

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
  });

  if (!authError && authData?.user?.id) {
    userId = authData.user.id;
  }

  if (!userId) {
    const authErrorMessage = authError?.message || '';
    if (!authErrorMessage.toLowerCase().includes('already')) {
      return res.status(500).json({ error: authErrorMessage || 'Failed to create auth user' });
    }

    const { data: existingUser, error: existingUserError } = await db
      .from('users')
      .select('userId')
      .eq('email', invite.email)
      .maybeSingle();

    if (existingUserError) {
      return res.status(500).json({ error: existingUserError.message });
    }

    if (!existingUser?.userId) {
      return res.status(409).json({ error: 'Account already exists. Please log in.' });
    }

    userId = existingUser.userId;
  }

  const { error: userUpsertError } = await db
    .from('users')
    .upsert({ userId, email: invite.email, role: invite.role, name: '' }, { onConflict: 'userId' });

  if (userUpsertError) {
    const message = userUpsertError.message || '';
    if (!message.toLowerCase().includes('duplicate key')) {
      return res.status(500).json({ error: message });
    }
  }

  await db.from('invites').delete().eq('token', token);
  return res.json({ message: 'Account created, you can now login.' });
}
