import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=\"(.*)\"/)[1].trim();
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=\"(.*)\"/)[1].trim();
const supabase = createClient(url, key);

async function check() {
  console.log("Querying a row from planejamento_cache...");
  const { data, error } = await supabase.from('planejamento_cache').select('*').limit(1);
  if (error) {
    console.error("Error querying:", error);
  } else if (data && data.length > 0) {
    console.log("Keys in row:", Object.keys(data[0]));
    console.log("Row keys and types:");
    for (const [k, v] of Object.entries(data[0])) {
      console.log(`- ${k}: ${typeof v} (isNull: ${v === null})`);
    }
  } else {
    console.log("No rows in cache.");
  }
}
check();
