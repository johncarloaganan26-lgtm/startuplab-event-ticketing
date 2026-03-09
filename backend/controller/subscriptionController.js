import supabase from '../database/db.js';
import { logAudit } from '../utils/auditLogger.js';
import { decryptString } from '../utils/encryption.js';
import { sendSmtpEmail } from '../utils/smtpMailer.js';

// Helper to send subscription confirmation email
const sendSubscriptionConfirmationEmail = async (subscription, plan, organizer) => {
  try {
    // Get organizer's owner email
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
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #38BDF8, #0EA5E9); padding: 30px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0;">Subscription Activated! ✅</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb;">
          <p>Hi ${owner.name || 'there'},</p>
          <p>Great news! Your subscription has been successfully activated.</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
            <h3 style="margin-top: 0; color: #374151;">Subscription Details</h3>
            <p><strong>Plan:</strong> ${planName}</p>
            <p><strong>Billing:</strong> ${subscription.billingInterval === 'yearly' ? 'Yearly' : 'Monthly'}</p>
            <p><strong>Amount:</strong> ₱${Number(price).toLocaleString()} ${currency}</p>
            <p><strong>Status:</strong> <span style="color: green; font-weight: bold;">Active</span></p>
            <p><strong>Renews On:</strong> ${endDate}</p>
          </div>
          <p>You now have access to all features included in your ${planName} plan.</p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            If you have any questions, please contact our support team.
          </p>
        </div>
      </div>
    `;

    const result = await sendSmtpEmail({
      to: owner.email,
      subject,
      html
    });

    if (result.ok) {
      console.log(`[Subscription] Confirmation email sent to ${owner.email}`);
    } else {
      console.log(`[Subscription] Email skipped: ${result.reason}`);
    }
  } catch (error) {
    console.error('[Subscription] Error sending confirmation email:', error.message);
  }
};

// Helper to get HitPay payment URL using Admin's configuration from DB
const createHitPayPayment = async (amount, currency, organizerName, planName, subscriptionId) => {
  // 1. Get the admin's user ID
  const { data: adminUser, error: adminError } = await supabase
    .from('users')
    .select('userId')
    .eq('role', 'ADMIN')
    .limit(1)
    .maybeSingle();

  if (adminError || !adminUser) {
    throw new Error('Platform admin not found. Cannot process payment.');
  }

  // 2. Fetch admin's HitPay settings
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

  const baseUrl = process.env.BACKEND_URL || process.env.SERVER_BASE_URL || 'http://localhost:5000';
  const webhookUrl = `${baseUrl.replace(/\/$/, '')}/api/subscriptions/webhook`;
  const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/#/subscription/success`;

  console.log('📍 [Subscription] Webhook URL for HitPay dashboard:', webhookUrl);

  const payload = {
    amount: amount,
    currency: currency || 'PHP',
    description: `Subscription to ${planName} plan`,
    reference_id: subscriptionId,
    redirect_url: redirectUrl,
    webhook_url: webhookUrl,
    expiry_date: new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .replace('T', ' ')
      .split('.')[0], // 24 hours - Format: YYYY-MM-DD HH:mm:ss
  };

  const response = await fetch(`${hitPayUrl}/payment-requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Business-Api-Key': hitPayApiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HitPay payment creation failed: ${error}`);
  }

  return response.json();
};

