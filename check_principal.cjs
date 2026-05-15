const fs = require('fs');

const env = fs.readFileSync('.env', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/);
const url = urlMatch[1].trim().replace(/"/g, '') + '/rest/v1/planejamento_cache?select=unidade_id,principal&limit=1';
const key = keyMatch[1].trim().replace(/"/g, '');

async function run() {
    try {
        const res = await fetch(url, {
            headers: {
                'apikey': key,
                'Authorization': 'Bearer ' + key
            }
        });
        
        const data = await res.json();
        if (data && data.length > 0) {
            const principalStr = data[0].principal;
            const principal = typeof principalStr === 'string' ? JSON.parse(principalStr) : principalStr;
            console.log("Total rows in principal:", principal.length);
            for (let i = 7; i < Math.min(12, principal.length); i++) {
                const row = principal[i];
                console.log(`Row ${i}:`);
                console.log(`  Data (1): ${row[1]}`);
                console.log(`  Equipe (6): ${row[6]}`);
                console.log(`  Projeto (7): ${row[7]}`);
            }
        } else {
            console.log("No data returned or RLS block");
        }
    } catch(err) {
        console.error("Error:", err);
    }
}
run();
