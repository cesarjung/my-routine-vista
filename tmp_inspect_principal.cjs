const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envLocal = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '';
const env = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';

const pullVal = (str, key) => {
    const match = str.match(new RegExp(`${key}=([^\\r\\n]+)`));
    return match ? match[1].trim().replace(/^"/, '').replace(/"$/, '') : null;
};

const url = pullVal(envLocal, 'VITE_SUPABASE_URL') || pullVal(env, 'VITE_SUPABASE_URL');
const key = pullVal(envLocal, 'VITE_SUPABASE_PUBLISHABLE_KEY') || pullVal(env, 'VITE_SUPABASE_PUBLISHABLE_KEY');

const supabase = createClient(url, key);

async function run() {
    const { data } = await supabase.from('planejamento_cache').select('*');
    for (const row of data) {
        if (row.unidade_id === '1OTHF2ytEOjGgfE49paARXkz9GjaklOQC_UhiXwUjC2E') {
            const principal = JSON.parse(row.principal || '[]');
            console.log('Principal rows:', principal.length);
            
            // Let's print index 10 and 28 for rows that have project H/row[7]
            let printed = 0;
            for (let i = 7; i < principal.length; i++) {
                const r = principal[i];
                if (r[7]) {
                    // Find all index where there are strings with letters (excluding project, supervisor, equipe, etc.)
                    const indicesWithValue = [];
                    r.forEach((val, idx) => {
                        if (val && val !== '-' && val !== 'FALSE' && val !== 'TRUE' && idx !== 7 && idx !== 4 && idx !== 6 && idx !== 1 && idx !== 12) {
                            indicesWithValue.push(`${idx}: "${val}"`);
                        }
                    });
                    if (indicesWithValue.length > 0) {
                        console.log(`Row ${i} non-empty:`, indicesWithValue.join(' | '));
                        printed++;
                        if (printed >= 10) break;
                    }
                }
            }
            break;
        }
    }
}
run();
