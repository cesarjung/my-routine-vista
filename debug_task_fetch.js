const fs = require('fs');
const dotenvPath = '.env';
let envUrl = '';
let envKey = '';

try {
    const envFile = fs.readFileSync(dotenvPath, 'utf8');
    const lines = envFile.split('\n');
    for (const line of lines) {
        if (line.startsWith('VITE_SUPABASE_URL=')) envUrl = line.split('=')[1].trim();
        if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) envKey = line.split('=')[1].trim();
    }
} catch (e) { console.error("Could not read .env"); process.exit(1); }

async function check() {
    const res = await fetch(`${envUrl}/rest/v1/tasks?title=ilike.*Teste%20Tarefa*&select=*`, {
        headers: {
            'apikey': envKey,
            'Authorization': `Bearer ${envKey}`
        }
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

check();
