const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    if (line.includes('=')) {
        const [k, v] = line.split('=');
        env[k.trim()] = v.trim().replace(/['"]/g, '');
    }
});

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_PUBLISHABLE_KEY']);

async function run() {
    const { data: routines } = await supabase
        .from('routines')
        .select('id, title, sector_id, sector:sectors(id, name)');

    const { data: units } = await supabase.from('units').select('id, name');

    const { data: assignees } = await supabase
        .from('routine_assignees')
        .select('user_id, routine_id, profiles(unit_id, full_name)');

    fs.writeFileSync('db_dump.json', JSON.stringify({ routines, units, assignees }, null, 2));
    console.log('Dados salvos em db_dump.json');
}

run();
