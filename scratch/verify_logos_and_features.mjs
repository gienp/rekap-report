import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err));

  console.log('Navigating to http://localhost:8888 ...');
  await page.goto('http://localhost:8888', { waitUntil: 'networkidle' });

  // 1. Check Login page Dark mode
  await page.screenshot({ path: 'scratch/verify_login_dark.png' });
  console.log('Screenshot verify_login_dark.png captured');

  // 2. Check Login page Light mode
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'light');
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'scratch/verify_login_light.png' });
  console.log('Screenshot verify_login_light.png captured');

  // Switch back to dark for login
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  });

  // Login as admin
  console.log('Logging in as admin...');
  await page.fill('#loginUsername', 'admin');
  await page.fill('#loginPassword', 'admin123');
  await page.click('#btnLoginSubmit');
  await page.waitForTimeout(1500);

  // 3. Capture Dashboard Dark Mode (showing brand in sidebar)
  await page.screenshot({ path: 'scratch/verify_dashboard_dark.png' });
  console.log('Screenshot verify_dashboard_dark.png captured');

  // 4. Capture Dashboard Light Mode (showing brand in sidebar)
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'light');
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'scratch/verify_dashboard_light.png' });
  console.log('Screenshot verify_dashboard_light.png captured');

  // 5. Open User Management Modal and click Email tab
  const btnUserManagement = await page.$('#btnUserManagement');
  if (btnUserManagement) {
    await btnUserManagement.click();
    await page.waitForTimeout(600);
    const tabEmail = await page.$('.admin-tab[data-tab="email"]');
    if (tabEmail) {
      await tabEmail.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: 'scratch/verify_admin_email_tab.png' });
      console.log('Screenshot verify_admin_email_tab.png captured');
    }
  }

  await browser.close();
  console.log('Verification finished successfully!');
})();
