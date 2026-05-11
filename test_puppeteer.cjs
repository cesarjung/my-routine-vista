const puppeteer = require('puppeteer'); 
(async () => { 
  const browser = await puppeteer.launch({headless: true}); 
  const page = await browser.newPage(); 
  page.on('console', msg => console.log('LOG:', msg.text())); 
  page.on('pageerror', err => console.log('ERROR:', err)); 
  try { 
    await page.goto('http://localhost:8080/'); 
    await page.evaluate(() => { 
      const btns = Array.from(document.querySelectorAll('span, p, a, div')); 
      const btn = btns.find(b => b.textContent === 'Carteira'); 
      if (btn) btn.click(); 
    }); 
    await new Promise(r => setTimeout(r, 2000)); 
  } catch(e) { 
    console.log('Script Error:', e); 
  } 
  await browser.close(); 
})();
