import fs from 'fs';
const env = fs.readFileSync('.env', 'utf8');

const urlMatch = env.match(/VITE_SUPABASE_URL=(.*?)\r?\n/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*?)\r?\n/);

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

async function check() {
    const routinesRes = await fetch(`${supabaseUrl}/rest/v1/routines?select=id,title,frequency&order=created_at.desc&limit=4`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });
    const routines = await routinesRes.json();

    if (!routines || routines.length === 0) {
        console.log('No routines found');
        return;
    }

    for (const r of routines) {
        const tasksRes = await fetch(`${supabaseUrl}/rest/v1/tasks?select=id,unit_id&routine_id=eq.${r.id}&parent_task_id=not.is.null`, {
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        });
        const tasks = await tasksRes.json();

        if (tasks && tasks.length > 0) {
            const units = [...new Set(tasks.map(t => t.unit_id))];
            console.log(`[${r.title}] -> Generated Tasks: ${tasks.length} | Unique Units: ${units.length}`);
        } else {
            console.log(`[${r.title}] -> 0 tasks`);
        }
    }
}

check();
