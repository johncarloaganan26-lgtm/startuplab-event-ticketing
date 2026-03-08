import supabase from './database/db.js';

async function testQuery() {
    const { data: orgRow } = await supabase.from('organizers').select('organizerId, ownerUserId').limit(1).single();
    const ownerUserId = orgRow.ownerUserId;

    const { data: staffBatch, error: staffErr } = await supabase
        .from('users')
        .select('userId, email, canreceivenotifications, employerId')
        .eq('employerId', ownerUserId)
        .eq('role', 'STAFF');

    console.log("Staff Batch:", staffBatch);
    console.log("Staff Error:", staffErr);
}

testQuery();
