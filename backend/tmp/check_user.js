import supabase from '../database/db.js';

async function checkUser(id) {
    const { data, error } = await supabase.from('users').select('*').eq('userId', id).maybeSingle();
    if (error || !data) {
        const fallback = await supabase.from('users').select('*').eq('id', id).maybeSingle();
        console.log('User Record:', fallback.data || 'NOT FOUND');
    } else {
        console.log('User Record:', data);
    }
    process.exit(0);
}

checkUser('d6e6eeaa-c793-44bd-8698-c42044cb0fb1');
