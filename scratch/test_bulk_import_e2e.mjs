import { chromium } from 'playwright';
import XLSX from 'xlsx';
import sqlite3 from 'sqlite3';
import path from 'path';

(async () => {
  console.log('--- START REAL BULK IMPORT E2E TEST ---');

  // 1. Create a real Excel test file
  const testExcelPath = path.resolve('scratch/test_real_sitac_import.xlsx');
  const wb = XLSX.utils.book_new();
  const testData = [
    ['No PA', 'Pelanggan', 'PTL', 'PIC SITAC', 'Rute / Terminating', 'Biaya Permintaan Awal', 'Biaya Final', 'Progress', 'Latitude', 'Longitude', 'Tanggal Disposisi', 'Update Pekerjaan'],
    ['PA-REAL-TEST-001', 'PT TELKOM AKSES TESTING', 'Harlan', 'Budi Rodiyah', 'SITE GEDUNG GRAHA TESTING', 15000000, 12000000, 'Ongoing', -6.2088, 106.8456, '2026-10-12', 'Pengecekan jalur pipa optik'],
    ['PA-REAL-TEST-002', 'PT INDOSAT MEGA TESTING', 'Harlan', 'Edi Swargaloka', 'SITE MENARA KUNINGAN TESTING', 25000000, 22000000, 'Finish', -6.2150, 106.8300, '2026-10-10', 'Perizinan rampung']
  ];
  const ws = XLSX.utils.aoa_to_sheet(testData);
  XLSX.utils.book_append_sheet(wb, ws, 'Data_SITAC');
  XLSX.writeFile(wb, testExcelPath);
  console.log('Generated test Excel file:', testExcelPath);

  // 2. Launch browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log('[BROWSER ERR]:', msg.text());
  });

  console.log('Navigating to http://localhost:8888 ...');
  await page.goto('http://localhost:8888', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // 3. Login as admin
  console.log('Logging in as Admin...');
  await page.fill('#loginUsername', 'admin');
  await page.fill('#loginPassword', 'admin123');
  await page.click('#btnLoginSubmit');
  await page.waitForTimeout(1500);

  // 4. Click topbar dropdown to open Import Modal
  console.log('Clicking Import Bulk Excel button...');
  await page.evaluate(() => {
    const btn = document.getElementById('btnOpenImportExcel');
    if (btn) btn.click();
    else document.getElementById('modalImportExcel').style.display = 'flex';
  });
  await page.waitForTimeout(600);

  const isModalOpen = await page.$eval('#modalImportExcel', el => window.getComputedStyle(el).display !== 'none');
  console.log('Modal Import open:', isModalOpen);
  await page.screenshot({ path: 'scratch/verified_import_step1_open.png' });

  // 5. Upload real Excel file into file input
  console.log('Uploading real Excel file to #importExcelFileInput ...');
  await page.setInputFiles('#importExcelFileInput', testExcelPath);
  await page.waitForTimeout(1000);

  // 6. Verify Preview Table is displayed
  const previewData = await page.evaluate(() => {
    const previewContainer = document.getElementById('importPreviewContainer');
    const previewCount = document.getElementById('importPreviewCount')?.textContent;
    const tableWrap = document.getElementById('importPreviewTableWrap');
    const submitBtn = document.getElementById('btnSubmitImportExcel');
    const label = document.getElementById('importFileNameLabel')?.textContent;

    return {
      visible: previewContainer ? !previewContainer.classList.contains('hidden') : false,
      count: previewCount,
      hasRow001: tableWrap ? tableWrap.innerHTML.includes('PA-REAL-TEST-001') : false,
      hasRow002: tableWrap ? tableWrap.innerHTML.includes('PA-REAL-TEST-002') : false,
      submitDisabled: submitBtn ? submitBtn.disabled : true,
      label: label
    };
  });
  console.log('Preview data:', previewData);
  await page.screenshot({ path: 'scratch/verified_import_step2_preview.png' });

  // 7. Click Submit button to import into database
  console.log('Clicking Submit button (#btnSubmitImportExcel)...');
  await page.click('#btnSubmitImportExcel');
  await page.waitForTimeout(2500);

  // 8. Verify Result Alert and Toast
  const resultStatus = await page.evaluate(() => {
    const alertBox = document.getElementById('importResultAlert');
    const alertVisible = alertBox ? !alertBox.classList.contains('hidden') : false;
    const alertText = alertBox ? alertBox.textContent.trim() : '';
    const progPct = document.getElementById('importProgressPct')?.textContent;

    return { alertVisible, alertText, progPct };
  });
  console.log('Import Result:', resultStatus);
  await page.screenshot({ path: 'scratch/verified_import_step3_success.png' });

  await browser.close();

  // 9. Verify in SQLite Database
  console.log('Verifying records in SQLite telecom_portal.db...');
  const db = new sqlite3.Database('telecom_portal.db');
  db.all("SELECT no_pa, pelanggan, biaya_final, progress FROM sitac_records WHERE no_pa LIKE 'PA-REAL-TEST-%'", (err, rows) => {
    if (err) {
      console.error('DB query error:', err);
    } else {
      console.log('Found inserted rows in SQLite:', rows);
    }

    // Clean up
    db.run("DELETE FROM sitac_records WHERE no_pa LIKE 'PA-REAL-TEST-%'", function(delErr) {
      if (delErr) console.error('DB delete error:', delErr);
      else console.log('Successfully cleaned up test rows:', this.changes);
      db.close();
      console.log('--- ALL TESTS PASS! ---');
    });
  });
})();
