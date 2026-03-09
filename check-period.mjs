import fs from 'fs';

const envLocal = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '';
const env = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';

const pullVal = (str, key) => {
    const match = str.match(new RegExp(key + '=([^\\r\\n]+)'));
    return match ? match[1].trim().replace(/^\\\"/, '').replace(/\\\"$/, '') : null;
};

const url = pullVal(envLocal, 'VITE_SUPABASE_URL') || pullVal(env, 'VITE_SUPABASE_URL');
const key = pullVal(envLocal, 'VITE_SUPABASE_ANON_KEY') || pullVal(env, 'VITE_SUPABASE_ANON_KEY');

async function run() {
    const req1 = await fetch(\`\${url}/rest/v1/routines?select=id,title,frequency,is_active&is_active=eq.true\`, {
    headers: { 'apikey': key, 'Authorization': \`Bearer \${key}\` }
  });
  const routines = await req1.json();
  const weeklies = routines.filter(r => r.frequency === 'semanal');
  const monthlies = routines.filter(r => r.frequency === 'mensal');
  
  console.log('--- WEEKLIES ---');
  weeklies.forEach(r => console.log(r.title));
  console.log('--- MONTHLIES ---');
  monthlies.forEach(r => console.log(r.title));

  console.log('\\nFetching tasks for March...');
  // Testing exactly what 'Este mês' sends:
  const req2 = await fetch(\`\${url}/rest/v1/tasks?select=id,title,due_date,routine_id,unit_id&due_date=gte.2026-03-01T00:00:00-03:00&due_date=lte.2026-03-31T23:59:59-03:00&status=eq.pendente\`, {
    headers: { 'apikey': key, 'Authorization': \`Bearer \${key}\` }
  });
  const tasks = await req2.json();

  console.log('Total Pending Tasks in March:', tasks.length);
  
  const weeklyTaskCount = tasks.filter(t => weeklies.find(r => r.id === t.routine_id)).length;
  const monthlyTaskCount = tasks.filter(t => monthlies.find(r => r.id === t.routine_id)).length;
  
  console.log('Weekly tasks inside March:', weeklyTaskCount);
  console.log('Monthly tasks inside March:', monthlyTaskCount);
}
run().catch(console.error);
