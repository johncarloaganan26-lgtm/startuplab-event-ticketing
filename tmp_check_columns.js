const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkColumns() {
  const { data, error } = await supabase.from('orders').select('*').limit(1);
  if (error) {
    console.error(error);
  } else if (data && data.length > 0) {
    console.log(Object.keys(data[0]));
  } else {
    // If no data, try to fetch from rpc or just common columns
    console.log('No data in orders table.');
  }
}

checkColumns();
