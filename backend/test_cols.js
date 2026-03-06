import db from './database/db.js';
async function run() {
    const { data, error } = await db.from("users").select("userId, name, email, role, imageUrl, canviewevents, caneditevents, canmanualcheckin, \"employerId\"");
    console.log("Error:", error);
    console.log("Data keys:", data ? Object.keys(data[0] || {}) : null);
}
run();
