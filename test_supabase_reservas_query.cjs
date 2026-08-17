const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env', 'utf8');
const pullVal = (str, key) => {
    const match = str.match(new RegExp(key + '=(.*)'));
    return match ? match[1].trim().replace(/['\"]/g, '') : null;
};

const url = pullVal(env, 'VITE_SUPABASE_URL');
const key = pullVal(env, 'VITE_SUPABASE_PUBLISHABLE_KEY');

const supabase = createClient(url, key);

async function check() {
    console.log("Querying table materiais_reservas...");
    const { data, error } = await supabase
        .from('materiais_reservas')
        .select('*')
        .eq('unidade_id', '1OTHF2ytEOjGgfE49paARXkz9GjaklOQC_UhiXwUjC2E');
        
    if (error) {
        console.error("Error querying table:", error);
        return;
    }
    
    console.log("Total records returned in JS for Barreiras:", data.length);
    const countSeparado = data.filter(r => String(r.status).toUpperCase() === 'SEPARADO').length;
    console.log("Count of SEPARADO:", countSeparado);
}

check();
