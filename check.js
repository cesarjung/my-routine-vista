import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=\"(.*)\"/)[1].trim();
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=\"(.*)\"/)[1].trim();
const supabase = createClient(url, key);

async function check() {
  const { data: routines } = await supabase.from('routines').select('*').order('created_at', { ascending: false }).limit(5);
  fs.writeFileSync('debug-routines.json', JSON.stringify(routines, null, 2));

  if (routines && routines.length > 0) {
     const { data: tasks } = await supabase.from('tasks').select('*').in('routine_id', routines.map(r => r.id));
     fs.writeFileSync('debug-tasks.json', JSON.stringify(tasks, null, 2));
  }
}
check();
