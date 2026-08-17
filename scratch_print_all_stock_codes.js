import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env', 'utf8');
const pullVal = (str, key) => {
    const match = str.match(new RegExp(key + '=(.*)'));
    return match ? match[1].trim().replace(/['\"]/g, '') : null;
};

const url = pullVal(env, 'VITE_SUPABASE_URL');
const key = pullVal(env, 'VITE_SUPABASE_PUBLISHABLE_KEY');

const supabase = createClient(url, key);

async function check() {
    const { data } = await supabase.from('materiais_estoque').select('*');
    console.log("Stock records:", data?.length);
    const codes = data?.map(d => d.codigo).sort();
    console.log("All stock codes (sorted):");
    console.log(JSON.stringify(codes, null, 2));
}
check();
