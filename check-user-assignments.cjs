const fs = require('fs');
const envLocal = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '';
const env = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
const pullVal = (str, key) => { const match = str.match(new RegExp(key + '=([^\\r\\n]+)')); return match ? match[1].trim().replace(/^\\\"/, '').replace(/\\\"$/, '') : null; };
const url = pullVal(envLocal, 'VITE_SUPABASE_URL') || pullVal(env, 'VITE_SUPABASE_URL');
// HARDCODING SERVICE ROLE JUST IN CASE IT FAILS: We can construct it or just read from process.env if we run with node --env-file
const key = pullVal(envLocal, 'SUPABASE_SERVICE_ROLE_KEY') || pullVal(env, 'SUPABASE_SERVICE_ROLE_KEY');

async function run() {
    if (!key) {
        console.log('No service key');
        process.exit(1);
    }

    const headers = { 'apikey': key, 'Authorization': `Bearer ${key}` };

    // Find users
    const qStr = ['Edvan', 'Dilor', 'Michael'].map(n => `full_name.ilike.*${n}*`).join(',');
    const uReq = await fetch(`${url}/rest/v1/profiles?select=id,full_name,unit_id,role&or=(${qStr})`, { headers });
    const users = await uReq.json();
    console.log('Found users:', users);

    for (const user of users) {
        console.log(`\n--- Fetching data for ${user.full_name} (${user.id}) ---`);

        const taReq = await fetch(`${url}/rest/v1/task_assignees?select=task_id,user_id&user_id=eq.${user.id}`, { headers });
        const tas = await taReq.json();
        console.log(`Task Assignees Count: ${tas.length}`, tas.slice(0, 3));

        const raReq = await fetch(`${url}/rest/v1/routine_assignees?select=routine_id,user_id&user_id=eq.${user.id}`, { headers });
        const ras = await raReq.json();
        console.log(`Routine Assignees Count: ${ras.length}`, ras.slice(0, 3));
    }
}
run();
