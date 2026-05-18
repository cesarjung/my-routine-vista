const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL=([^\n\r]+)/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=([^\n\r]+)/);
const url = urlMatch[1].replace(/\"/g, '');
const key = keyMatch[1].replace(/\"/g, '');

fetch(url + '/rest/v1/planejamento_cache?select=*&unidade_id=eq.12', {
  headers: {
    'apikey': key,
    'Authorization': 'Bearer ' + key
  }
}).then(res => res.json()).then(res => {
  const data = res[0].data;
  console.log('HAS PRINCIPAL:', !!data.principal);
  if (data.principal) {
    console.log('PRINCIPAL LENGTH:', data.principal.length);
    console.log('PRINCIPAL ROW 1:', data.principal[1]);
  }
}).catch(console.error);
