const fs = require('fs');

const env = fs.readFileSync('.env', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/);
const url = urlMatch[1].trim().replace(/"/g, '') + '/rest/v1/planejamento_cache?select=unidade_id,carteira&limit=1';
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
        if (data.length > 0) {
            console.log("unidade_id:", data[0].unidade_id);
            const carteiraStr = data[0].carteira;
            const carteira = typeof carteiraStr === 'string' ? JSON.parse(carteiraStr) : carteiraStr;
            console.log("Total rows:", carteira.length);
            for (let i = 5; i < Math.min(10, carteira.length); i++) {
                const row = carteira[i];
                console.log(`Row ${i} len: ${row.length}`);
                if (row.length > 8) console.log(`  [8]: ${row[8]}`);
                if (row.length > 9) console.log(`  [9]: ${row[9]}`);
                if (row.length > 12) console.log(`  [12]: ${row[12]}`);
            }
        } else {
            console.log("No data returned");
        }
    } catch(err) {
        console.error("Error:", err);
    }
}
run();
