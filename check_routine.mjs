import * as fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL="?(.*?)"?(?:\r?\n|$)/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY="?(.*?)"?(?:\r?\n|$)/);

const SUPABASE_URL = urlMatch[1].trim();
const SUPABASE_KEY = keyMatch[1].trim();

async function run() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/routines?limit=1`, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
        }
    });

    const data = await res.json();
    console.log(JSON.stringify(data[0], null, 2));
}

run();
