const puppeteer = require('puppeteer'); 
(async () => { 
  const browser = await puppeteer.launch({headless: true}); 
  const page = await browser.newPage(); 
  page.on('console', msg => console.log('LOG:', msg.text())); 
  page.on('pageerror', err => console.log('ERROR:', err.toString())); 
  try { 
    await page.goto('http://localhost:8080/', {waitUntil: 'networkidle2'}); 
    await page.evaluate(() => { 
      // Click on Planejamento button in Sidebar
      const buttons = Array.from(document.querySelectorAll('button, a, div'));
      const planBtn = buttons.find(b => b.textContent && b.textContent.includes('Planejamento'));
      if (planBtn) planBtn.click();
    }); 
    await new Promise(r => setTimeout(r, 2000));
    await page.evaluate(() => { 
      // Click on Carteira
      const buttons = Array.from(document.querySelectorAll('button, a, div, span'));
      const cartBtn = buttons.find(b => b.textContent && b.textContent.trim() === 'Carteira');
      if (cartBtn) cartBtn.click();
    }); 
    await new Promise(r => setTimeout(r, 3000));
  } catch(e) { 
    console.log('Script Error:', e); 
  } 
  await browser.close(); 
})();
