import db from "../database/db.js";
import supabase, { createAuthClient, supabaseConfig } from '../database/db.js';
import { sendMakeNotification } from '../utils/makeWebhook.js';

import { notifyUserByPreference, getAdminSmtpConfig } from "../utils/notificationService.js";
import { logAudit } from "../utils/auditLogger.js";

const ORGANIZER_ROLE = 'ORGANIZER';

export const register = async (req, res) => {
  const { name, email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }
  if (!name || !name.trim()) {
    return res.status(400).json({ message: "Name is required" });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  try {
    // Check if email already exists in users table
    const { data: existingUser } = await db
      .from('users')
      .select('email')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (existingUser) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    // --- GET DEFAULT PLAN ---
    const { data: defaultPlan } = await db
      .from('plans')
      .select('planId, trialDays, monthlyPrice, currency')
      .eq('isDefault', true)
      .eq('isActive', true)
      .maybeSingle();

    // Create signup verification link in Supabase Auth
    // Use the custom domain if available, otherwise fallback.
    const frontendUrl = (process.env.FRONTEND_URL || 'https://startuplab-event-creation.vercel.app').replace(/\/$/, '');
    console.log(`[Auth] Registration request for: ${email}. Using FRONTEND_URL: ${frontendUrl}`);
    
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email: email.toLowerCase().trim(),
      password,
      options: {
        redirectTo: `${frontendUrl}/#/login`
      }
    });

    if (linkError) {
      // Check for orphan auth user again if first check missed it
      if (linkError.message?.includes('already registered') || linkError.code === 'email_exists') {
        const { data: listData } = await supabase.auth.admin.listUsers();
        const orphanedUser = listData?.users?.find(u => u.email === email.toLowerCase().trim());
        if (orphanedUser) {
          await supabase.auth.admin.deleteUser(orphanedUser.id);
          // Retry generateLink
          const retry = await supabase.auth.admin.generateLink({
            type: 'signup',
            email: email.toLowerCase().trim(),
            password,
            options: { redirectTo: `${frontendUrl}/#/login` }
          });
          if (retry.error) return res.status(400).json({ message: retry.error.message });
          // Link data from retry
          linkData.properties = retry.data.properties;
          linkData.user = retry.data.user;
        }
      } else {
        return res.status(400).json({ message: linkError.message || "Failed to create account" });
      }
    }

    const userId = linkData.user?.id;
    if (!userId) {
      return res.status(500).json({ message: "Failed to create auth user or generate verification link" });
    }

    // Supabase generateLink defaults to the "Site URL" in dashboard for the action_link.
    // If that dashboard setting is wrong (pointing to localhost), the link will be broken.
    // We manually construct it here using FRONTEND_URL to guarantee it works.
    const tokenHash = linkData.properties?.hashed_token;
    const verificationLink = tokenHash
      ? `${supabaseConfig.url}/auth/v1/verify?token=${encodeURIComponent(tokenHash)}&type=signup&redirect_to=${encodeURIComponent(frontendUrl + '/#/login')}`
      : linkData.properties?.action_link;

    console.log(`[Auth] Generated Verification Link: ${verificationLink}`);

    // Insert into users table with role ORGANIZER
    let { data: userData, error: dbError } = await db
      .from('users')
      .insert({
        userId,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        role: ORGANIZER_ROLE,
        canviewevents: false,
        caneditevents: false,
        canmanualcheckin: false,
      })
      .select('userId, name, email, role')
      .single();

    if (dbError) {
      console.error("DB insert error:", dbError);
      try { await supabase.auth.admin.deleteUser(userId); } catch (e) { }
      return res.status(500).json({ message: "Failed to create user record" });
    }

    // --- CREATE ORGANIZER PROFILE & AUTO-ASSIGN DEFAULT PLAN ---
    // If a default plan exists (e.g., 'Starter' with $0 price), assign it immediately.
    let currentPlanId = null;
    let subscriptionStatus = 'pending';
    let planExpiresAt = null;

    if (defaultPlan) {
      currentPlanId = defaultPlan.planId;
      // Trial logic removed - organizations default to free or pending status
      if (defaultPlan.monthlyPrice === 0) {
        subscriptionStatus = 'active';
        // Permanent free plans have no natural expiry, or we can set it to 10 years out.
        const longFuture = new Date();
        longFuture.setFullYear(longFuture.getFullYear() + 10);
        planExpiresAt = longFuture.toISOString();
      }
    }

    const { data: orgData, error: orgError } = await db
      .from('organizers')
      .insert({
        ownerUserId: userId,
        organizerName: name.trim() || 'My Organization',
        currentPlanId,
        subscriptionStatus,
        planExpiresAt,
        isOnboarded: false
      })
      .select()
      .single();

    if (orgError) {
      console.log("❌ Failed to create organizer profile:", orgError.message);
    } else if (orgData && currentPlanId && subscriptionStatus !== 'pending') {
      // ✅ Also create a formal subscription record for documentation/history
      const { error: subErr } = await db
        .from('organizersubscriptions')
        .insert({
          organizerId: orgData.organizerId,
          planId: currentPlanId,
          billingInterval: 'monthly',
          status: subscriptionStatus,
          priceAmount: Number(defaultPlan.monthlyPrice || 0),
          currency: defaultPlan.currency || 'PHP',
          startDate: new Date().toISOString(),
          endDate: planExpiresAt,
        });

      if (subErr) {
        console.log("❌ Failed to create auto-subscription record:", subErr.message);
      } else {
        console.log(`✅ [Auth] Auto-assigned '${subscriptionStatus}' subscription to plan '${currentPlanId}' for user ${userId}`);
      }
    }

    // Safety net: if any DB default/trigger rewrote role to USER, force ORGANIZER.
    const persistedRole = String(userData?.role || '').toUpperCase();
    if (persistedRole !== ORGANIZER_ROLE) {
      const roleFix = await db
        .from('users')
        .update({ role: ORGANIZER_ROLE })
        .eq('userId', userId)
        .select('userId, name, email, role')
        .maybeSingle();
      if (!roleFix.error && roleFix.data) {
        userData = roleFix.data;
      }
    }

    // Notify User via the Admin's Professional SMTP settings (Fallback mechanism)
    const adminSmtpConfig = await getAdminSmtpConfig();

    if (!adminSmtpConfig) {
      // Still allow account creation, but warn about email
      console.warn('[Auth] Admin SMTP not configured - welcome email will not be sent.');
    } else {
      try {
        await notifyUserByPreference({
          recipientUserId: userId,
          recipientFallbackEmail: email.toLowerCase().trim(),
          type: 'ADMIN_ALERT', // Using system template
          title: 'Welcome to StartupLab! Please Verify Your Email',
          message: `Hello ${name.trim()}, your account for StartupLab has been created. Before you can start organizing events, please verify your email using the link below.`,
          metadata: {
            tag: 'VERIFICATION',
            typeIcon: '📬',
            actionLabel: 'VERIFY EMAIL & SIGN IN',
            actionUrl: verificationLink,
          },
          // Force use of admin SMTP config for system emails
          smtpConfigOverride: adminSmtpConfig
        });
        console.log(`✅ [Auth] Verification email queued for ${email} via Admin SMTP.`);
      } catch (notifyErr) {
        console.warn("[Auth] SMTP Verification notification failed:", notifyErr?.message);
        // Fallback to Make.com as a secondary if SMTP is not configured
        try {
          await sendMakeNotification({
            type: 'invite',
            email: email.toLowerCase().trim(),
            name: name.trim(),
            meta: { inviteLink: verificationLink, role: ORGANIZER_ROLE }
          });
        } catch (webhookErr) {
          console.warn("Make.com fallback also failed:", webhookErr?.message);
        }
      }
    }
    
    // Log registration
    await logAudit({ actionType: 'REGISTER', actorUserId: userId, req });

    return res.status(201).json({
      message: "Registration successful! A verification link has been sent to your email. You must click it before you can sign in.",
      user: userData
    });
  } catch (err) {
    console.error("Registration error:", err);
    return res.status(500).json({ message: "Server error during registration" });
  }
};

