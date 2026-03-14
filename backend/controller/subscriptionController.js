import supabase from '../database/db.js';
import { randomUUID } from 'crypto';
import { logAudit } from '../utils/auditLogger.js';
import { decryptString } from '../utils/encryption.js';
import { sendSmtpEmail } from '../utils/smtpMailer.js';
import { notifyUserByPreference } from '../utils/notificationService.js';

const fetchEmailConfig = async (userId) => {
  const { data } = await supabase
    .from('settings')
    .select('key, value')
    .eq('user_id', userId)
    .in('key', [
      'email_host',
      'email_port',
      'email_username',
      'email_password',
      'email_encryption',
      'email_from_address',
      'email_from_name'
    ]);

  if (!data || data.length === 0) return null;

  const map = {};
  data.forEach(item => map[item.key] = item.value);

  return {
    smtpHost: map['email_host'] || null,
    smtpPort: map['email_port'] ? Number(map['email_port']) : undefined,
    smtpUser: map['email_username'] || null,
    smtpPass: map['email_password'] || null,
    mailEncryption: map['email_encryption'] || undefined,
    fromAddress: map['email_from_address'] || map['email_username'] || null,
    fromName: map['email_from_name'] || 'StartupLab'
  };
};

const SUCCESS_PAYMENT_STATUSES = new Set([
  'completed',
  'paid',
  'succeeded',
  'payment_successful',
  'success',
]);

const FAILED_PAYMENT_STATUSES = new Set([
  'failed',
  'cancelled',
  'canceled',
  'expired',
  'declined',
  'error',
]);

const normalizePaymentStatus = (value) => String(value || '').trim().toLowerCase();

const isSuccessfulPaymentStatus = (status) => SUCCESS_PAYMENT_STATUSES.has(normalizePaymentStatus(status));
const isFailedPaymentStatus = (status) => FAILED_PAYMENT_STATUSES.has(normalizePaymentStatus(status));

const firstDefinedString = (...values) => {
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }
  return null;
};

const deriveStatusFromEventType = (eventType) => {
  const normalizedEvent = normalizePaymentStatus(eventType);
  if (!normalizedEvent) return '';
  if (
    normalizedEvent.includes('completed') ||
    normalizedEvent.includes('paid') ||
    normalizedEvent.includes('succeeded') ||
    normalizedEvent.includes('success')
  ) {
    return 'paid';
  }
  if (
    normalizedEvent.includes('failed') ||
    normalizedEvent.includes('cancelled') ||
    normalizedEvent.includes('canceled') ||
    normalizedEvent.includes('expired')
  ) {
    return 'failed';
  }
  if (normalizedEvent.includes('pending')) return 'pending';
  return '';
};

const extractSubscriptionWebhookMeta = (payload = {}) => {
  const eventType = firstDefinedString(payload?.event, payload?.type, payload?.event_type, payload?.name);
  const eventData = payload?.data?.payment_request || payload?.data || payload?.payment_request || payload;
  const referenceId = firstDefinedString(
    payload?.reference_id,
    payload?.referenceId,
    payload?.reference_number,
    payload?.referenceNumber,
    payload?.reference,
    payload?.order_id,
    eventData?.reference_id,
    eventData?.referenceId,
    eventData?.reference_number,
    eventData?.referenceNumber,
    eventData?.reference,
    eventData?.order_id,
  );
  const paymentRequestId = firstDefinedString(
    payload?.payment_request_id,
    payload?.paymentRequestId,
    payload?.id,
    eventData?.payment_request_id,
    eventData?.paymentRequestId,
    eventData?.id,
  );
  const status = normalizePaymentStatus(
    firstDefinedString(
      payload?.status,
      payload?.payment_status,
      eventData?.status,
      eventData?.payment_status,
      eventData?.state,
    ) || deriveStatusFromEventType(eventType)
  );

  return {
    eventType,
    eventData,
    referenceId,
    paymentRequestId,
    status,
  };
};

const computeSubscriptionEndDate = (billingInterval) => {
  const endDate = new Date();
  if (String(billingInterval || '').toLowerCase() === 'yearly') {
    endDate.setFullYear(endDate.getFullYear() + 1);
  } else {
    endDate.setMonth(endDate.getMonth() + 1);
  }
  return endDate;
};

