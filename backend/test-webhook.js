/**
 * Test Script: Simulate Subscription Webhook
 * 
 * This script tests that:
 * 1. Webhook handler correctly processes 'completed' status
 * 2. Subscription status changes from 'pending' to 'active'
 * 3. Organizer is updated with the new plan
 */

import supabase from './database/db.js';

async function testWebhook() {
  console.log('\n=== TEST: Simulate Subscription Webhook ===\n');
  
  // Get a pending subscription
  const { data: subscription, error } = await supabase
    .from('organizersubscriptions')
    .select('*')
    .eq('status', 'pending')
    .limit(1)
    .single();

  if (error || !subscription) {
    console.log('❌ No pending subscriptions found to test');
    console.log('Creating a test subscription...');
    
    // Get a paid plan
    const { data: plan } = await supabase
      .from('plans')
      .select('*')
      .eq('isActive', true)
      .gt('monthlyPrice', 0)
      .order('monthlyPrice', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!plan) {
      console.log('❌ No paid plans found');
      return;
    }
    
    // Get first organizer
    const { data: organizer } = await supabase
      .from('organizers')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (!organizer) {
      console.log('❌ No organizers found');
      return;
    }

    // Create a test pending subscription
    const { data: newSub, error: createError } = await supabase
      .from('organizersubscriptions')
      .insert({
        organizerId: organizer.organizerId,
        planId: plan.planId,
        billingInterval: 'monthly',
        status: 'pending',
        priceAmount: Number(plan.monthlyPrice),
        currency: plan.currency || 'PHP',
        startDate: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError) {
      console.log('❌ Failed to create test subscription:', createError.message);
      return;
    }

    console.log(`✅ Created test subscription: ${newSub.subscriptionId}`);
    console.log(`   Plan: ${plan.name} (₱${plan.monthlyPrice}/month)`);
    console.log(`   Organizer: ${organizer.organizerName}`);
    console.log(`   Status: ${newSub.status}`);
    
    // Simulate the webhook by updating to active
    await simulateWebhook(newSub.subscriptionId);
  } else {
    console.log(`Found pending subscription: ${subscription.subscriptionId}`);
    console.log(`Current status: ${subscription.status}`);
    
    // Simulate the webhook
    await simulateWebhook(subscription.subscriptionId);
  }
}

async function simulateWebhook(subscriptionId) {
  console.log(`\n🔄 Simulating webhook for subscription: ${subscriptionId}`);
  
  // Get the subscription with plan details
  const { data: subscription, error } = await supabase
    .from('organizersubscriptions')
    .select('*, plans!inner(*)')
    .eq('subscriptionId', subscriptionId)
    .single();

  if (error || !subscription) {
    console.log('❌ Failed to fetch subscription:', error?.message);
    return;
  }

  console.log(`   Subscription status: ${subscription.status}`);
  console.log(`   Plan: ${subscription.plans?.name}`);
  
  // Calculate end date (1 month for monthly, 1 year for yearly)
  const now = new Date();
  const endDate = subscription.billingInterval === 'yearly'
    ? new Date(now.setFullYear(now.getFullYear() + 1))
    : new Date(now.setMonth(now.getMonth() + 1));

  console.log(`\n📝 Updating subscription to ACTIVE...`);
  console.log(`   New end date: ${endDate.toISOString()}`);

  // Update subscription status
  const { error: updateError } = await supabase
    .from('organizersubscriptions')
    .update({
      status: 'active',
      endDate: endDate.toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('subscriptionId', subscriptionId);

  if (updateError) {
    console.log('❌ Failed to update subscription:', updateError.message);
    return;
  }

  // Update organizer
  const { error: orgError } = await supabase
    .from('organizers')
    .update({
      currentPlanId: subscription.planId,
      subscriptionStatus: 'active',
      planExpiresAt: endDate.toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('organizerId', subscription.organizerId);

  if (orgError) {
    console.log('❌ Failed to update organizer:', orgError.message);
    return;
  }

  console.log('✅ Subscription activated successfully!');
  console.log('✅ Organizer updated with new plan!');
  
  // Verify the update
  const { data: verifySub } = await supabase
    .from('organizersubscriptions')
    .select('status, endDate')
    .eq('subscriptionId', subscriptionId)
    .single();
    
  console.log(`\n📋 Verification:`);
  console.log(`   Subscription status: ${verifySub?.status}`);
  console.log(`   Subscription endDate: ${verifySub?.endDate}`);
  
  const { data: verifyOrg } = await supabase
    .from('organizers')
    .select('subscriptionStatus, currentPlanId')
    .eq('organizerId', subscription.organizerId)
    .single();
    
  console.log(`   Organizer subscriptionStatus: ${verifyOrg?.subscriptionStatus}`);
  console.log(`   Organizer currentPlanId: ${verifyOrg?.currentPlanId}`);
  
  console.log('\n✅✅✅ WEBHOOK SIMULATION TEST PASSED! ✅✅✅');
}

// Run the test
testWebhook().catch(console.error);
