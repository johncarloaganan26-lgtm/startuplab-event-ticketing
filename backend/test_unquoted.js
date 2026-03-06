import db from './database/db.js';
async function run() {
    const q = db.from('users').select('userId, name, email, role, imageUrl, canviewevents, caneditevents, canmanualcheckin, employerId').limit(1);
    const resp = await q;
    console.log("Error from exact backend query:", resp.error);
}
run();