const recordPlanPurchase = async (subscription, plan, organizer, req = null) => {
  try {
    const { data: owner } = await supabase
      .from('users')
      .select('email')
      .eq('userId', organizer.ownerUserId)
      .maybeSingle();

    const orderId = randomUUID();
    const isPaid = subscription.status === 'active';

    await supabase.from('orders').insert({
      orderId,
      userId: organizer.ownerUserId,
      eventId: null,
      buyerName: organizer.organizerName || 'Organizer',
      buyerEmail: owner?.email || 'unknown@organizer.com',
      totalAmount: subscription.priceAmount || 0,
      currency: subscription.currency || 'PHP',
      status: isPaid ? 'PAID' : 'PENDING',
      metadata: {
        type: 'PLAN_SUBSCRIPTION',
        subscriptionId: subscription.subscriptionId,
        planId: plan.planId,
        planName: plan.name,
        billingInterval: subscription.billingInterval,
        isFree: (subscription.priceAmount || 0) === 0
      }
    });

    await supabase.from('paymentTransactions').insert({
      orderId,
      gateway: { name: 'HITPAY' },
      amount: subscription.priceAmount || 0,
      currency: subscription.currency || 'PHP',
      status: isPaid ? 'SUCCEEDED' : 'PENDING',
      hitpayReferenceId: subscription.hitPayPaymentId || `PLAN-${subscription.subscriptionId}`
    });

    await logAudit({
      actionType: 'PLAN_PURCHASE_RECORDED',
      actorUserId: organizer.ownerUserId,
      orderId,
      details: {
        planName: plan.name,
        amount: subscription.priceAmount || 0,
        currency: subscription.currency || 'PHP',
        isFree: (subscription.priceAmount || 0) === 0,
        billingInterval: subscription.billingInterval,
        organizerId: organizer.organizerId
      },
      req
    });

    console.log(`✅ [Subscription] Recorded plan purchase logic for Admin logs: ${orderId}`);
  } catch (err) {
    console.error('❌ [Subscription] Error recording plan purchase logs:', err);
  }
};

const fetchSubscriptionWithPlan = async (column, value) => {
  let { data: subscription, error } = await supabase
    .from('organizersubscriptions')
    .select('*, plans(*)')
    .eq(column, value)
    .maybeSingle();

  if (!error && subscription) return subscription;

  const { data: rawSub, error: rawErr } = await supabase
    .from('organizersubscriptions')
    .select('*')
    .eq(column, value)
    .maybeSingle();

  if (rawErr || !rawSub) return null;

  const { data: planData } = await supabase
    .from('plans')
    .select('*')
    .eq('planId', rawSub.planId)
    .maybeSingle();

  return { ...rawSub, plans: planData };
};

