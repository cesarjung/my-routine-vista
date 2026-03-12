import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Capture console messages
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log('BROWSER ERROR CONSOLE:', msg.text());
        } else {
            console.log('BROWSER CONSOLE:', msg.text());
        }
    });

    // Capture page errors (unhandled exceptions)
    page.on('pageerror', error => {
        console.log('PAGE ERROR (Exception):', error.message);
    });

    // Capture network errors
    page.on('requestfailed', request => {
        console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText);
    });

    console.log('Navigating to http://localhost:8080 ...');

    try {
        await page.goto('http://localhost:8080', { waitUntil: 'networkidle0', timeout: 30000 });
        console.log('Page loaded successfully. Waiting 3 seconds for React to mount...');
        await new Promise(r => setTimeout(r, 3000));
    } catch (err) {
        console.log('Navigation Error:', err);
    } finally {
        await browser.close();
    }
})();
