const fs = require('fs');

const envLocal = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '';
const env = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';

const pullVal = (str, key) => {
    const match = str.match(new RegExp(key + '=([^\\r\\n]+)'));
    return match ? match[1].trim().replace(/^\\\"/, '').replace(/\\\"$/, '') : null;
};

const url = pullVal(envLocal, 'VITE_SUPABASE_URL') || pullVal(env, 'VITE_SUPABASE_URL');
const key = pullVal(envLocal, 'VITE_SUPABASE_ANON_KEY') || pullVal(env, 'VITE_SUPABASE_ANON_KEY');

async function run() {
    const req1 = await fetch(\`\${url}/rest/v1/routines?select=id,title,frequency,start_date,custom_schedule&is_active=eq.true&frequency=eq.mensal\`, {
    headers: { 'apikey': key, 'Authorization': \`Bearer \${key}\` }
  });
  
  if (!req1.ok) {
     console.log('Error:', await req1.text());
     return;
  }
  
  const monthlies = await req1.json();
  
  console.log('--- DB MONTHLY ROUTINES CONFIG ---');
  if (monthlies.length === 0) {
      console.log('No active monthly routines found.');
  } else {
      monthlies.forEach(r => {
          console.log(\`Routine: "\${r.title}"\`);
          console.log(\`  - start_date: \${r.start_date}\`);
          console.log(\`  - custom_schedule:\`, JSON.stringify(r.custom_schedule));
      });
  }
}
run();
