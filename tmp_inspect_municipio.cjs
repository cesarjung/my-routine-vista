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
    console.log('Querying cache for Barreiras principal...');
    const { data, error } = await supabase
        .from('planejamento_cache')
        .select('unidade_id, principal')
        .eq('unidade_id', '1OTHF2ytEOjGgfE49paARXkz9GjaklOQC_UhiXwUjC2E')
        .single();
        
    if (error) {
        console.error('Supabase Error:', error);
        return;
    }
    if (!data) {
        console.log('No data returned.');
        return;
    }
    
    const principal = JSON.parse(data.principal || '[]');
    console.log('Principal rows:', principal.length);
    if (principal.length > 1) {
        console.log('Row 1 headers (all):');
        principal[1].forEach((v, idx) => {
            console.log(`  ${idx}: "${v}"`);
        });
    }
}
run();
