
import supabase from '../database/db.js';
import { sendSmtpEmail } from '../utils/smtpMailer.js'; // Import existing mailer
import { encryptString, decryptString, maskString } from '../utils/encryption.js';
import { logAudit } from '../utils/auditLogger.js';

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

    await logAudit({
      actionType: 'SMTP_SETTINGS_UPDATED',
      details: { userId: req.user?.id },
      req
    });
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

/**
 * Update HitPay gateway settings (API key, salt, mode, etc)
 */
export async function updateHitPaySettings(req, res) {
    try {
        const userId = req.user?.id;
        // Verify they are authenticated
        if (!userId) return res.status(401).json({ error: 'Not authenticated' });

        const scope = req.query.scope || 'organizer';

        // Ensure only admin can save scope=admin
        if (scope === 'admin') {
            let { data: userRecord } = await supabase.from('users').select('role').eq('userId', userId).maybeSingle();

            // Fallback to userId column if id didn't return a record
            if (!userRecord) {
                const { data: altRecord } = await supabase.from('users').select('role').eq('userId', userId).maybeSingle();
                userRecord = altRecord;
            }

            const role = String(userRecord?.role || '').toUpperCase();
            console.log(`[HitPay] User ${userId} has role: ${role} trying to update admin scope.`);

            if (role !== 'ADMIN') {
                return res.status(403).json({
                    error: `Only admins can modify platform payment settings. (Current User: ${userId}, Role: ${role || 'NOT_FOUND'})`
                });
            }
        }

        const { enabled, mode, hitpayApiKey, hitpaySalt } = req.body;

        // Base keys mapped to db
        const settings = [
            { user_id: userId, key: 'hitpay_enabled', value: enabled === true ? 'true' : 'false' },
            { user_id: userId, key: 'hitpay_mode', value: mode === 'sandbox' ? 'sandbox' : 'live' }
        ];

        // Only encrypt and upsert if they provided new string values
        if (typeof hitpayApiKey === 'string' && hitpayApiKey.trim() !== '') {
            settings.push({ user_id: userId, key: 'hitpay_api_key', value: encryptString(hitpayApiKey.trim()) });
        }

        if (typeof hitpaySalt === 'string' && hitpaySalt.trim() !== '') {
            settings.push({ user_id: userId, key: 'hitpay_salt', value: encryptString(hitpaySalt.trim()) });
        }

        const { error } = await supabase
            .from('settings')
            .upsert(settings, { onConflict: 'user_id,key' });

        if (error) throw error;

        // Return updated masked keys to UI so they know it worked
        // We need to fetch the newly saved keys
        const { data: updatedData } = await supabase.from('settings').select('key, value').eq('user_id', userId).in('key', ['hitpay_api_key', 'hitpay_salt', 'hitpay_enabled', 'hitpay_mode']);

        const mapped = {};
        updatedData?.forEach(item => mapped[item.key] = item.value);

        const rawApiKey = mapped['hitpay_api_key'];
        const rawSalt = mapped['hitpay_salt'];
        const decryptedApiKey = decryptString(rawApiKey);
        const decryptedSalt = decryptString(rawSalt);

        return res.json({
            backendReady: true,
            settings: {
                enabled: mapped['hitpay_enabled'] === 'true',
                mode: mapped['hitpay_mode'] || 'live',
                hitpayApiKey: decryptedApiKey,
                hitpaySalt: decryptedSalt,
                maskedHitpayApiKey: decryptedApiKey ? maskString(decryptedApiKey) : (rawApiKey ? '••••••••••••••••' : null),
                maskedHitpaySalt: decryptedSalt ? maskString(decryptedSalt) : (rawSalt ? '••••••••••••••••' : null),
                isConfigured: mapped['hitpay_enabled'] === 'true',
                updatedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('[HitPay Settings] Update failed:', error.message);
        return res.status(500).json({ error: 'Failed to save HitPay settings.' });
    }
}

/**
 * Get HitPay settings for the current user
 */
export async function getHitPaySettings(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Not authenticated' });

        const scope = req.query.scope || 'organizer';

        // Admins modifying their keys vs Organizers reading theirs.
        // It always reads from the active user profile:
        const { data, error } = await supabase
            .from('settings')
            .select('key, value, updated_at')
            .eq('user_id', userId)
            .in('key', ['hitpay_api_key', 'hitpay_salt', 'hitpay_enabled', 'hitpay_mode']);

        if (error) throw error;

        const mapped = {};
        let latestUpdate = null;

        data.forEach(item => {
            mapped[item.key] = item.value;
            if (!latestUpdate || new Date(item.updated_at) > new Date(latestUpdate)) {
                latestUpdate = item.updated_at;
            }
        });

        // Mask results
        const rawApiKey = mapped['hitpay_api_key'];
        const rawSalt = mapped['hitpay_salt'];

        const decryptedApiKey = decryptString(rawApiKey);
        const decryptedSalt = decryptString(rawSalt);

        // Mask results - if decrypt fails, we still want to indicate it exists
        const result = {
            enabled: mapped['hitpay_enabled'] === 'true',
            mode: mapped['hitpay_mode'] || 'live',
            hitpayApiKey: decryptedApiKey,
            hitpaySalt: decryptedSalt,
            maskedHitpayApiKey: decryptedApiKey ? maskString(decryptedApiKey) : (rawApiKey ? '••••••••••••••••' : null),
            maskedHitpaySalt: decryptedSalt ? maskString(decryptedSalt) : (rawSalt ? '••••••••••••••••' : null),
            isConfigured: !!mapped['hitpay_enabled'],
            updatedAt: latestUpdate
        };

        return res.json(result);
    } catch (error) {
        console.error('[HitPay Settings] Fetch failed:', error.message);
        return res.status(500).json({ error: 'Failed to fetch HitPay settings.' });
    }
}
