const fs = require('fs');

const envLocal = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '';
const env = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';

const pullVal = (str, key) => {
    const match = str.match(new RegExp(key + '=([^\\r\\n]+)'));
    return match ? match[1].trim().replace(/^\\\"/, '').replace(/\\\"$/, '') : null;
};

const url = pullVal(envLocal, 'VITE_SUPABASE_URL') || pullVal(env, 'VITE_SUPABASE_URL');
// Use the SUPABASE_SERVICE_ROLE_KEY to bypass RLS
const key = pullVal(envLocal, 'SUPABASE_SERVICE_ROLE_KEY') || pullVal(env, 'SUPABASE_SERVICE_ROLE_KEY');

if (!key) {
    console.log('NO SERVICE ROLE KEY FOUND.');
    process.exit(1);
}

async function run() {
    const req1 = await fetch(`${url}/rest/v1/routines?select=id,title,frequency,is_active&frequency=eq.mensal`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });

    if (!req1.ok) {
        console.log('Error fetching routines:', await req1.text());
        return;
    }

    const monthlies = await req1.json();

    console.log('--- ALL MONTHLY ROUTINES ---');
    console.log(JSON.stringify(monthlies.map(r => ({ title: r.title, active: r.is_active, id: r.id })), null, 2));

    if (monthlies.length > 0) {
        const ids = monthlies.map(r => `"${r.id}"`).join(',');
        const req2 = await fetch(`${url}/rest/v1/tasks?select=id,title,due_date,status,unit_id,parent_task_id&routine_id=in.(${ids})&order=due_date.asc`, {
            headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
        });

        if (!req2.ok) {
            console.log('Error fetching tasks:', await req2.text());
            return;
        }

        const tasks = await req2.json();
        console.log(`\n--- TASKS FOR MONTHLIES (${tasks.length}) ---`);
        if (tasks.length > 0) {
            tasks.slice(0, 10).forEach(t => {
                console.log(`- ${t.title} | unit_id: ${t.unit_id} | due: ${t.due_date} | parent_task_id: ${t.parent_task_id}`);
            });
            if (tasks.length > 10) console.log('...and more');
        } else {
            console.log('No tasks found attached to these routines.');
        }
    }
}
run();
