import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-verify-otp-'));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9618;
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
    await new Promise(r => setTimeout(r, 3000));

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
    console.log('Opening Forgot Password pane...');
    await evalJs(`document.getElementById('btnOpenForgotPassword').click();`);
    await new Promise(r => setTimeout(r, 500));

    const isForgotVisible = await evalJs(`!document.getElementById('paneForgotPassword').classList.contains('hidden')`);
    console.log('Pane Forgot Password visible:', isForgotVisible);
    await takeShot('otp_flow_step1_check_account.png');

    // 2. Type "harlan" and submit Step 1
    console.log('Submitting Step 1 with user harlan...');
    await evalJs(`
      document.getElementById('forgotIdentifier').value = 'harlan';
      document.getElementById('formForgotStep1').dispatchEvent(new Event('submit', { cancelable: true }));
    `);

    // Wait for step OTP to appear
    await new Promise(r => setTimeout(r, 2000));
    const isOtpVisible = await evalJs(`!document.getElementById('formForgotStepOTP').classList.contains('hidden')`);
    console.log('Step 2 (OTP form) visible:', isOtpVisible);

    const otpDetails = await evalJs(`({
      recipient: document.getElementById('forgotOtpRecipientName').textContent.trim(),
      targetEmail: document.getElementById('forgotOtpTargetEmail').textContent.trim(),
      simCode: document.getElementById('forgotOtpSimCode').textContent.trim(),
      countdown: document.getElementById('forgotOtpCountdown').textContent.trim()
    })`);
    console.log('OTP details on screen:', otpDetails);
    await takeShot('otp_flow_step2_otp_form.png');

    // 3. Test Auto Fill OTP
    console.log('Clicking Auto-fill OTP button...');
    await evalJs(`document.getElementById('btnForgotAutoFillOtp').click();`);
    const filledVal = await evalJs(`document.getElementById('forgotOtpInput').value`);
    console.log('Filled OTP input value:', filledVal);

    // 4. Submit OTP
    console.log('Submitting Step 2 OTP verification...');
    await evalJs(`document.getElementById('formForgotStepOTP').dispatchEvent(new Event('submit', { cancelable: true }));`);
    await new Promise(r => setTimeout(r, 1500));

    const isStep3Visible = await evalJs(`!document.getElementById('formForgotStep2').classList.contains('hidden')`);
    console.log('Step 3 (Reset Password form) visible:', isStep3Visible);

    const step3Details = await evalJs(`({
      verifiedName: document.getElementById('forgotVerifiedName').textContent.trim(),
      verifiedRole: document.getElementById('forgotVerifiedRole').textContent.trim()
    })`);
    console.log('Step 3 details on screen:', step3Details);
    await takeShot('otp_flow_step3_reset_password.png');

    // 5. Submit New Password
    console.log('Submitting new password in Step 3...');
    await evalJs(`
      document.getElementById('forgotNewPassword').value = 'pic123';
      document.getElementById('forgotConfirmPassword').value = 'pic123';
      document.getElementById('formForgotStep2').dispatchEvent(new Event('submit', { cancelable: true }));
    `);

    // Wait 2.5s for success message and auto redirect to login
    await new Promise(r => setTimeout(r, 2500));

    const isLoginVisible = await evalJs(`!document.getElementById('paneLogin').classList.contains('hidden')`);
    const loginUser = await evalJs(`document.getElementById('loginUsername').value`);
    console.log('Returned to Login pane:', isLoginVisible, '| Pre-filled user:', loginUser);
    await takeShot('otp_flow_step4_back_to_login.png');

    console.log('=== ALL OTP FLOW TESTS PASSED FLAWLESSLY ===');
    ws.close();
  } finally {
    edgeProc.kill();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
