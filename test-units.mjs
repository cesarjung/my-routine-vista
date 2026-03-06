import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase.from('units').select('*').limit(1);
    console.log("Units schema test:");
    if (error) console.error(error);
    if (data && data.length > 0) console.log(Object.keys(data[0]));
}

run();
