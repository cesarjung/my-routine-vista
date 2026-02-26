import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing ENV vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase
        .from('tasks')
        .select('id, title, is_recurring, start_date, due_date, status, routine_id, parent_task_id')
        .ilike('title', '%Teste Diário Hoje%');

    if (error) console.error(error);
    console.log(JSON.stringify(data, null, 2));
}

run();
