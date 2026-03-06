import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pkg;

async function run() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
        await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS "employerId" uuid REFERENCES users("userId") ON DELETE CASCADE;');
        await pool.query('ALTER TABLE invites ADD COLUMN IF NOT EXISTS "invitedBy" uuid REFERENCES users("userId") ON DELETE CASCADE;');
        console.log("Migration successful");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await pool.end();
    }
}
run();
