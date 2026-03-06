import supabase from '../database/db.js';

async function checkNotifications() {
    console.log('--- Notifications Table (Last 5) ---');
    try {
        const { data: notifs, error } = await supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) {
            console.error('Error:', error.message);
        } else {
            console.log(notifs || 'No notifications found');
        }

        console.log('--- User Opt-In (Check if anyone is enabled) ---');
        const { data: users, error: userError } = await supabase
            .from('user_notification_settings')
            .select('user_id, email_notifications_enabled, notification_email');

        if (userError) {
            console.error('User Preference Error:', userError.message);
        } else {
            console.log('Opt-In Settings:', users);
        }
    } catch (ex) {
        console.error('Global Error:', ex.message);
    }
    process.exit(0);
}

checkNotifications().catch(err => { console.error(err); process.exit(1); });
