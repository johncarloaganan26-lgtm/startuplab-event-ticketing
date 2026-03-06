import { notifyUserByPreference } from '../utils/notificationService.js';
import supabase from '../database/db.js';

async function simulateFollow() {
    console.log('--- Simulating Follow Event ---');

    // 1. Get an organizer
    const { data: orgs } = await supabase.from('organizers').select('organizerId, organizerName, ownerUserId').limit(1);
    if (!orgs?.length) return console.error('No organizers found');
    const org = orgs[0];

    // 2. Get a user (follower)
    // Let's use d6e6eeaa-c793-44bd-8698-c42044cb0fb1 (the one with settings)
    const followerUserId = 'd6e6eeaa-c793-44bd-8698-c42044cb0fb1';

    console.log(`Simulating: User ${followerUserId} following Org ${org.organizerName} (${org.organizerId})`);

    const welcomeMessage = `Thanks for following ${org.organizerName}! You'll stay updated on their latest events.`;

    const result = await notifyUserByPreference({
        recipientUserId: followerUserId,
        organizerId: org.organizerId,
        type: 'FOLLOW_CONFIRMATION',
        title: `You are now following ${org.organizerName}`,
        message: welcomeMessage,
        metadata: {
            organizerName: org.organizerName,
            actionLabel: 'EXPLORE EVENTS',
            actionUrl: 'https://events.moonshotdigital.com.ph/events',
            eventName: org.organizerName,
        },
        emailSubject: `You are now following ${org.organizerName}`,
        emailText: welcomeMessage,
    });

    console.log('Final Result:', JSON.stringify(result, null, 2));
    process.exit(0);
}

simulateFollow().catch(err => {
    console.error(err);
    process.exit(1);
});
