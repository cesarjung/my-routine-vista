import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1];
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];
const s = createClient(url, key);
s.from('routines').select('*, tasks(*)').then(x => fs.writeFileSync('debug.json', JSON.stringify(x.data, null, 2)));
