import supabase from './backend/database/db.js';

async function check() {
    console.log('--- DB Check ---');

    // 1. Check Admins
    const { data: admins } = await supabase
        .from('users')
        .select('userId, email, role')
        .eq('role', 'ADMIN');

    console.log('Admins found:', admins);

    if (admins && admins.length > 0) {
        for (const admin of admins) {
            const { data: settings } = await supabase
                .from('settings')
                .select('key, value')
                .eq('user_id', admin.userId);
            console.log(`Settings for Admin ${admin.email} (${admin.userId}):`, settings?.length ? settings.map(s => s.key) : 'NONE');
        }
    }

    // 2. Check Organizers
    const { data: orgs } = await supabase
        .from('organizers')
        .select('organizerId, organizerName, ownerUserId, emailOptIn');
    console.log('Organizers found:', orgs?.length || 0);

    if (orgs && orgs.length > 0) {
        const firstOrg = orgs[0];
        const { data: settings } = await supabase
            .from('settings')
            .select('key, value')
            .eq('user_id', firstOrg.ownerUserId);
        console.log(`Settings for First Org Owner ${firstOrg.organizerName} (${firstOrg.ownerUserId}):`, settings?.length ? settings.map(s => s.key) : 'NONE');
    }

    process.exit(0);
}

check().catch(err => {
    console.error(err);
    process.exit(1);
});
