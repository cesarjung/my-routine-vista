const { Client } = require('pg');
const fs = require('fs');

const envLocal = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '';
const env = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';

const pullVal = (str, key) => {
    const match = str.match(new RegExp(`${key}=([^\\r\\n]+)`));
    return match ? match[1].trim().replace(/^"/, '').replace(/"$/, '') : null;
};

const connectionString = pullVal(envLocal, 'DATABASE_URL') || pullVal(env, 'DATABASE_URL');

const client = new Client({
    connectionString: connectionString,
});

async function run() {
    await client.connect();

    const res = await client.query(`
    SELECT r.id, r.title, r.frequency, r.skip_weekends, r.created_at
    FROM tasks t
    JOIN routines r ON t.routine_id = r.id
    WHERE t.id = '76c4cbac-2104-4518-9b64-e4cb6545c4e7'
  `);
    console.log("Routine:", res.rows[0]);

    const tasksRes = await client.query(`
    SELECT count(*) as total_hoje
    FROM tasks
    WHERE due_date >= '2026-03-08T00:00:00-03:00'
      AND due_date <= '2026-03-08T23:59:59-03:00'
      AND unit_id = '35c3ae18-8488-42ae-9f7f-f7d6ea9fa64a'
  `);
    console.log("Total tarefas de Barreiras Hoje:", tasksRes.rows[0].total_hoje);

    const barreirasName = await client.query(`
    SELECT name FROM units WHERE id = '35c3ae18-8488-42ae-9f7f-f7d6ea9fa64a'
  `);
    console.log("Unit Name:", barreirasName.rows[0]?.name);

    await client.end();
}
run();
