
import supabase from '../database/db.js';
import { sendSmtpEmail } from '../utils/smtpMailer.js'; // Import existing mailer

/**
 * Save or Update SMTP settings for the current user (Organizer or Admin)
 */
export async function updateSmtpSettings(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Not authenticated' });

        const {
            emailProvider,
            mailDriver,
            smtpHost,
            smtpPort,
            smtpUsername,
            smtpPassword,
            mailEncryption,
            fromAddress,
            fromName
        } = req.body;

        // Map UI fields to database keys
        const settings = [
            { user_id: userId, key: 'email_provider', value: emailProvider },
            { user_id: userId, key: 'email_driver', value: mailDriver },
            { user_id: userId, key: 'email_host', value: smtpHost },
            { user_id: userId, key: 'email_port', value: String(smtpPort || '') },
            { user_id: userId, key: 'email_username', value: smtpUsername },
            { user_id: userId, key: 'email_password', value: smtpPassword },
            { user_id: userId, key: 'email_encryption', value: mailEncryption },
            { user_id: userId, key: 'email_from_address', value: fromAddress },
            { user_id: userId, key: 'email_from_name', value: fromName },
        ].filter(s => s.value !== undefined);

        const { error } = await supabase
            .from('settings')
            .upsert(settings, { onConflict: 'user_id,key' });

        if (error) throw error;

        return res.json({ message: 'Settings updated successfully' });
    } catch (error) {
        console.error('[Settings] Update failed:', error.message);
        return res.status(500).json({ error: 'Failed to update settings' });
    }
}

/**
 * Get current SMTP settings for the user
 */
export async function getSmtpSettings(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Not authenticated' });

        const { data, error } = await supabase
            .from('settings')
            .select('key, value')
            .eq('user_id', userId);

        if (error) throw error;

        // Transform back to object for UI
        const result = {};
        data.forEach(item => {
            const fieldMap = {
                'email_provider': 'emailProvider',
                'email_driver': 'mailDriver',
                'email_host': 'smtpHost',
                'email_port': 'smtpPort',
                'email_username': 'smtpUsername',
                'email_password': 'smtpPassword',
                'email_encryption': 'mailEncryption',
                'email_from_address': 'fromAddress',
                'email_from_name': 'fromName'
            };
            if (fieldMap[item.key]) {
                result[fieldMap[item.key]] = item.value;
            }
        });

        return res.json(result);
    } catch (error) {
        console.error('[Settings] Fetch failed:', error.message);
        return res.status(500).json({ error: 'Failed to fetch settings' });
    }
}

/**
 * Test SMTP settings without saving them (or using existing ones)
 */
export async function testSmtpSettings(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Not authenticated' });

        const {
            recipientEmail, // The email to send the test to
            // Settings can be passed in to test BEFORE saving
            emailProvider,
            mailDriver,
            smtpHost,
            smtpPort,
            smtpUsername,
            smtpPassword,
            mailEncryption,
            fromAddress,
            fromName
        } = req.body;

        if (!recipientEmail) return res.status(400).json({ error: 'Recipient email is required' });

        const testConfig = {
            emailProvider: emailProvider || 'SMTP',
            mailDriver: mailDriver || 'smtp',
            smtpHost,
            smtpPort: parseInt(smtpPort, 10) || 587,
            smtpUser: smtpUsername,
            smtpPass: smtpPassword,
            mailEncryption: mailEncryption || 'TLS',
            fromAddress: fromAddress || smtpUsername,
            fromName: fromName || 'SMTP Tester'
        };

        console.log(`📡 [Settings] Testing SMTP for user ${userId} to ${recipientEmail}`);

        const result = await sendSmtpEmail({
            to: recipientEmail,
            subject: 'StartupLab: SMTP Test Message',
            text: 'Success! Your SMTP configuration is working correctly.',
            html: '<h1>Success!</h1><p>Your professional SMTP configuration is working correctly.</p>',
            config: testConfig
        });

        if (result.ok) {
            return res.json({ message: 'Test email sent successfully!' });
        } else {
            return res.status(500).json({ error: result.error || 'SMTP test failed' });
        }
    } catch (error) {
        console.error('[Settings] Test failed:', error.message);
        return res.status(500).json({ error: 'System error during SMTP test' });
    }
}
