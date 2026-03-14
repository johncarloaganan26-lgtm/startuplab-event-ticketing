import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  console.log('Adding capacity_per_ticket column to ticketTypes table...');
  const { error } = await supabase.rpc('execute_sql', { 
    sql: 'ALTER TABLE "ticketTypes" ADD COLUMN IF NOT EXISTS capacity_per_ticket INTEGER DEFAULT 1;' 
  });

  if (error) {
    if (error.message.includes('already exists')) {
        console.log('Column already exists.');
    } else {
        console.error('Error adding column:', error);
    }
  } else {
    console.log('Column added successfully or already present.');
  }

  process.exit();
}

run();
