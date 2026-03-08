import supabase from './database/db.js';

async function checkSubscriptions() {
  const { data, error } = await supabase
    .from('organizersubscriptions')
    .select('*')
    .limit(10);

  console.log('=== Subscriptions ===');
  console.log('Data:', JSON.stringify(data, null, 2));
  console.log('Error:', error);

  // Also check organizers
  const { data: organizers } = await supabase
    .from('organizers')
    .select('organizerId, organizerName, currentPlanId, subscriptionStatus')
    .limit(5);

  console.log('\n=== Organizers ===');
  console.log(JSON.stringify(organizers, null, 2));
}

checkSubscriptions().catch(console.error);
