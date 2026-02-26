import fs from 'fs';

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

async function run() {
    const url = env.VITE_SUPABASE_URL + "/rest/v1/tasks?title=ilike.*Teste%20Di%C3%A1rio%20Hoje*&select=id,title,start_date,due_date,parent_task_id,routine_id,is_recurring,recurrence_frequency,status,created_at,unit_id";
    const res = await fetch(url, {
        headers: {
            "apikey": env.VITE_SUPABASE_ANON_KEY,
            "Authorization": "Bearer " + env.VITE_SUPABASE_ANON_KEY
        }
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

run();
