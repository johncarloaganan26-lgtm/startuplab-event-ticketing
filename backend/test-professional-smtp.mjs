
import supabase from './database/db.js';
import { getSmtpConfig } from './utils/notificationService.js';

async function runProfessionalTest() {
    console.log('🧪 Starting Professional SMTP Test...');

    // 1. Check Table
    const { error: tableError } = await supabase.from('settings').select('id').limit(1);
    if (tableError) {
        console.error('❌ Table "settings" is missing! Please run the SQL first.');
        return;
    }
    console.log('✅ Settings table exists.');

    // 2. Find an Organizer to test with
    const { data: org } = await supabase.from('organizers').select('organizerId, ownerUserId').limit(1).maybeSingle();
    if (!org) {
        console.warn('⚠️ No organizer found in DB. Create one to test organizer-level SMTP.');
    } else {
        console.log(`👤 Testing with Organizer: ${org.organizerId}`);

        // 3. Seed test data for this Organizer
        const testKeys = [
            { user_id: org.ownerUserId, key: 'email_host', value: 'smtp.test-organizer.com' },
            { user_id: org.ownerUserId, key: 'email_username', value: 'hello@ribo.com.ph' },
            { user_id: org.ownerUserId, key: 'email_from_name', value: 'Ribo Events (Custom)' }
        ];

        console.log('📝 Seeding Organizer settings...');
        await supabase.from('settings').upsert(testKeys);

        // 4. Test Resolution
        console.log('🔍 Testing Resolution for Organizer...');
        const config = await getSmtpConfig(org.organizerId);

        if (config && config.smtpHost === 'smtp.test-organizer.com') {
            console.log('✅ SUCCESS: System correctly resolved Organizer Custom SMTP!');
            console.log('   Sender Name:', config.fromName);
            console.log('   Sender User:', config.smtpUser);
        } else {
            console.error('❌ FAILED: System did not resolve custom settings.');
            console.log('   Resolved Config:', JSON.stringify(config, null, 2));
        }
    }

    // 5. Test Fallback to Superadmin
    console.log('\n🔍 Testing Fallback to Superadmin...');
    const { data: admin } = await supabase.from('users').select('userId').eq('role', 'ADMIN').limit(1).maybeSingle();

    if (admin) {
        const adminKeys = [
            { user_id: admin.userId, key: 'email_host', value: 'smtp.superadmin-platform.com' },
            { user_id: admin.userId, key: 'email_username', value: 'system@moonshot.ph' }
        ];
        await supabase.from('settings').upsert(adminKeys);

        // Test resolution when NO organizerId is provided (e.g. system alert)
        const adminConfig = await getSmtpConfig(null);
        if (adminConfig && adminConfig.smtpHost === 'smtp.superadmin-platform.com') {
            console.log('✅ SUCCESS: System correctly fell back to Superadmin settings!');
        } else {
            console.error('❌ FAILED: Fallback to superadmin failed.');
        }
    }

    console.log('\n🏁 Test complete.');
}

runProfessionalTest();
