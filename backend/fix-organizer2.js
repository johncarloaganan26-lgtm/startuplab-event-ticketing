import supabase from './database/db.js';

async function fixOrganizer() {
  // Get ALL subscriptions with status
  const { data: subs } = await supabase
    .from('organizersubscriptions')
    .select('subscriptionId, status, planId, organizerId')
    .order('created_at', { ascending: false })
    .limit(20);

  console.log('All subscriptions:');
  console.log(JSON.stringify(subs, null, 2));

  // Get unique statuses
  const statuses = [...new Set(subs?.map(s => s.status))];
  console.log('\nUnique statuses:', statuses);
}

fixOrganizer().catch(console.error);
