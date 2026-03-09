const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*?)\r?\n/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*?)\r?\n/);
const url = urlMatch[1].trim();
const key = keyMatch[1].trim();

async function run() {
    const endpoint = `${url}/rest/v1/dashboard_panels?select=id,title,filters&title=eq.Rotinas%20Diárias`;
    const res = await fetch(endpoint, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const panels = await res.json();
    console.log(JSON.stringify(panels, null, 2));
}
run();
