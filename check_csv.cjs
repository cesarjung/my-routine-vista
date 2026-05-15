const fs = require('fs');
const data = fs.readFileSync('carteira.csv', 'utf8');
const rows = data.split('\n');

const header = rows[5].split('","');
console.log("Headers:");
for(let i=0; i<header.length; i++) {
    console.log(`[${i}] ${header[i].replace(/"/g, '')}`);
}

const row6 = rows[6].split('","');
console.log("\nRow 6:");
for(let i=0; i<row6.length; i++) {
    console.log(`[${i}] ${row6[i].replace(/"/g, '')}`);
}
