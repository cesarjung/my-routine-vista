import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTask() {
    const { data, error } = await supabase
        .from('tasks')
        .select('id, title, sector_id, section_id, routine_id, parent_task_id, status')
        .ilike('title', '%Teste Tarefa%');

    if (error) console.error("Error:", error);
    else console.log(JSON.stringify(data, null, 2));
}

checkTask();
