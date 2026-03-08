import supabase from './database/db.js';

async function fixOrganizer() {
  // Get the latest active subscription
  const { data: sub } = await supabase
    .from('organizersubscriptions')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (!sub) {
    console.log('No active subscription found!');
    return;
  }

  console.log('Latest active subscription:', sub.subscriptionId);
  console.log('Plan ID:', sub.planId);

  // Update organizer
  const { data: org } = await supabase
    .from('organizers')
    .select('*')
    .eq('organizerId', sub.organizerId)
    .single();
  
  console.log('Organizer before:', JSON.stringify({
    subscriptionStatus: org?.subscriptionStatus,
    currentPlanId: org?.currentPlanId
  }));

  await supabase
    .from('organizers')
    .update({
      currentPlanId: sub.planId,
      subscriptionStatus: 'active',
      planExpiresAt: sub.endDate || new Date(Date.now() + 30*24*60*60*1000).toISOString()
    })
    .eq('organizerId', sub.organizerId);

  const { data: org2 } = await supabase
    .from('organizers')
    .select('*')
    .eq('organizerId', sub.organizerId)
    .single();
  
  console.log('Organizer after:', JSON.stringify({
    subscriptionStatus: org2?.subscriptionStatus,
    currentPlanId: org2?.currentPlanId,
    planExpiresAt: org2?.planExpiresAt
  }));
  
  console.log('✅ Organizer updated to show active subscription!');
}

fixOrganizer().catch(console.error);
