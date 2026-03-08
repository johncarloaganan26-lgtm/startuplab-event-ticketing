/**
 * Script to manually verify and activate pending subscriptions
 * Use this if HitPay webhook is not working
 */

import supabase from './database/db.js';
import { decryptString } from './utils/encryption.js';
import { sendSmtpEmail } from './utils/smtpMailer.js';

async function activatePendingSubscriptions() {
  console.log('=== Checking pending subscriptions ===\n');

  // Get pending subscriptions with HitPay payment IDs
  const { data: subscriptions, error } = await supabase
    .from('organizersubscriptions')
    .select('*')
    .eq('status', 'pending')
    .not('hitPayPaymentId', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching subscriptions:', error);
    return;
  }

  if (!subscriptions || subscriptions.length === 0) {
    console.log('No pending subscriptions with payment IDs found.');
    return;
  }

  console.log(`Found ${subscriptions.length} pending subscription(s)\n`);

  // Get admin HitPay settings
  const { data: adminUser } = await supabase
    .from('users')
    .select('userId')
    .eq('role', 'ADMIN')
    .limit(1)
    .maybeSingle();

  const { data: settings } = await supabase
    .from('settings')
    .select('key, value')
    .eq('user_id', adminUser?.userId)
    .in('key', ['hitpay_api_key', 'hitpay_mode']);

  const mapped = {};
  settings?.forEach(s => mapped[s.key] = s.value);

  const apiKey = decryptString(mapped['hitpay_api_key']);
  const mode = mapped['hitpay_mode'] || 'sandbox';
  const hitPayUrl = mode === 'live' 
    ? 'https://api.hit-pay.com/v1' 
    : 'https://api.sandbox.hit-pay.com/v1';

  console.log(`Checking HitPay in ${mode} mode...\n`);

  for (const sub of subscriptions) {
    console.log(`Subscription: ${sub.subscriptionId}`);
    console.log(`  HitPay ID: ${sub.hitPayPaymentId}`);
    console.log(`  Price: ₱${sub.priceAmount} ${sub.currency}`);

    try {
      // Check payment status with HitPay
      const response = await fetch(`${hitPayUrl}/payment-requests/${sub.hitPayPaymentId}`, {
        headers: { 'X-Business-Api-Key': apiKey }
      });

      if (!response.ok) {
        console.log(`  ❌ HitPay API error: ${response.status}`);
        continue;
      }

      const hitPayData = await response.json();
      const status = hitPayData.status;
      
      console.log(`  Payment Status: ${status}`);

      if (status === 'completed' || status === 'paid') {
        // Calculate end date
        const endDate = new Date();
        if (sub.billingInterval === 'yearly') {
          endDate.setFullYear(endDate.getFullYear() + 1);
        } else {
          endDate.setMonth(endDate.getMonth() + 1);
        }

        // Get plan details
        const { data: plan } = await supabase
          .from('plans')
          .select('*')
          .eq('planId', sub.planId)
          .single();

        // Update subscription
        await supabase
          .from('organizersubscriptions')
          .update({
            status: 'active',
            endDate: endDate.toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('subscriptionId', sub.subscriptionId);

        // Update organizer
        await supabase
          .from('organizers')
          .update({
            currentPlanId: sub.planId,
            subscriptionStatus: 'active',
            planExpiresAt: endDate.toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('organizerId', sub.organizerId);

        console.log(`  ✅ Activated! Expires: ${endDate.toLocaleDateString()}`);

        // Send confirmation email
        const { data: organizer } = await supabase
          .from('organizers')
          .select('*')
          .eq('organizerId', sub.organizerId)
          .single();

        const { data: owner } = await supabase
          .from('users')
          .select('email, name')
          .eq('userId', organizer.ownerUserId)
          .maybeSingle();

        if (owner?.email) {
          const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #38BDF8, #0EA5E9); padding: 30px; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0;">Subscription Activated! ✅</h1>
              </div>
              <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb;">
                <p>Hi ${owner.name || 'there'},</p>
                <p>Great news! Your subscription has been successfully activated.</p>
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
                  <p><strong>Plan:</strong> ${plan?.name || 'Unknown'}</p>
                  <p><strong>Billing:</strong> ${sub.billingInterval === 'yearly' ? 'Yearly' : 'Monthly'}</p>
                  <p><strong>Status:</strong> <span style="color: green; font-weight: bold;">Active</span></p>
                  <p><strong>Renews On:</strong> ${endDate.toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          `;

          await sendSmtpEmail({
            to: owner.email,
            subject: `🎉 Subscription Activated: ${plan?.name} Plan`,
            html
          });
          
          console.log(`  📧 Confirmation email sent to ${owner.email}`);
        }

      } else {
        console.log(`  ⚠️  Payment not completed yet (status: ${status})`);
      }

    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`);
    }

    console.log('');
  }
}

activatePendingSubscriptions().catch(console.error);
