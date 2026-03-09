/**
 * Test Script: Full Subscription Flow Test
 * 
 * Tests the complete flow:
 * 1. Check existing pending subscriptions
 * 2. Verify if HitPay has payment status
 * 3. Check subscription status in database
 */

import supabase from './database/db.js';

async function testFullFlow() {
  console.log('\n=== FULL SUBSCRIPTION FLOW TEST ===\n');
  
  // Step 1: Get all subscriptions with their payment IDs
  const { data: subscriptions, error } = await supabase
    .from('organizersubscriptions')
    .select('subscriptionId, status, hitPayPaymentId, priceAmount, planId, organizerId')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.log('❌ Error fetching subscriptions:', error.message);
    return;
  }

  console.log(`Found ${subscriptions?.length || 0} subscriptions:\n`);
  
  for (const sub of subscriptions || []) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Subscription ID: ${sub.subscriptionId}`);
    console.log(`Status: ${sub.status}`);
    console.log(`Price: ₱${sub.priceAmount}`);
    console.log(`HitPay Payment ID: ${sub.hitPayPaymentId || 'NOT SET'}`);
    console.log(`Plan ID: ${sub.planId}`);
    console.log(`Organizer ID: ${sub.organizerId}`);
    
    // If has HitPay ID and is pending, try to verify
    if (sub.hitPayPaymentId && sub.status === 'pending') {
      console.log('\n🔍 This subscription is PENDING with a HitPay ID.');
      console.log('   Testing verify endpoint...\n');
      
      try {
        const response = await fetch(`http://localhost:5000/api/subscriptions/verify/${sub.subscriptionId}`);
        const result = await response.json();
        console.log('   Verify Response:', JSON.stringify(result, null, 2));
      } catch (e) {
        console.log('   Error calling verify:', e.message);
      }
    }
    console.log('');
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📊 Summary:');
  const statusCounts = {};
  subscriptions?.forEach(s => {
    statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
  });
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });
  
  console.log('\n✅ Test complete!');
}

testFullFlow().catch(console.error);
