const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read directly from .env.local because .env strings are sometimes stripped of quotes
const envLocal = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '';
const env = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';

const pullVal = (str, key) => {
    const match = str.match(new RegExp(`${key}=([^\\r\\n]+)`));
    return match ? match[1].trim().replace(/^"/, '').replace(/"$/, '') : null;
};

const url = pullVal(envLocal, 'VITE_SUPABASE_URL') || pullVal(env, 'VITE_SUPABASE_URL');
const key = pullVal(envLocal, 'VITE_SUPABASE_ANON_KEY') || pullVal(env, 'VITE_SUPABASE_ANON_KEY');

if (!url || !key) {
    console.error('Failed to parse URL or KEY from environment variables');
    process.exit(1);
}

const supabase = createClient(url, key);

const formatBound = (date, isEnd) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const time = isEnd ? '23:59:59' : '00:00:00';
    return `${year}-${month}-${day}T${time}-03:00`;
};

const now = new Date();
const startUtcOffset = formatBound(now, false);
const endUtcOffset = formatBound(now, true);

async function run() {
    console.log(`Querying from ${startUtcOffset} to ${endUtcOffset}`);
    const { data, error } = await supabase
        .from('tasks')
        .select('id, title, status, unit_id, due_date, units(name)')
        .gte('due_date', startUtcOffset)
        .lte('due_date', endUtcOffset);

    if (error) {
        console.error('API Error:', error);
        return;
    }

    console.log('Total tasks for Hoje:', Object.keys(data).length);

    if (data && data.length > 0) {
        const barreiras = data.filter(t => t.units && t.units.name === 'Barreiras');
        console.log('Barreiras count:', barreiras.length);
        barreiras.slice(0, 10).forEach(t => console.log(' ->', t.title, '| ID:', t.id));
    } else {
        console.log('API returned literally 0 tasks.');
    }
}
run();
