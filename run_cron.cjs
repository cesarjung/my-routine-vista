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
    const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
        email: 'cesar.jung@sirtec.com.br',
        password: '123456'
    });

    if (authError) {
        console.error("Login err:", authError);
        return;
    }

    // Chamar o RPC
    const { data: rpcData, error: rpcError } = await supabase.rpc('process_recurring_tasks');

    if (rpcError) {
        console.error("RPC Error:", rpcError);
    } else {
        console.log("RPC Success:", rpcData);
    }

    // Trazer as 10 ultimas pra ver se criou
    const { data, error } = await supabase
        .from('tasks')
        .select('id, title, start_date, due_date, parent_task_id, routine_id, is_recurring, status, created_at, unit_id')
        .order('created_at', { ascending: false })
        .limit(10);

    fs.writeFileSync('output.json', JSON.stringify(data, null, 2));
    console.log("Tarefas salvas em output.json");
}

run();
