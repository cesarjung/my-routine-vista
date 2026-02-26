const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
let supabaseUrl = '';
let supabaseKey = '';

envFile.split('\n').forEach(line => {
    if (line.startsWith('VITE_SUPABASE_URL=')) {
        supabaseUrl = line.split('=')[1].trim().replace(/['"]/g, '').replace(/\r$/, '');
    }
    if (line.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY=')) {
        supabaseKey = line.split('=')[1].trim().replace(/['"]/g, '').replace(/\r$/, '');
    }
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: auth } = await supabase.auth.signInWithPassword({
        email: 'cesar.jung@sirtec.com.br',
        password: '123456'
    });

    const { data, error } = await supabase
        .from('tasks')
        .select('id, title, start_date, due_date, parent_task_id, routine_id, is_recurring, status, created_at, unit_id')
        .like('due_date', '2026-02-26%');

    fs.writeFileSync('output_26.json', JSON.stringify(data, null, 2));
}

run();
