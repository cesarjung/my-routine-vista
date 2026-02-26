import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        const key = parts.shift().trim();
        const val = parts.join('=').trim().replace(/"/g, '').replace(/\r/g, '');
        env[key] = val;
    }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data, error } = await supabase
        .from('tasks')
        .select('id, title, start_date, due_date, parent_task_id, routine_id, is_recurring, recurrence_frequency, status, created_at, unit_id')
        .ilike('title', '%Teste Diário Hoje%')
        .order('created_at', { ascending: true });

    if (error) {
        console.error("Error fetching data:", error);
        return;
    }

    if (!data || data.length === 0) {
        console.log("Nenhuma tarefa com esse nome encontrada.");
        return;
    }

    console.log(JSON.stringify(data, null, 2));
}

run();
