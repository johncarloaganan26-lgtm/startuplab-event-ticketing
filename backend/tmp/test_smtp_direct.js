import supabase from '../database/db.js';
import { getSmtpConfig, notifyUserByPreference, debugLog } from '../utils/notificationService.js';

async function runTest() {
    const organizerId = '05534a7c-6325-4a9f-bdfc-36aa132a9201';
    const recipientUserId = 'af72c766-5062-4874-bd87-5d56e95de673'; // The user from logs

    console.log('--- STARTING SMTP TEST ---');
    debugLog('🧪 [Test] Starting manual SMTP test for organizer and user');

    try {
        const config = await getSmtpConfig(organizerId, null, recipientUserId);
        console.log('SMTP Config Resolved:', config ? 'SUCCESS' : 'FAILED');
        if (config) {
            console.log('SMTP Host:', config.host);
            console.log('SMTP User:', config.username);
        }

        const result = await notifyUserByPreference({
            recipientUserId,
            organizerId,
            type: 'FOLLOW_CONFIRMATION',
            title: 'TEST NOTIFICATION',
            message: 'This is a manual test email from the server logic.',
            emailSubject: 'DEBUG TEST EMAIL',
        });

        console.log('Final Result:', JSON.stringify(result, null, 2));
    } catch (err) {
        console.error('Test Failed:', err.message);
    }
    process.exit(0);
}

runTest();
