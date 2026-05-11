const puppeteer = require('puppeteer'); 
(async () => { 
  const browser = await puppeteer.launch({headless: true}); 
  const page = await browser.newPage(); 
  page.on('console', msg => console.log('LOG:', msg.text())); 
  page.on('pageerror', err => console.log('ERROR:', err.toString())); 
  try { 
    // Set a known state in local storage to bypass login if needed
    // Or just visit the page directly if it doesn't redirect
    await page.goto('http://localhost:8080/planejamento/carteira'); 
    await new Promise(r => setTimeout(r, 5000));
  } catch(e) { 
    console.log('Script Error:', e); 
  } 
  await browser.close(); 
})();
