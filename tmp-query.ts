import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing environment variables");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
        email: 'admin@sirtec.com.br', // Try to login if RLS is enabled, or just use anon key if allowed
        password: 'admin' // I will just try anon first without login
    });

    const { data, error } = await supabase
        .from('tasks')
        .select('id, title, status, start_date, unit_id, is_recurring, parent_task_id')
        .ilike('title', '%Check de Disponibilidade%')
        .gte('start_date', '2026-03-01')
        .lte('start_date', '2026-03-05')
        .order('start_date', { ascending: true });

    if (error) {
        console.error(error);
    } else {
        console.log(JSON.stringify(data, null, 2));
    }
}

run();