const activateSubscription = async (subscription, req = null) => {
  const endDate = computeSubscriptionEndDate(subscription.billingInterval);

  const { error: subErr } = await supabase
    .from('organizersubscriptions')
    .update({
      status: 'active',
      endDate: endDate.toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('subscriptionId', subscription.subscriptionId);

  if (subErr) {
    throw new Error(`Failed to update subscription: ${subErr.message}`);
  }

  const { error: orgErr } = await supabase
    .from('organizers')
    .update({
      currentPlanId: subscription.planId,
      subscriptionStatus: 'active',
      planExpiresAt: endDate.toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('organizerId', subscription.organizerId);

  if (orgErr) {
    console.error('❌ [Subscription] Failed to update organizer plan:', orgErr);
  }

  const { data: organizer } = await supabase
    .from('organizers')
    .select('*')
    .eq('organizerId', subscription.organizerId)
    .maybeSingle();

  const planData = subscription.plans || subscription.plan || null;
  await sendSubscriptionConfirmationEmail(
    { ...subscription, status: 'active', endDate: endDate.toISOString() },
    planData,
    organizer
  );
  await sendAdminSubscriptionNotification(
    { ...subscription, status: 'active', endDate: endDate.toISOString() },
    planData,
    organizer
  );

  const ownerUserId = organizer?.ownerUserId;
  if (ownerUserId) {
    await notifyUserByPreference({
      recipientUserId: ownerUserId,
      actorUserId: ownerUserId,
      title: 'Subscription activated',
      message: `Your ${planData?.name || 'plan'} subscription is now active.`,
      metadata: {
        subscriptionId: subscription.subscriptionId,
        planId: subscription.planId,
        status: 'active'
      }
    });
  }

  const { data: adminUser } = await supabase
    .from('users')
    .select('userId')
    .eq('role', 'ADMIN')
    .limit(1)
    .maybeSingle();

  if (adminUser?.userId) {
    await notifyUserByPreference({
      recipientUserId: adminUser.userId,
      actorUserId: ownerUserId || adminUser.userId,
      title: 'Organizer purchased a plan',
      message: `${organizer?.organizerName || 'An organizer'} activated ${planData?.name || 'a plan'}.`,
      metadata: {
        subscriptionId: subscription.subscriptionId,
        planId: subscription.planId,
        organizerId: subscription.organizerId,
        status: 'active'
      }
    });
  }

  await logAudit({
    actionType: 'SUBSCRIPTION_ACTIVATED',
    details: {
      subscriptionId: subscription.subscriptionId,
      planId: subscription.planId,
    },
    actorUserId: organizer?.ownerUserId,
    req
  });

  await recordPlanPurchase(subscription, planData, organizer, req);

  return endDate;
};

const sendSubscriptionConfirmationEmail = async (subscription, plan, organizer) => {
  try {
    const { data: owner } = await supabase
      .from('users')
      .select('email, name')
      .eq('userId', organizer.ownerUserId)
      .maybeSingle();

    if (!owner?.email) {
      console.log('[Subscription] No owner email found, skipping notification');
      return;
    }

    const planName = plan?.name || 'Unknown Plan';
    const price = subscription.billingInterval === 'yearly'
      ? plan?.yearlyPrice
      : plan?.monthlyPrice;
    const currency = subscription.currency || 'PHP';
    const endDate = subscription.endDate
      ? new Date(subscription.endDate).toLocaleDateString()
      : 'N/A';

    const subject = `🎉 Subscription Activated: ${planName} Plan`;
    const html = `
      <div style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;\">
        <div style=\"background: linear-gradient(135deg, #38BDF8, #0EA5E9); padding: 30px; border-radius: 12px 12px 0 0;\">
          <h1 style=\"color: white; margin: 0;\">Subscription Activated! ✅</h1>
        </div>
        <div style=\"background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb;\">
          <p>Hi \${owner.name || 'there'},</p>
          <p>Great news! Your subscription has been successfully activated.</p>
          <div style=\"background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;\">
            <h3 style=\"margin-top: 0; color: #374151;\">Subscription Details</h3>
            <p><strong>Plan:</strong> \${planName}</p>
            <p><strong>Billing:</strong> \${subscription.billingInterval === 'yearly' ? 'Yearly' : 'Monthly'}</p>
            <p><strong>Amount:</strong> ₱\${Number(price).toLocaleString()} \${currency}</p>
            <p><strong>Status:</strong> <span style=\"color: green; font-weight: bold;\">Active</span></p>
            <p><strong>Renews On:</strong> \${endDate}</p>
          </div>
          <p>You now have access to all features included in your \${planName} plan.</p>
          <p style=\"color: #6b7280; font-size: 14px; margin-top: 30px;\">
            If you have any questions, please contact our support team.
          </p>
        </div>
      </div>
    `;

    const { data: adminUser } = await supabase.from('users').select('userId').eq('role', 'ADMIN').limit(1).maybeSingle();
    const emailConfig = adminUser?.userId ? await fetchEmailConfig(adminUser.userId) : null;
    const fromAddress = emailConfig?.fromAddress;
    const fromName = emailConfig?.fromName || 'StartupLab';

    const result = await sendSmtpEmail({
      to: owner.email,
      subject,
      html,
      from: fromAddress ? `\${fromName} <\${fromAddress}>` : undefined,
      config: emailConfig || undefined
    });

    if (result.ok) {
      console.log(`[Subscription] Confirmation email sent to \${owner.email}`);
    } else {
      console.log(`[Subscription] Email skipped: \${result.reason}`);
    }
  } catch (error) {
    console.error('[Subscription] Error sending confirmation email:', error.message);
  }
};

const sendAdminSubscriptionNotification = async (subscription, plan, organizer) => {
  try {
    const { data: adminUser } = await supabase
      .from('users')
      .select('userId, email, name')
      .eq('role', 'ADMIN')
      .limit(1)
      .maybeSingle();

    if (!adminUser?.userId) return;

    const emailConfig = await fetchEmailConfig(adminUser.userId);
    const toEmail = adminUser.email || emailConfig?.fromAddress;
    if (!toEmail) return;

    const fromAddress = emailConfig?.fromAddress || toEmail;
    const fromName = emailConfig?.fromName || 'StartupLab';

    const planName = plan?.name || 'Unknown Plan';
    const amount = subscription.billingInterval === 'yearly'
      ? plan?.yearlyPrice
      : plan?.monthlyPrice;

    const subject = `Organizer purchased \${planName}`;
    const html = `
      <div style=\"font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px;\">
        <h2 style=\"margin: 0 0 12px; color: #111;\">New subscription purchase</h2>
        <p style=\"margin: 0 0 16px; color: #444;\">An organizer just completed a plan purchase.</p>
        <ul style=\"padding-left: 16px; color: #333; line-height: 1.5;\">
          <li><strong>Organizer:</strong> \${organizer?.organizerName || organizer?.organizerId}</li>
          <li><strong>Plan:</strong> \${planName}</li>
          <li><strong>Billing:</strong> \${subscription.billingInterval}</li>
          <li><strong>Amount:</strong> ₱\${Number(amount || 0).toLocaleString()} \${subscription.currency || 'PHP'}</li>
          <li><strong>Subscription ID:</strong> \${subscription.subscriptionId}</li>
          <li><strong>Status:</strong> \${subscription.status}</li>
        </ul>
      </div>
    `;

    await sendSmtpEmail({
      to: toEmail,
      subject,
      html,
      from: fromAddress ? `\${fromName} <\${fromAddress}>` : undefined,
      config: emailConfig || undefined
    });
  } catch (error) {
    console.error('[Subscription] Error sending admin notification email:', error.message);
  }
};

const createHitPayPayment = async (req, amount, currency, organizerName, planName, subscriptionId) => {
  const { data: adminUser, error: adminError } = await supabase
    .from('users')
    .select('userId')
    .eq('role', 'ADMIN')
    .limit(1)
    .maybeSingle();

  if (adminError || !adminUser) {
    throw new Error('Platform admin not found. Cannot process payment.');
  }

  const { data: settings, error: settingsError } = await supabase
    .from('settings')
    .select('key, value')
    .eq('user_id', adminUser.userId)
    .in('key', ['hitpay_api_key', 'hitpay_enabled', 'hitpay_mode']);

  if (settingsError || !settings) {
    throw new Error('Failed to fetch platform payment settings');
  }

  const mapped = {};
  settings.forEach(s => mapped[s.key] = s.value);

  if (mapped['hitpay_enabled'] === 'false') {
    throw new Error('Platform payments are currently disabled by admin');
  }

  const encryptedApiKey = mapped['hitpay_api_key'];
  const mode = mapped['hitpay_mode'] || 'sandbox';

  if (!encryptedApiKey) {
    throw new Error('Platform HitPay API Key is not configured in settings');
  }

  const hitPayApiKey = decryptString(encryptedApiKey);
  const hitPayUrl = mode === 'live'
    ? 'https://api.hit-pay.com/v1'
    : 'https://api.sandbox.hit-pay.com/v1';

  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.get('host');
  const dynamicBaseUrl = `\${proto}://\${host}`;
  const serverBaseUrl = (process.env.SERVER_BASE_URL || dynamicBaseUrl).replace(/\/$/, '');
  const webhookUrl = `\${serverBaseUrl}/api/subscriptions/webhook`;

  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  const redirectUrl = `\${frontendUrl}/subscription/success?reference_id=\${encodeURIComponent(subscriptionId)}`;

  const payload = new URLSearchParams();
  payload.set('amount', String(Number(amount || 0)));
  payload.set('currency', currency || 'PHP');
  payload.set('purpose', `Subscription to \${planName} plan`);
  payload.set('reference_number', subscriptionId);
  payload.set('reference_id', subscriptionId);
  payload.set('redirect_url', redirectUrl);
  payload.set('webhook', webhookUrl);
  payload.set('webhook_url', webhookUrl);
  payload.set(
    'expiry_date',
    new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .replace('T', ' ')
      .split('.')[0]
  );
  if (organizerName) payload.set('name', organizerName);

  const response = await fetch(`\${hitPayUrl}/payment-requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-BUSINESS-API-KEY': hitPayApiKey,
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: payload.toString(),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const errorMessage = data?.error || data?.message || 'Unknown HitPay error';
    throw new Error(`HitPay payment creation failed: \${errorMessage}`);
  }

  return data || {};
};

export const getOrganizerSubscription = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { data: organizer, error: orgError } = await supabase
      .from('organizers')
      .select('*')
      .eq('ownerUserId', userId)
      .single();

    if (orgError || !organizer) {
      return res.json({ subscription: null, organizer: null });
    }

    const { data: subscription, error } = await supabase
      .from('organizersubscriptions')
      .select(`
        *,
        plan:plans(
          planId, name, slug, description, 
          monthlyPrice, yearlyPrice, currency,
          features, limits, promotions
        )
      `)
      .eq('organizerId', organizer.organizerId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return res.json({
      subscription: subscription || null,
      organizer: organizer || null
    });
  } catch (error) {
    console.error('getOrganizerSubscription error:', error);
    return res.status(500).json({ error: error.message || 'Failed to load subscription' });
  }
};

export const getAvailablePlans = async (_req, res) => {
  try {
    const { data: plans, error } = await supabase
      .from('plans')
      .select('*')
      .eq('isActive', true)
      .order('monthlyPrice', { ascending: true });

    if (error) throw error;
    return res.json({ plans: plans || [] });
  } catch (error) {
    console.error('getAvailablePlans error:', error);
    return res.status(500).json({ error: error.message || 'Failed to load plans' });
  }
};

export const createSubscription = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { planId, billingInterval } = req.body;
    if (!planId) return res.status(400).json({ error: 'Plan is required' });

    const { data: organizer, error: orgError } = await supabase
      .from('organizers')
      .select('*')
      .eq('ownerUserId', userId)
      .single();

    if (orgError || !organizer) {
      return res.status(404).json({ error: 'Organizer profile not found' });
    }

    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('planId', planId)
      .single();

    if (planError || !plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const priceAmount = billingInterval === 'yearly'
      ? Number(plan.yearlyPrice || 0)
      : Number(plan.monthlyPrice || 0);

    const trialDays = Number(plan.trialDays || 0);
    const trialEndDate = trialDays > 0
      ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    if (priceAmount === 0) {
      const now = new Date();
      const endDate = billingInterval === 'yearly'
        ? new Date(now.setFullYear(now.getFullYear() + 1))
        : new Date(now.setMonth(now.getMonth() + 1));

      const { data: subscription, error: subError } = await supabase
        .from('organizersubscriptions')
        .insert({
          organizerId: organizer.organizerId,
          planId: planId,
          billingInterval,
          status: 'active',
          priceAmount,
          currency: plan.currency || 'PHP',
          startDate: new Date().toISOString(),
          endDate: endDate.toISOString(),
          trialEndDate: trialEndDate,
        })
        .select()
        .single();

      if (subError) throw subError;

      await supabase
        .from('organizers')
        .update({
          currentPlanId: planId,
          subscriptionStatus: 'active',
          planExpiresAt: endDate.toISOString(),
        })
        .eq('organizerId', organizer.organizerId);

      const subForNotify = { ...subscription, plans: plan };
      await sendSubscriptionConfirmationEmail(subForNotify, plan, organizer);
      await sendAdminSubscriptionNotification(subForNotify, plan, organizer);
      await recordPlanPurchase(subscription, plan, organizer, req);

      return res.status(201).json({ subscription, plan, free: true });
    }

    const { data: subscription, error: subError } = await supabase
      .from('organizersubscriptions')
      .insert({
        organizerId: organizer.organizerId,
        planId: planId,
        billingInterval,
        status: trialDays > 0 ? 'trial' : 'pending',
        priceAmount,
        currency: plan.currency || 'PHP',
        startDate: new Date().toISOString(),
        trialEndDate: trialEndDate,
      })
      .select()
      .single();

    if (subError) throw subError;

    const payment = await createHitPayPayment(req, priceAmount, plan.currency, organizer.organizerName, plan.name, subscription.subscriptionId);

    await supabase
      .from('organizersubscriptions')
      .update({
        paymentReference: payment?.url || payment?.payment_url || payment?.checkout_url || payment?.payment_request_url || null,
        hitPayPaymentId: payment?.id || payment?.payment_request_id || payment?.paymentRequestId || null,
      })
      .eq('subscriptionId', subscription.subscriptionId);

    return res.status(201).json({ subscription, paymentUrl: payment?.url || payment?.payment_url || payment?.checkout_url || payment?.payment_request_url });
  } catch (error) {
    console.error('createSubscription error:', error);
    return res.status(500).json({ error: error.message || 'Failed to initiate subscription' });
  }
};

export const handleSubscriptionWebhook = async (req, res) => {
  try {
    const { referenceId, status } = extractSubscriptionWebhookMeta(req.body);
    if (!referenceId) return res.status(400).json({ error: 'Missing reference ID' });

    const subscription = await fetchSubscriptionWithPlan('subscriptionId', referenceId);
    if (!subscription) return res.status(404).json({ error: 'Subscription not found' });

    if (isSuccessfulPaymentStatus(status)) {
      await activateSubscription(subscription, req);
    } else if (isFailedPaymentStatus(status)) {
      await supabase.from('organizersubscriptions').update({ status: 'failed' }).eq('subscriptionId', referenceId);
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('handleSubscriptionWebhook error:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const cancelSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.params;

    if (!subscriptionId || subscriptionId === 'undefined') {
      return res.status(400).json({ error: 'Subscription ID is required' });
    }

    // 1. Find the subscription to get the organizerId
    const { data: sub, error: subFetchError } = await supabase
      .from('organizersubscriptions')
      .select('organizerId')
      .eq('subscriptionId', subscriptionId)
      .maybeSingle();

    if (subFetchError) throw subFetchError;
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });

    const organizerId = sub.organizerId;

    // 2. Update the subscription status
    const { error: updateError } = await supabase
      .from('organizersubscriptions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('subscriptionId', subscriptionId);

    if (updateError) throw updateError;

    // 3. Update the organizer's status
    // We set currentPlanId to null if they are cancelling (returning to a 'no plan' state)
    await supabase
      .from('organizers')
      .update({ 
        subscriptionStatus: 'cancelled',
        currentPlanId: null,
        planExpiresAt: null,
        updated_at: new Date().toISOString()
      })
      .eq('organizerId', organizerId);

    return res.json({ success: true, message: 'Subscription cancelled successfully' });
  } catch (error) {
    console.error('cancelSubscription error:', error);
    return res.status(500).json({ error: error.message || 'Failed to cancel subscription' });
  }
};

export const getSubscriptionHistory = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { data: organizer } = await supabase.from('organizers').select('organizerId').eq('ownerUserId', userId).single();
    if (!organizer) return res.status(404).json({ error: 'Organizer not found' });

    const { data: subscriptions, error } = await supabase
      .from('organizersubscriptions')
      .select('*, plan:plans(*)')
      .eq('organizerId', organizer.organizerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.json({ subscriptions });
  } catch (error) {
    console.error('getSubscriptionHistory error:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const verifySubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const subscription = await fetchSubscriptionWithPlan('subscriptionId', subscriptionId);
    if (!subscription) return res.status(404).json({ error: 'Subscription not found' });

    if (subscription.status === 'active') return res.json({ success: true, status: 'active' });

    const { data: adminUser } = await supabase.from('users').select('userId').eq('role', 'ADMIN').limit(1).maybeSingle();
    const { data: settings } = await supabase.from('settings').select('key, value').eq('user_id', adminUser?.userId).in('key', ['hitpay_api_key', 'hitpay_mode']);
    const mapped = {};
    settings?.forEach(s => mapped[s.key] = s.value);

    const apiKey = decryptString(mapped['hitpay_api_key']);
    const mode = mapped['hitpay_mode'] || 'sandbox';
    const hitPayUrl = mode === 'live' ? 'https://api.hit-pay.com/v1' : 'https://api.sandbox.hit-pay.com/v1';

    const response = await fetch(`\${hitPayUrl}/payment-requests/\${subscription.hitPayPaymentId}`, {
      headers: { 'X-Business-Api-Key': apiKey }
    });

    if (!response.ok) throw new Error('HitPay verification failed');

    const hitPayData = await response.json();
    const hitPayStatus = normalizePaymentStatus(hitPayData?.status || hitPayData?.data?.status);

    if (isSuccessfulPaymentStatus(hitPayStatus)) {
      await activateSubscription(subscription, req);
      return res.json({ success: true, status: 'active' });
    }

    return res.json({ success: false, status: hitPayStatus });
  } catch (error) {
    console.error('verifySubscription error:', error);
    return res.status(500).json({ error: error.message });
  }
};
