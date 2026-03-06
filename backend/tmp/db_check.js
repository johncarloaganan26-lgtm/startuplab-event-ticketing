import supabase from '../database/db.js';

async function check() {
    console.log('--- DB Check ---');
    try {
        // 1. Check Admins
        const { data: admins, error: adminErr } = await supabase
            .from('users')
            .select('userId, email, role')
            .eq('role', 'ADMIN');

        if (adminErr) {
            console.error('Admin Fetch Error:', adminErr.message);
        } else {
            console.log('Admins found:', admins?.length || 0);
            for (const admin of (admins || [])) {
                const { data: settings } = await supabase
                    .from('settings')
                    .select('key, value')
                    .eq('user_id', admin.userId);
                console.log(`Settings for Admin ${admin.email} (${admin.userId}):`, settings?.length ? settings.map(s => s.key) : 'NONE');
            }
        }

        // 2. Check Organizers
        const { data: orgs, error: orgErr } = await supabase
            .from('organizers')
            .select('organizerId, organizerName, ownerUserId, emailOptIn');

        if (orgErr) {
            console.error('Organizer Fetch Error:', orgErr.message);
        } else {
            console.log('Organizers found:', orgs?.length || 0);
            for (const org of (orgs || [])) {
                const { data: settings } = await supabase
                    .from('settings')
                    .select('key, value')
                    .eq('user_id', org.ownerUserId);
                console.log(`Settings for ${org.organizerName} (${org.ownerUserId}):`, settings?.length ? settings.map(s => s.key) : 'NONE');
            }
        }

        // 3. User Notification Settings
        const { data: userNotifs, error: notifErr } = await supabase
            .from('user_notification_settings')
            .select('user_id, email_notifications_enabled, notification_email');

        if (notifErr) {
            console.warn('Note: user_notification_settings table might missing or empty.');
        } else {
            console.log('User Notification Settings found:', userNotifs?.length || 0);
            for (const setting of (userNotifs || [])) {
                console.log(`User ${setting.user_id}: Enabled=${setting.email_notifications_enabled}, NotifyEmail=${setting.notification_email}`);
            }
        }
    } catch (ex) {
        console.error('Global Error:', ex.message);
    }

    process.exit(0);
}

check().catch(err => {
    console.error(err);
    process.exit(1);
});
