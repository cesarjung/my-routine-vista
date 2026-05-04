const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '').replace(/\r$/, '');
        env[key] = val;
    }
});

const url = env.VITE_SUPABASE_URL + "/rest/v1/tasks?title=ilike.*Teste%20Di%C3%A1rio%20Hoje*&select=id,title,start_date,due_date,parent_task_id,unit_id,routine_id,is_recurring,status,created_at&order=created_at.asc";

fetch(url, {
    headers: {
        "apikey": env.VITE_SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + env.VITE_SUPABASE_ANON_KEY
    }
})
    .then(r => r.json())
    .then(d => console.log(JSON.stringify(d, null, 2)))
    .catch(e => console.error(e));
