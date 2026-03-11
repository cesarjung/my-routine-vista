const fs = require('fs');
const envLocal = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '';
const env = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
const pullVal = (str, key) => { const match = str.match(new RegExp(key + '=([^\\r\\n]+)')); return match ? match[1].trim().replace(/^\\\"/, '').replace(/\\\"$/, '') : null; };
const url = pullVal(envLocal, 'VITE_SUPABASE_URL') || pullVal(env, 'VITE_SUPABASE_URL');
const key = pullVal(envLocal, 'SUPABASE_SERVICE_ROLE_KEY') || pullVal(env, 'SUPABASE_SERVICE_ROLE_KEY');

async function run() {
    if (!key) return console.log('No service key');

    const query = `
    SELECT tablename, policyname, roles, cmd, qual, with_check 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename IN ('tasks', 'routines', 'task_assignees', 'routine_assignees');
  `;

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(url, key);

    const { data, error } = await supabase.rpc('run_sql', { query_text: query }).catch(async () => {
        // If run_sql doesn't work, maybe we have a custom execute_sql or we can just run via REST if we have one.
        return { error: 'RPC failed' };
    });

    if (error) {
        console.log('Need a direct pg connection script');
    } else {
        console.log(data);
    }
}
run();
