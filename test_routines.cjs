const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data: routines } = await supabase.from('routines').select('id, title, frequency, is_active').order('created_at', { ascending: false }).limit(20);
    console.log("Routines:");
    routines?.forEach(r => console.log(`- ${r.title} | freq: ${r.frequency} | active: ${r.is_active}`));
}
run();
