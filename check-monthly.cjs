const fs = require('fs');
const { Client } = require('pg');

const envLocal = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '';
const env = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';

const match = envLocal.match(/DATABASE_URL=.*postgres:([^@]+)@([^\"']+)/) || env.match(/DATABASE_URL=.*postgres:([^@]+)@([^\"']+)/);

if (!match) {
    console.log('No DATABASE_URL found in .env');
    process.exit(1);
}

const pass = match[1];
const hostStr = match[2];
const connectionString = `postgresql://postgres:${pass}@${hostStr}?sslmode=require`;

const client = new Client({ connectionString, connectionTimeoutMillis: 5000 });

client.connect().then(async () => {
    const res = await client.query("SELECT id, title, frequency, is_active FROM routines WHERE title ILIKE '%Mensal%' OR title ILIKE '%Mensais%' OR frequency = 'mensal'");

    console.log('--- ALL MONTHLY ROUTINES ---');
    console.log(JSON.stringify(res.rows, null, 2));

    if (res.rows.length > 0) {
        const ids = res.rows.map(r => `'${r.id}'`).join(',');
        const taskRes = await client.query(`SELECT id, title, due_date, status, unit_id FROM tasks WHERE routine_id IN (${ids})`);
        console.log('\n--- THEIR TASKS ---');
        console.log('Total tasks:', taskRes.rows.length);

        const marchTasks = taskRes.rows.filter(t => new Date(t.due_date).getMonth() === 2);
        console.log('MARCH TASKS:', marchTasks.length);

        const aprilTasks = taskRes.rows.filter(t => new Date(t.due_date).getMonth() === 3);
        console.log('APRIL TASKS:', aprilTasks.length);

        if (taskRes.rows.length > 0) {
            console.log('\nFIRST 5 TASKS SAMPLE:');
            console.log(JSON.stringify(taskRes.rows.slice(0, 5), null, 2));
        }
    }

    await client.end();
}).catch(e => {
    console.error('PG ERROR:', e.message);
    process.exit(1);
});
