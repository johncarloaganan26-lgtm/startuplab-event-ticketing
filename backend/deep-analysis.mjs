
import supabase from './database/db.js';
import { getSmtpConfig, notifyUserByPreference } from './utils/notificationService.js';
import { sendSmtpEmail } from './utils/smtpMailer.js';

async function deepAnalyze() {
    console.log('--- 🛡️ DEEP SMTP ANALYSIS ---');

    // 1. Get the target Organizer and User
    const { data: org, error: orgErr } = await supabase.from('organizers').select('organizerId, ownerUserId, organizerName').limit(1).maybeSingle();
    if (orgErr || !org) {
        console.error('❌ Cannot find organizer:', orgErr?.message || 'NULL');
        return;
    }
    console.log('✅ Organizer found:', org.organizerName, 'Owned by:', org.ownerUserId);

    // 2. Clear then Seed REAL Fallback (Superadmin)
    const adminId = 'd6e6eeaa-c793-44bd-8698-c42044cb0fb1';
    const realKeys = [
        { user_id: adminId, key: 'email_host', value: 'smtp.gmail.com' },
        { user_id: adminId, key: 'email_port', value: '587' },
        { user_id: adminId, key: 'email_username', value: 'johncarloaganan.startuplab@gmail.com' },
        { user_id: adminId, key: 'email_password', value: 'bevkjbvqdxqxqccf' },
        { user_id: adminId, key: 'email_encryption', value: 'TLS' },
        { user_id: adminId, key: 'email_from_address', value: 'johncarloaganan.startuplab@gmail.com' },
        { user_id: adminId, key: 'email_from_name', value: 'StartupLab System' }
    ];
    const { error: upsertErr } = await supabase.from('settings').upsert(realKeys, { onConflict: 'user_id,key' });
    if (upsertErr) {
        console.error('❌ Failed to seed Superadmin settings:', upsertErr.message);
        return;
    }
    console.log('✅ Superadmin settings seeded correctly.');

    // 3. Test getSmtpConfig for this organizer
    console.log('🔍 Testing resolution for organizer', org.organizerId);
    const config = await getSmtpConfig(org.organizerId);
    if (!config) {
        console.error('❌ Resolution returned NULL! Something is wrong in getSmtpConfig fallback.');
    } else {
        console.log('✅ Resolution reached:', config.smtpHost, 'User:', config.smtpUser);
    }

    // 4. Test notification result
    console.log('📧 Triggering notifyUserByPreference...');
    const result = await notifyUserByPreference({
        recipientUserId: org.ownerUserId,
        recipientFallbackEmail: 'recipient@test.com',
        actorUserId: 'df413e5a-f873-4953-8ef5-02fb3bb84246', // Simulate some other user
        organizerId: org.organizerId,
        type: 'EVENT_LIKED',
        title: 'Testing professional SMTP fallback',
        message: 'If you receive this, the system is resolving and sending correctly.',
        emailSubject: '🔥 Deep Analysis SMTP Result'
    });

    console.log('📊 Result of notifyUserByPreference:', JSON.stringify(result, null, 2));

    if (result.email) {
        console.log('🎉 EMAIL DELIVERED according to Nodemailer.');
    } else {
        console.log('❌ EMAIL FAILED according to Nodemailer.');
    }
}

deepAnalyze().catch(console.error);
