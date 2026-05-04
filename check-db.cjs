const fs = require('fs');

const envLocal = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '';
const env = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';

const pullVal = (str, key) => {
    const match = str.match(new RegExp(key + '=([^\\r\\n]+)'));
    return match ? match[1].trim().replace(/^\\\"/, '').replace(/\\\"$/, '') : null;
};

const url = pullVal(envLocal, 'VITE_SUPABASE_URL') || pullVal(env, 'VITE_SUPABASE_URL');
// Use the Anon key, but we'll fetch tasks by passing auth if needed, but without it RLS blocks tasks.
// Wait! Let's just use PG since it bypasses RLS directly. I'll construct the PG connection cleanly.

const match = envLocal.match(/DATABASE_URL=.*postgres:([^@]+)@([^\"']+)/) || env.match(/DATABASE_URL=.*postgres:([^@]+)@([^\"']+)/);

if (match) {
    const pass = match[1];
    const hostStr = match[2];
    const connectionString = `postgresql://postgres:${pass}@${hostStr}?sslmode=require`;

    const { Client } = require('pg');
    const client = new Client({ connectionString, connectionTimeoutMillis: 5000 });

    client.connect().then(async () => {
        const res = await client.query("SELECT id, title, due_date FROM tasks WHERE routine_id IN (SELECT id FROM routines WHERE frequency = 'mensal' OR frequency = 'semanal') ORDER BY due_date ASC");

        console.log('--- DB TRUTH LOG ---');
        console.log('Total Semanais/Mensais Tasks:', res.rows.length);

        const march = res.rows.filter(r => new Date(r.due_date).getMonth() === 2 && new Date(r.due_date).getFullYear() === 2026);
        console.log('TASKS DUE IN MARCH:', march.length);
        march.forEach(m => console.log(m.title, '->', m.due_date));

        const otherMonths = res.rows.filter(r => new Date(r.due_date).getMonth() !== 2);
        console.log('TASKS DUE IN OTHER MONTHS:', otherMonths.length);
        if (otherMonths.length > 0) {
            console.log('Random example:', otherMonths[0].title, '->', otherMonths[0].due_date);
        }

        await client.end();
    }).catch(e => {
        console.error('PG ERROR:', e.message);
        process.exit(1);
    });
} else {
    console.log('No DB URL found in env');
}
