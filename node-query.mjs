import * as fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const SUPABASE_URL = urlMatch[1].trim();
const SUPABASE_KEY = keyMatch[1].trim();

async function run() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/tasks?title=ilike.*Check de Disponibilidade*&due_date=gte.2026-03-04T00:00:00&due_date=lt.2026-03-05T00:00:00&select=id,title,status,due_date,unit_id,is_recurring,parent_task_id,routine_id`, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
        }
    });

    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

run();
