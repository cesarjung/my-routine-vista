import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=\"(.*)\"/)[1].trim();
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=\"(.*)\"/)[1].trim();
const supabase = createClient(url, key);
supabase.from('routines').select('id, title, time_start, time_end').limit(5).then(res => console.log('routines:', res.data));
supabase.from('routine_periods').select('id, period_start, period_end').limit(5).then(res => console.log('periods:', res.data));
