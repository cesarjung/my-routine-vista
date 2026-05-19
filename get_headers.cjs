const fs = require('fs');
let env = fs.readFileSync('.env', 'utf8');

const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.*)/) || env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const url = urlMatch[1].trim().replace(/['"]/g, '');
const key = keyMatch[1].trim().replace(/['"]/g, '');

fetch(url + '/rest/v1/planejamento_cache?select=*', {
  headers: {
    'apikey': key,
    'Authorization': 'Bearer ' + key
  }
}).then(res => res.json()).then(data => {
  const row = data.find(d => d.principal && d.principal.length > 5);
  if (row) {
     const headers = row.principal[5];
     headers.forEach((h, i) => console.log(i + ': ' + h));
  } else {
     console.log('No valid data found');
  }
}).catch(console.error);
