import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:3000 ...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Check login as Admin
  console.log('Testing Admin login...');
  await page.fill('#loginUsername', 'admin');
  await page.fill('#loginPassword', 'admin123');
  await page.click('#btnLoginSubmit');
  await page.waitForTimeout(1000);

  // Check SITAC view as Admin
  await page.click('.nav-item[data-view="view-sitac"]');
  await page.waitForTimeout(500);

  const btnSitacAdmin = await page.$('#btnSitacMyTasks');
  const sitacVisible = await btnSitacAdmin?.isVisible();
  console.log('Admin SITAC MyTasks visible:', sitacVisible); // Should be false

  // Check Gangguan view as Admin
  await page.click('.nav-item[data-view="view-gangguan"]');
  await page.waitForTimeout(500);

  const btnGangguanAdmin = await page.$('#btnGangguanMyTasks');
  const gangguanVisible = await btnGangguanAdmin?.isVisible();
  console.log('Admin Gangguan MyTasks visible:', gangguanVisible); // Should be false

  // Check Admin modal email tab
  const btnUserManagement = await page.$('#btnUserManagement');
  if (btnUserManagement) {
    await btnUserManagement.click();
    await page.waitForTimeout(500);
    const tabEmail = await page.$('.admin-tab[data-tab="email"]');
    if (tabEmail) {
      console.log('Admin modal email tab found, clicking it...');
      await tabEmail.click();
      await page.waitForTimeout(400);
      const isPanelEmailVisible = await page.$eval('#tabPanelEmail', el => !el.classList.contains('hidden'));
      console.log('tabPanelEmail visible:', isPanelEmailVisible);
    }
    // Close modal
    await page.click('#btnCloseUserManagement');
    await page.waitForTimeout(400);
  }

  // Logout
  console.log('Logging out Admin...');
  await page.click('#btnLogout');
  await page.waitForTimeout(1000);

  // Login as PIC (Lapangan), e.g. Harlan / lapangan
  console.log('Testing PIC Lapangan login...');
  await page.fill('#loginUsername', 'harlan');
  await page.fill('#loginPassword', 'harlan123');
  await page.click('#btnLoginSubmit');
  await page.waitForTimeout(1000);

  // Check SITAC view as PIC
  await page.click('.nav-item[data-view="view-sitac"]');
  await page.waitForTimeout(500);

  const btnSitacPic = await page.$('#btnSitacMyTasks');
  const sitacPicVisible = await btnSitacPic?.isVisible();
  const sitacPicHasActive = await page.$eval('#btnSitacMyTasks', el => el.classList.contains('active'));
  console.log('PIC SITAC MyTasks visible:', sitacPicVisible, 'active:', sitacPicHasActive); // Should be true, true

  // Check Gangguan view as PIC
  await page.click('.nav-item[data-view="view-gangguan"]');
  await page.waitForTimeout(500);

  const btnGangguanPic = await page.$('#btnGangguanMyTasks');
  const gangguanPicVisible = await btnGangguanPic?.isVisible();
  const gangguanPicHasActive = await page.$eval('#btnGangguanMyTasks', el => el.classList.contains('active'));
  console.log('PIC Gangguan MyTasks visible:', gangguanPicVisible, 'active:', gangguanPicHasActive); // Should be true, true

  // Take screenshot
  await page.screenshot({ path: 'scratch/verify_pic_mytasks_visible.png' });
  console.log('Screenshot saved to scratch/verify_pic_mytasks_visible.png');

  await browser.close();
  console.log('Test completed successfully!');
})();
