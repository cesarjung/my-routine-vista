const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    if (line.includes('=')) {
        const [k, ...rest] = line.split('=');
        env[k.trim()] = rest.join('=').trim().replace(/['"]/g, '');
    }
});

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_PUBLISHABLE_KEY']);

async function run() {
    const { data: allRoutines } = await supabase.from('routines').select('id, title');
    const cdd = allRoutines.find(r => r.title === 'Check de Disponibilidade');

    if (!cdd) {
        console.log('No routine found. Available:', allRoutines.map(r => r.title));
        return;
    }

    const cdd_id = cdd.id;
    console.log('Found CDD:', cdd_id);

    const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, due_date, status, unit_id, assigned_to')
        .eq('routine_id', cdd_id)
        .gte('due_date', '2026-03-04T00:00:00Z')
        .not('parent_task_id', 'is', null);

    const { data: units } = await supabase.from('units').select('id, name');

    const { data: assignees } = await supabase
        .from('routine_assignees')
        .select('user_id, routine_id, profiles!inner(unit_id, full_name, email)')
        .eq('routine_id', cdd_id);

    fs.writeFileSync('db_tasks_dump.json', JSON.stringify({
        routine: cdd,
        tasks: tasks,
        units: units,
        assignees: assignees
    }, null, 2));

    console.log('Dados salvos em db_tasks_dump.json');
}

run();
