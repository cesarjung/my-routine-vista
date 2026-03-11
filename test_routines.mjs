import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data: routines } = await supabase.from('routines').select('id, title, frequency, is_active').order('created_at', { ascending: false }).limit(20);
    console.log("Routines:");
    routines?.forEach(r => console.log(`- ${r.title} | freq: ${r.frequency} | active: ${r.is_active}`));

    const todayStr = new Date().toISOString().substring(0, 10);

    const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, status, due_date, routine_id')
        .ilike('title', '%Check de Disponibilidade%')
        .lte('due_date', `${todayStr}T23:59:59.999Z`)
        .order('due_date', { ascending: false })
        .limit(10);

    console.log("\nRecent Check de Disponibilidade Tasks:");
    tasks?.forEach(t => console.log(`- ${t.title} | status: ${t.status} | due: ${t.due_date}`));
}
run();