// Get current subscription for organizer
export const getOrganizerSubscription = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // First find the organizer for this user
    const { data: organizer, error: orgError } = await supabase
      .from('organizers')
      .select('*')
      .eq('ownerUserId', userId)
      .single();

    if (orgError || !organizer) {
      return res.json({
        subscription: null,
        organizer: null
      });
    }

    const { data: subscription, error } = await supabase
      .from('organizersubscriptions')
      .select(`
        *,
        plan:plans(
          planId, name, slug, description, 
          monthlyPrice, yearlyPrice, currency,
          features, limits
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

// Get available plans for subscription
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

// Initiate subscription with payment
export const createSubscription = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { planId, billingInterval } = req.body;
    if (!planId) return res.status(400).json({ error: 'Plan is required' });

    // Get organizer's info
    const { data: organizer, error: orgError } = await supabase
      .from('organizers')
      .select('*')
      .eq('ownerUserId', userId)
      .single();

    if (orgError || !organizer) {
      return res.status(404).json({ error: 'Organizer profile not found' });
    }

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('planId', planId)
      .single();

    if (planError || !plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const priceAmount = billingInterval === 'yearly'
      ? Number(plan.yearlyPrice)
      : Number(plan.monthlyPrice);

    // If price is 0, create free subscription
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
        })
        .select()
        .single();

      if (subError) throw subError;

      // Update organizer
      await supabase
        .from('organizers')
        .update({
          currentPlanId: planId,
          subscriptionStatus: 'active',
          planExpiresAt: endDate.toISOString(),
        })
        .eq('organizerId', organizer.organizerId);

      return res.status(201).json({
        subscription,
        plan,
        free: true
      });
    }

    // Create pending subscription
    const { data: subscription, error: subError } = await supabase
      .from('organizersubscriptions')
      .insert({
        organizerId: organizer.organizerId,
        planId: planId,
        billingInterval,
        status: 'pending',
        priceAmount,
        currency: plan.currency || 'PHP',
        startDate: new Date().toISOString(),
      })
      .select()
      .single();

    if (subError) throw subError;

    // Create HitPay payment
    const payment = await createHitPayPayment(
      priceAmount,
      plan.currency || 'PHP',
      organizer.organizerName,
      plan.name,
      subscription.subscriptionId
    );

    // Update subscription with payment reference
    await supabase
      .from('organizersubscriptions')
      .update({
        paymentReference: payment?.url || payment?.payment_request_url,
        hitPayPaymentId: payment?.id || payment?.payment_request_id,
      })
      .eq('subscriptionId', subscription.subscriptionId);

    await logAudit({
      actionType: 'SUBSCRIPTION_INITIATED',
      details: {
        subscriptionId: subscription.subscriptionId,
        planId,
        billingInterval,
        organizerId: organizer.organizerId
      },
      req
    });

    return res.status(201).json({
      subscription,
      plan,
      paymentUrl: payment?.url || payment?.payment_request_url,
    });
  } catch (error) {
    console.error('createSubscription error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create subscription' });
  }
};

// Handle HitPay webhook for subscription payments
export const handleSubscriptionWebhook = async (req, res) => {
  try {
    const { reference_id, status } = req.body;

    console.log('📦 [Subscription Webhook] Received webhook:', { reference_id, status, body: req.body });

    if (!reference_id) {
      return res.status(400).json({ error: 'Missing reference_id' });
    }

    // Find subscription
    const { data: subscription, error } = await supabase
      .from('organizersubscriptions')
      .select('*, plans!inner(*)')
      .eq('subscriptionId', reference_id)
      .single();

    if (error || !subscription) {
      console.error('❌ Subscription not found:', reference_id);
      return res.status(404).json({ error: 'Subscription not found' });
    }

    console.log('📋 [Subscription Webhook] Found subscription:', subscription.subscriptionId, 'Current status:', subscription.status, 'Webhook status:', status);

    if (status === 'completed' || status === 'paid' || status === 'succeeded' || status === 'payment_successful') {
      console.log('✅ [Subscription Webhook] Payment completed, activating subscription...');
      // Calculate end date
      const now = new Date();
      const endDate = subscription.billingInterval === 'yearly'
        ? new Date(now.setFullYear(now.getFullYear() + 1))
        : new Date(now.setMonth(now.getMonth() + 1));

      // Update subscription status
      await supabase
        .from('organizersubscriptions')
        .update({
          status: 'active',
          endDate: endDate.toISOString(),
        })
        .eq('subscriptionId', subscription.subscriptionId);

      // Update organizer
      await supabase
        .from('organizers')
        .update({
          currentPlanId: subscription.planId,
          subscriptionStatus: 'active',
          planExpiresAt: endDate.toISOString(),
        })
        .eq('organizerId', subscription.organizerId);

      // Get organizer details for email
      const { data: organizer } = await supabase
        .from('organizers')
        .select('*')
        .eq('organizerId', subscription.organizerId)
        .maybeSingle();

      // Send confirmation email
      await sendSubscriptionConfirmationEmail(
        { ...subscription, status: 'active', endDate: endDate },
        subscription.plans,
        organizer
      );

      await logAudit({
        actionType: 'SUBSCRIPTION_ACTIVATED',
        details: {
          subscriptionId: subscription.subscriptionId,
          planId: subscription.planId,
        },
        req: { user: { id: subscription.organizerId } }
      });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('handleSubscriptionWebhook error:', error);
    return res.status(500).json({ error: error.message || 'Webhook processing failed' });
  }
};

// Cancel subscription
export const cancelSubscription = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { subscriptionId } = req.params;

    // Get organizer
    const { data: organizer } = await supabase
      .from('organizers')
      .select('organizerId')
      .eq('ownerUserId', userId)
      .single();

    if (!organizer) {
      return res.status(404).json({ error: 'Organizer not found' });
    }

    // 1. Update subscription status
    const { error: subError } = await supabase
      .from('organizersubscriptions')
      .update({
        status: 'cancelled',
        cancelAtPeriodEnd: true,
        updated_at: new Date().toISOString()
      })
      .eq('subscriptionId', subscriptionId)
      .eq('organizerId', organizer.organizerId);

    if (subError) throw subError;

    // 2. Reset organizer's active plan immediately
    const { error: orgError } = await supabase
      .from('organizers')
      .update({
        currentPlanId: null,
        subscriptionStatus: 'cancelled',
        planExpiresAt: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('organizerId', organizer.organizerId);

    if (orgError) throw orgError;

    await logAudit({
      actionType: 'SUBSCRIPTION_CANCELLED_IMMEDIATE',
      details: { subscriptionId },
      req
    });

    return res.json({ success: true, message: 'Subscription has been cancelled and features have been revoked.' });
  } catch (error) {
    console.error('cancelSubscription error:', error);
    return res.status(500).json({ error: error.message || 'Failed to cancel subscription' });
  }
};

// Get subscription history
export const getSubscriptionHistory = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    // Get organizer
    const { data: organizer } = await supabase
      .from('organizers')
      .select('organizerId')
      .eq('ownerUserId', userId)
      .single();

    if (!organizer) {
      return res.status(404).json({ error: 'Organizer not found' });
    }

    const { data: subscriptions, error } = await supabase
      .from('organizersubscriptions')
      .select(`
        *,
        plan:plans(planId, name, slug, description, monthlyPrice, yearlyPrice)
      `)
      .eq('organizerId', organizer.organizerId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json({ subscriptions: subscriptions || [] });
  } catch (error) {
    console.error('getSubscriptionHistory error:', error);
    return res.status(500).json({ error: error.message || 'Failed to load subscription history' });
  }
};
// Verify subscription status (manually check with HitPay if webhook is delayed)
export const verifySubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const userId = req.user?.id;

    console.log(`🔍 [Subscription] Verifying status for ${subscriptionId}, userId: ${userId || 'none'}`);

    // 1. Get the subscription record
    const { data: subscription, error: subError } = await supabase
      .from('organizersubscriptions')
      .select('*, plan:plans(*)')
      .eq('subscriptionId', subscriptionId)
      .single();

    if (subError || !subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // If already active, just return success
    if (subscription.status === 'active') {
      return res.json({ success: true, status: 'active', message: 'Subscription is already active' });
    }

    // 2. Fetch the HitPay payment status
    if (!subscription.hitPayPaymentId) {
      return res.json({ success: false, status: subscription.status, message: 'No HitPay ID associated' });
    }

    // Get Admin config for HitPay
    const { data: adminUser } = await supabase.from('users').select('userId').eq('role', 'ADMIN').limit(1).maybeSingle();
    const { data: settings } = await supabase.from('settings').select('key, value').eq('user_id', adminUser?.userId).in('key', ['hitpay_api_key', 'hitpay_mode']);

    const mapped = {};
    settings?.forEach(s => mapped[s.key] = s.value);

    const apiKey = decryptString(mapped['hitpay_api_key']);
    const mode = mapped['hitpay_mode'] || 'sandbox';
    const hitPayUrl = mode === 'live' ? 'https://api.hit-pay.com/v1' : 'https://api.sandbox.hit-pay.com/v1';

    const response = await fetch(`${hitPayUrl}/payment-requests/${subscription.hitPayPaymentId}`, {
      headers: { 'X-Business-Api-Key': apiKey }
    });

    if (!response.ok) {
      throw new Error(`HitPay verification failed: ${await response.text()}`);
    }

    const hitPayData = await response.json();
    const hitPayStatus = hitPayData.status; // 'completed', 'paid', 'pending', etc.

    if (hitPayStatus === 'completed' || hitPayStatus === 'paid' || hitPayStatus === 'succeeded' || hitPayStatus === 'payment_successful') {
      // 3. Update the database (similar to webhook)
      const endDate = new Date();
      if (subscription.billingInterval === 'monthly') {
        endDate.setMonth(endDate.getMonth() + 1);
      } else {
        endDate.setFullYear(endDate.getFullYear() + 1);
      }

      // Update subscription
      await supabase
        .from('organizersubscriptions')
        .update({
          status: 'active',
          startDate: new Date().toISOString(),
          endDate: endDate.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('subscriptionId', subscriptionId);

      // Update organizer
      await supabase
        .from('organizers')
        .update({
          currentPlanId: subscription.planId,
          subscriptionStatus: 'active',
          planExpiresAt: endDate.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('organizerId', subscription.organizerId);

      // Get organizer details for email
      const { data: organizer } = await supabase
        .from('organizers')
        .select('*')
        .eq('organizerId', subscription.organizerId)
        .maybeSingle();

      // Send confirmation email
      const updatedSubscription = { ...subscription, status: 'active', endDate: endDate };
      await sendSubscriptionConfirmationEmail(updatedSubscription, subscription.plan, organizer);

      return res.json({ success: true, status: 'active', message: 'Subscription activated' });
    }

    return res.json({ success: false, status: hitPayStatus, message: `Status is still ${hitPayStatus}` });
  } catch (error) {
    console.error('verifySubscription error:', error);
    return res.status(500).json({ error: error.message || 'Failed to verify subscription' });
  }
};
