const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*?)\r?\n/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*?)\r?\n/);

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

async function check() {
    const now = new Date();

    const formatBound = (date, isEnd) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const time = isEnd ? '23:59:59' : '00:00:00';
        return `${year}-${month}-${day}T${time}-03:00`;
    };

    const startUtcOffset = formatBound(now, false);
    const endUtcOffset = formatBound(now, true);

    console.log('Querying due_date >=', startUtcOffset, 'and <=', endUtcOffset);

    const res = await fetch(`${supabaseUrl}/rest/v1/tasks?select=id,title,status,unit_id,routine_id,due_date,created_at&due_date=gte.${startUtcOffset}&due_date=lte.${endUtcOffset}`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });
    const tasks = await res.json();

    console.log(`Found ${tasks.length} tasks for today.`);

    // Count by unit
    const units = {};
    for (const t of tasks) {
        if (!units[t.unit_id]) units[t.unit_id] = 0;
        units[t.unit_id]++;
    }
    console.log('Task distribution by unit_id:', units);
    console.log('Sample tasks:', JSON.stringify(tasks.slice(0, 3), null, 2));

    // If there are routine objects for these tasks, let's fetch them
    const routineIds = [...new Set(tasks.map(t => t.routine_id).filter(Boolean))];
    if (routineIds.length > 0) {
        const q = `id=in.(${routineIds.join(',')})`;
        const resR = await fetch(`${supabaseUrl}/rest/v1/routines?select=id,title,frequency&${q}`, {
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        });
        console.log('Routines for these tasks:', await resR.json());
    }
}

check().catch(console.error);
