const https = require('https');
const url = 'https://docs.google.com/spreadsheets/d/1OTHF2ytEOjGgfE49paARXkz9GjaklOQC_UhiXwUjC2E/gviz/tq?tqx=out:csv&sheet=Carteira_Planejador';

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const rows = data.split('\n');
    console.log("Total rows:", rows.length);
    for (let i = 6; i < Math.min(15, rows.length); i++) {
        const cols = rows[i].split('","');
        if (cols.length > 8) {
            console.log(`Row ${i} index 8: ${cols[8]}`);
        }
    }
  });
}).on('error', (err) => {
  console.log("Error: " + err.message);
});
