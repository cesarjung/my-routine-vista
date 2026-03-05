import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
    const { data, error } = await supabase
        .from('tasks')
        .select('id, title, status, due_date, unit_id, is_recurring, parent_task_id, routine_id')
        .ilike('title', '%Check de Disponibilidade%')
        .gte('due_date', '2026-03-04T00:00:00')
        .lte('due_date', '2026-03-05T00:00:00')
        .order('created_at', { ascending: true });

    if (error) {
        console.error(error);
    } else {
        console.log(JSON.stringify(data, null, 2));
    }
}

run();
