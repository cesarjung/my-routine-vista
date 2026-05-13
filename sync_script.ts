import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '.env');
const env = fs.readFileSync(envPath, 'utf-8');
const url = env.match(/VITE_SUPABASE_URL="(.*)"/)?.[1]?.trim();
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY="(.*)"/)?.[1]?.trim();

const API_URL = 'https://script.google.com/macros/s/AKfycbxn-YpuZZsNsdGT_FxQdhUwLE5KUIuXvo7Ffad03x80LByig3qneNe7-hy9PUZYS8-bDg/exec';
const SECRET_TOKEN = 'sirtec_vista_2026_seguro';

const UNIDADES_PLANEJAMENTO = [
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

async function run() {
  if (!url || !key) {
    console.error("No Supabase credentials found.");
    return;
  }
  
  const supabase = createClient(url, key);
  
  console.log("Starting sequential sync for units...");
  for (const unidadeId of UNIDADES_PLANEJAMENTO) {
    try {
      console.log(`Fetching data for ${unidadeId}...`);
      const fetchUrl = `${API_URL}?token=${SECRET_TOKEN}&id=${unidadeId}&sheets=Carteira_Planejador,Plan_Principal,BD_Metas,Reprogramadas,Base_Curva,BD_Config`;
      const res = await fetch(fetchUrl);
      
      let data;
      try {
        data = await res.json();
      } catch(e) {
        console.error(`Error parsing JSON for ${unidadeId}:`, e);
        continue;
      }
      
      if (!data || !data.success) {
        console.error(`Failed to fetch sheets for ${unidadeId}`, data?.error);
        continue;
      }
      
      // Check if data is empty!
      const principalLen = data.data.Plan_Principal ? data.data.Plan_Principal.length : 0;
      console.log(`${unidadeId} data received. Principal length: ${principalLen}`);
      
      if (principalLen === 0) {
         console.warn(`${unidadeId} HAS NO DATA FROM GOOGLE SCRIPT!`);
      }
      
      const payload = {
        unidade_id: unidadeId,
        carteira: data.data.Carteira_Planejador || [],
        principal: data.data.Plan_Principal || [],
        bd_metas: {
          bd_metas: data.data.BD_Metas || [],
          base_curva: data.data.Base_Curva || [],
          bd_config: data.data.BD_Config || []
        },
        reprogramadas: data.data.Reprogramadas || [],
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase.from('planejamento_cache').upsert(payload);
      if (error) {
        console.error(`Error upserting to Supabase for ${unidadeId}`, error);
      } else {
        console.log(`Successfully synced ${unidadeId}`);
      }
    } catch (e) {
      console.error(`Error processing ${unidadeId}`, e);
    }
    
    // Add small delay to be safe with Google rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log("Sync complete!");
}

run();
