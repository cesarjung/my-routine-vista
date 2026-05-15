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
            
            let foundCount = 0;
            for (let i = 7; i < principal.length; i++) {
                const row = principal[i];
                if (row && row.length > 64) {
                    if (row[64] || row[67]) {
                        console.log(`Row ${i}: Data=${row[1]} 64=${row[64]} 67=${row[67]}`);
                        foundCount++;
                        if (foundCount > 5) break;
                    }
                }
            }
            if (foundCount === 0) {
                console.log("No rows with col 64 or 67 found!");
                if (principal.length > 2600) {
                     console.log("Checking row 2600 specifically:");
                     console.log(principal[2600]);
                }
            }
        } else {
            console.log("No data returned or RLS block");
        }
    } catch(err) {
        console.error("Error:", err);
    }
}
run();
