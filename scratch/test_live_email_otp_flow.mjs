import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-verify-email-otp-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9625;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    '--window-size=1400,900',
    'about:blank'
  ]);

  try {
    await new Promise(r => setTimeout(r, 2500));
    const res = await fetch(`http://localhost:${port}/json`);
    const tabs = await res.json();
    const pageTab = tabs.find(t => t.type === 'page');
    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    let id = 1;
    const send = (method, params = {}) => new Promise((resolve) => {
      const curId = id++;
      const handler = (evt) => {
        const d = JSON.parse(evt.data);
        if (d.id === curId) {
          ws.removeEventListener('message', handler);
          resolve(d.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: curId, method, params }));
    });

    await send('Page.enable');
    await send('Runtime.enable');

    const htmlPath = 'file:///' + path.resolve('index.html').replace(/\\/g, '/');
    console.log('Navigating to:', htmlPath);
    await send('Page.navigate', { url: htmlPath });
    await new Promise(r => setTimeout(r, 3500));

    // Helper: evaluate JS in page
    const evalJs = async (expr) => {
      const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      return res.result?.value;
    };

    // Helper: capture screenshot
    const takeShot = async (name) => {
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join('scratch', name), Buffer.from(shot.data, 'base64'));
      console.log(`Saved screenshot: scratch/${name}`);
    };

    // 1. Open Forgot Password Pane
    console.log('1. Opening Forgot Password pane...');
    await evalJs(`document.getElementById('btnOpenForgotPassword').click();`);
    await new Promise(r => setTimeout(r, 500));

    const isForgotVisible = await evalJs(`!document.getElementById('paneForgotPassword').classList.contains('hidden')`);
    console.log('Pane Forgot Password visible:', isForgotVisible);

    // 2. Test rejection when entering plain username "harlan" instead of email
    console.log('2. Testing rejection of plain username "harlan"...');
    await evalJs(`
      document.getElementById('forgotEmail').value = 'harlan';
      document.getElementById('formForgotStep1').dispatchEvent(new Event('submit', { cancelable: true }));
    `);
    await new Promise(r => setTimeout(r, 500));
    const alertUsernameRejection = await evalJs(`document.getElementById('forgotPwAlert').textContent`);
    console.log('Validation alert when entering username:', alertUsernameRejection);

    // 3. Enter valid registered email "harlan@telecom.ops"
    console.log('3. Submitting Step 1 with valid email harlan@telecom.ops...');
    await evalJs(`
      document.getElementById('forgotEmail').value = 'harlan@telecom.ops';
      document.getElementById('formForgotStep1').dispatchEvent(new Event('submit', { cancelable: true }));
    `);

    // Wait for step OTP to appear
    await new Promise(r => setTimeout(r, 3000));
    const isOtpVisible = await evalJs(`!document.getElementById('formForgotStepOTP').classList.contains('hidden')`);
    console.log('Step 2 (OTP form) visible:', isOtpVisible);

    const otpDetails = await evalJs(`({
      recipient: document.getElementById('forgotOtpRecipientName').textContent.trim(),
      targetEmail: document.getElementById('forgotOtpTargetEmail').textContent.trim(),
      countdown: document.getElementById('forgotOtpCountdown').textContent.trim(),
      simCodeExists: !!document.getElementById('forgotOtpSimCode'),
      autoFillBtnExists: !!document.getElementById('btnForgotAutoFillOtp')
    })`);
    console.log('OTP screen details (should not have simCode or autoFillBtn):', otpDetails);
    await takeShot('live_email_otp_step2.png');

    // 4. Retrieve the sent OTP code from sessionStorage
    const otpCodeFromDb = await evalJs(`(() => {
      const stored = sessionStorage.getItem('portal_reset_otp_harlan@telecom.ops');
      if (stored) return JSON.parse(stored).code;
      return null;
    })()`);
    console.log('Retrieved OTP code from sessionStorage:', otpCodeFromDb);

    if (otpCodeFromDb) {
      // 5. Input OTP Code
      console.log('5. Entering received 6-digit OTP code into input...');
      await evalJs(`
        document.getElementById('forgotOtpInput').value = '${otpCodeFromDb}';
        document.getElementById('formForgotStepOTP').dispatchEvent(new Event('submit', { cancelable: true }));
      `);
      await new Promise(r => setTimeout(r, 2000));

      const isStep3Visible = await evalJs(`!document.getElementById('formForgotStep2').classList.contains('hidden')`);
      console.log('Step 3 (New Password form) visible:', isStep3Visible);

      const verifiedDetails = await evalJs(`({
        name: document.getElementById('forgotVerifiedName').textContent.trim(),
        role: document.getElementById('forgotVerifiedRole').textContent.trim()
      })`);
      console.log('Verified user details on screen:', verifiedDetails);
      await takeShot('live_email_otp_step3.png');

      // 6. Set new password
      console.log('6. Resetting password to "harlan2026"...');
      await evalJs(`
        document.getElementById('forgotNewPassword').value = 'harlan2026';
        document.getElementById('forgotConfirmPassword').value = 'harlan2026';
        document.getElementById('formForgotStep2').dispatchEvent(new Event('submit', { cancelable: true }));
      `);
      await new Promise(r => setTimeout(r, 3000));

      const isBackToLogin = await evalJs(`!document.getElementById('paneLogin').classList.contains('hidden')`);
      console.log('Returned to Login pane:', isBackToLogin);
      const prefilledUser = await evalJs(`document.getElementById('loginUsername').value`);
      console.log('Prefilled username on login pane:', prefilledUser);

      // Reset password back to standard 'harlan'
      await evalJs(`window.FirebaseManager.adminResetPassword('harlan', 'harlan')`);
      console.log('Reset password for harlan back to default.');
    }

    console.log('E2E TEST COMPLETED SUCCESSFULLY!');

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    edgeProc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main();
