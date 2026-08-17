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

const activeUnits = [
  '1OTHF2ytEOjGgfE49paARXkz9GjaklOQC_UhiXwUjC2E',
  '1rj2V7CxbZwkan63eCeLkH9G00Gi041IZNC6vwEgq6yI',
  '1FO5tyhXygbbzSmmTGdnm45j4DD_rRFQgEheN8T8Wy70',
  '1oS619l3x_D1mXkvDpw8vs91G6ipZmsK83JqEIwPj7Uk',
  '1gN2tR_LCuRnVCQ9tm2UURnVuMlJPVNEjvmo02TwFQCI',
  '1dNwj8qWTl1k92PxI9iXwaNZYITnxuKP-kOF1QnZK3Iw',
  '1sGHf-zWXoxjnO20QBw2KWX39BSCzT8rzHdEz1hL7jyU',
  '1XmpY8mqkRou-CRY68j1ljHH8W8zcROy7wnwMMSfbV7o',
  '1rzT8o6XZi4v8j7CYLky3BD3sT5IPjv1PRb45ipBfbw4'
];

async function check() {
    console.log("Simulating React hook query...");
    
    // 1. Fetch stock
    const { data: rawEstoque } = await supabase
        .from('materiais_estoque')
        .select('*')
        .in('unidade_id', activeUnits);
        
    console.log("Raw stock records fetched:", rawEstoque?.length);
    
    const countByUnit = {};
    rawEstoque?.forEach((e) => {
        countByUnit[e.unidade_id] = (countByUnit[e.unidade_id] || 0) + 1;
    });
    console.log("Stock record count by unit ID:", countByUnit);
}
check();
