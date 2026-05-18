const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL=([^\n\r]+)/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=([^\n\r]+)/);
const url = urlMatch[1].replace(/\"/g, '');
const key = keyMatch[1].replace(/\"/g, '');

fetch(url + '/rest/v1/planejamento_cache?select=*&limit=1', {
  headers: {
    'apikey': key,
    'Authorization': 'Bearer ' + key
  }
}).then(res => res.json()).then(res => {
  if (!res || !res.length) { console.log('NO ROWS IN DB'); return; }
  const data = res[0];
  let carteira = data.carteira;
  if (!carteira) return console.log('NO CARTEIRA');
  if (typeof carteira === 'string') carteira = JSON.parse(carteira);
  
  console.log('Total rows:', carteira.length);
  
  // Look for header in first 10 rows
  let headerRowIndex = -1;
  let targetColIndex = -1;
  
  for (let i = 0; i < Math.min(10, carteira.length); i++) {
     const row = carteira[i];
     if (!Array.isArray(row)) continue;
     const idx = row.findIndex(c => String(c).toLowerCase().includes('mo validado'));
     if (idx !== -1) {
         headerRowIndex = i;
         targetColIndex = idx;
         console.log(`FOUND HEADER at Row ${i + 1}, Col ${idx} (Spreadsheet Letter: ${String.fromCharCode(65 + Math.floor(idx/26) - 1)}${String.fromCharCode(65 + (idx%26))} or similar)`);
         console.log(`Column content: "${row[idx]}"`);
         break;
     }
  }
  
  if (targetColIndex !== -1) {
      // Print first 5 data rows for that column
      console.log('Sample data for that column:');
      for (let i = headerRowIndex + 1; i < Math.min(headerRowIndex + 6, carteira.length); i++) {
          console.log(`Row ${i+1}:`, carteira[i][targetColIndex]);
      }
      console.log('Sample data for column 35 (AJ):');
      for (let i = headerRowIndex + 1; i < Math.min(headerRowIndex + 6, carteira.length); i++) {
          console.log(`Row ${i+1}:`, carteira[i][35]);
      }
  } else {
      console.log('HEADER NOT FOUND. Printing row 4 (line 5):');
      console.log(carteira[4]);
      console.log('Printing row 5 (line 6):');
      console.log(carteira[5]);
  }
}).catch(console.error);