export const login = async (req, res) => {
  const { access_token, refresh_token } = req.body;

  if (!access_token || !refresh_token) {
    return res.status(400).json({ message: "Missing tokens" });
  }

  try {
    // ✅ Verify access token with a short-lived client to avoid mutating global state
    const authClient = createAuthClient(access_token);
    const { data: user, error } = await authClient.auth.getUser(access_token);

    if (error || !user) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    // ✅ Store tokens in cookies (match middleware attributes)
    const isProd = process.env.NODE_ENV === "production";
    const base = {
      httpOnly: true,
      sameSite: isProd ? "None" : "Lax",
      secure: isProd ? true : false,
      path: "/",
    };
    res.cookie("access_token", access_token, { ...base, maxAge: 60 * 60 * 1000 });
    res.cookie("refresh_token", refresh_token, { ...base, maxAge: 14 * 24 * 60 * 60 * 1000 });
    
    // Log login
    await logAudit({ actionType: 'LOGIN', actorUserId: user.user.id, req });

    return res.json({
      message: "Logged in successfully",
      user: user.user,
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}


const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";

export async function logout(req, res) {
  const isProd = process.env.NODE_ENV === "production";

  const cookieBase = {
    httpOnly: true,
    path: "/",
    sameSite: isProd ? "None" : "Lax",
    secure: isProd ? true : false,
  };

  try {
    const accessToken = req.cookies?.[ACCESS_COOKIE] ?? null;
    const refreshToken = req.cookies?.[REFRESH_COOKIE] ?? null;

    // Best-effort: bind session; ignore errors
    if (accessToken && refreshToken) {
      try {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
      } catch (e) {
        // ignore (session may not map)
      }
    }

    // Best-effort revoke; ignore benign errors (e.g., missing session_id)
    try {
      await supabase.auth.signOut({ scope: "global" });
    } catch (e) {
      // ignore
    }

    // Log logout
    if (accessToken) {
      // Best effort decode for logging
      try {
        const { data: user } = await supabase.auth.getUser(accessToken);
        if (user?.user) await logAudit({ actionType: 'LOGOUT', actorUserId: user.user.id, req });
      } catch {}
    }

    // Always expire cookies; names and attributes must match how you set them at login
    res.cookie(ACCESS_COOKIE, "", { ...cookieBase, expires: new Date(0) });
    res.cookie(REFRESH_COOKIE, "", { ...cookieBase, expires: new Date(0) });

    return res.status(204).send();
  } catch (err) {
    // Still expire on unexpected errors and finish with 204
    res.cookie(ACCESS_COOKIE, "", { ...cookieBase, expires: new Date(0) });
    res.cookie(REFRESH_COOKIE, "", { ...cookieBase, expires: new Date(0) });
    return res.status(204).send();
  }
}

export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Verify user exists in our records
    const { data: user, error: userErr } = await db
      .from('users')
      .select('userId, name, email')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (userErr) throw userErr;
    if (!user) {
      return res.status(404).json({ error: 'No account found with this email address.' });
    }

    // 2. Generate Supabase Password Reset Link
    // Note: This requires the service role key (admin client)
    const frontendUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');

    const { data, error: resetErr } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: normalizedEmail,
      options: {
        redirectTo: `${frontendUrl}/#/reset-password`
      }
    });

    if (resetErr) throw resetErr;

    const tokenHash = data.properties?.hashed_token;
    const resetLink = tokenHash
      ? `${frontendUrl}/#/reset-password?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`
      : data.properties?.action_link;
    if (!resetLink) throw new Error('Failed to generate reset link');

    // 3. Send the link via Professional SMTP hierarchy (Admin fallback)
    // Check if admin SMTP is configured - if not, show error
    const adminSmtpConfig = await getAdminSmtpConfig();

    if (!adminSmtpConfig) {
      return res.status(503).json({
        error: 'Email service not configured. Please contact the administrator to set up SMTP settings in Admin Settings > Email Configuration.',
        code: 'SMTP_NOT_CONFIGURED'
      });
    }

    await notifyUserByPreference({
      recipientUserId: user?.userId,
      recipientFallbackEmail: normalizedEmail,
      type: 'ADMIN_ALERT',
      title: 'Reset Your Password',
      message: `Hello ${user.name || 'User'}, we received a request to reset your password for your StartupLab account. If you didn't make this request, you can safely ignore this email.`,
      metadata: {
        tag: 'SECURITY',
        typeIcon: '🔐',
        actionLabel: 'RESET PASSWORD',
        actionUrl: resetLink,
      },
      // Force use of admin SMTP config for system emails
      smtpConfigOverride: adminSmtpConfig
    });

    return res.status(200).json({ message: 'Reset link sent successfully.' });
  } catch (err) {
    console.error('[Auth] Forgot password error:', err);
    return res.status(500).json({ error: 'Failed to process password reset request.' });
  }
};
