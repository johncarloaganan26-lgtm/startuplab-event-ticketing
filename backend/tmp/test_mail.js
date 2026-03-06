import { sendSmtpEmail } from '../utils/smtpMailer.js';
import { getSmtpConfig } from '../utils/notificationService.js';
import supabase from '../database/db.js';

async function testMail() {
    console.log('--- SMTP Test ---');

    // Try to find a recipient
    const { data: users } = await supabase.from('users').select('userId, email').limit(1);
    if (!users?.length) {
        console.error('No users to test with');
        process.exit(1);
    }
    const recipient = users[0];
    console.log(`Testing with recipient: ${recipient.email} (${recipient.userId})`);

    // Resolve config for a platform action (fallback to admin)
    const config = await getSmtpConfig(null, null, recipient.userId);
    console.log('Resolved Config:', config ? 'YES' : 'NONE');
    if (config) {
        console.log('Host:', config.smtpHost);
        console.log('User:', config.smtpUser);
    }

    const result = await sendSmtpEmail({
        to: recipient.email,
        subject: 'System Test - Email Support Debug',
        text: 'This is a test email to verify SMTP configuration.',
        config: config
    });

    console.log('Result:', result);
    process.exit(0);
}

testMail().catch(err => {
    console.error(err);
    process.exit(1);
});
