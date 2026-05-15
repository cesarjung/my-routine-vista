import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function run() {
  const { data, error } = await supabase.from('planejamento_cache').select('unidade_id, carteira').limit(1);
  if (error) {
    console.error(error);
    return;
  }
  
  if (data && data.length > 0) {
    const carteiraStr = data[0].carteira;
    const carteira = typeof carteiraStr === 'string' ? JSON.parse(carteiraStr) : carteiraStr;
    console.log("carteira length:", carteira.length);
    for (let i = 6; i < Math.min(15, carteira.length); i++) {
        const row = carteira[i];
        console.log(`Row ${i} length: ${row.length}, Index 8: ${row[8]}, Index 12: ${row[12]}`);
    }
  } else {
    console.log("No data found");
  }
}

run();
