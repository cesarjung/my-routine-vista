const fs = require('fs');
const lines = fs.readFileSync('.env', 'utf8').split('\n');
let url = '';
let key = '';
for (let l of lines) {
  if (l.includes('VITE_SUPABASE_URL=')) url = l.split('=')[1].replace(/"/g, '').trim();
  if (l.includes('VITE_SUPABASE_PUBLISHABLE_KEY=')) key = l.split('=')[1].replace(/"/g, '').trim();
}
fetch(url + '/rest/v1/planejamento_cache?select=unidade_id,principal', {
  headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
}).then(r => r.json()).then(data => {
  if (!data || data.length === 0) { console.log("NO DATA DUMPED"); return; }
  let found = 0;
  for (let d of data) {
    if (!d.principal) continue;
    for (let r of d.principal) {
      if (r[20] && String(r[20]).trim() !== '' && String(r[20]).trim() !== '-') {
        console.log(`Unidade ${d.unidade_id} has non-empty row[20]: ${r[20]}`);
        found++;
        if (found > 10) break;
      }
    }
    if (found > 10) break;
  }
  if (found === 0) console.log("COLUMN 20 IS COMPLETELY EMPTY OR '-' FOR ALL UNITS!");
}).catch(e => console.error(e));
