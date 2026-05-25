const fs = require('fs');
const lines = fs.readFileSync('.env', 'utf8').split('\n');
let url = '';
let key = '';
for (let l of lines) {
  if (l.includes('VITE_SUPABASE_URL=')) url = l.split('=')[1].replace(/"/g, '').trim();
  if (l.includes('VITE_SUPABASE_PUBLISHABLE_KEY=')) key = l.split('=')[1].replace(/"/g, '').trim();
}
fetch(url + '/rest/v1/planejamento_cache?select=unidade_id', {
  headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
}).then(r => r.json()).then(d => {
  console.log('Total rows for all units:', d.length);
  const units = [...new Set(d.map(r => r.unidade_id))];
  console.log('Units with data:', units);
});
