import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1080 });
  await page.goto('https://analytics-811fc.web.app', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));
  
  // Close banner if open
  await page.evaluate(() => {
    const closeBtn = document.querySelector('#bannerExpiringAlert button');
    if (closeBtn) closeBtn.click();
  });

  // Switch to rev sharing
  await page.evaluate(() => {
    document.querySelector('.nav-item[data-view="collo-rev-sharing"]')?.click();
  });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'scratch/rev_sharing_full.png' });

  // Switch to alerts
  await page.evaluate(() => {
    document.querySelector('.nav-item[data-view="collo-alerts"]')?.click();
  });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'scratch/alerts_full.png' });

  await browser.close();
  console.log('Screenshots captured successfully!');
})();
