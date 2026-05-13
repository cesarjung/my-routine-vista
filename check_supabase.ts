import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(__dirname, '.env.local');
const env = fs.readFileSync(envPath, 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1];
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1];

if (url && key) {
  const supabase = createClient(url, key);
  supabase.from('planejamento_cache').select('unidade_id, updated_at').then(res => {
    console.log(JSON.stringify(res.data, null, 2));
  });
} else {
  console.log("Could not read credentials");
}
