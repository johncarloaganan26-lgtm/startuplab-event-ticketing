
import dotenv from 'dotenv';
dotenv.config();

import supabase from './database/db.js';
async function checkCols() {
    console.log('Starting column check...');
    const timeout = setTimeout(() => {
        console.error('Timed out after 5 seconds');
        process.exit(1);
    }, 5000);

    const tableName = process.argv[2] || 'events';
    try {
        const { data, error } = await supabase.from(tableName).select('*').limit(1);
        clearTimeout(timeout);
        if (error) {
            console.error('Database Error:', error);
            process.exit(1);
        }
        if (data && data[0]) {
            console.log('Columns found in events table:', Object.keys(data[0]));
            console.log('First event data (redacted):', {
                eventId: data[0].eventId,
                locationText: data[0].locationText,
                streaming_url: data[0].streaming_url,
                status: data[0].status
            });
        } else {
            console.log('No events found in table.');
        }
        process.exit(0);
    } catch (err) {
        console.error('Unexpected Error:', err);
        process.exit(1);
    }
}

checkCols();
