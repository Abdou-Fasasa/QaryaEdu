const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer');
(async () => {
 const browser = await puppeteer.launch({ headless: true });
 try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', r => r.abort());
  const html = fs.readFileSync(path.join(__dirname, '../app/pages/wallet.html'), 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  await page.setContent(html);
  await page.evaluate(() => {
   const user = { email: 'student@qarya.edu', name: 'Student', balance: 200 };
   window.tx = { email: user.email, txId: 'test', status: 'pending', amount: 100, confirmationCode: '123456', confirmationExpiresAt: new Date(Date.now()+60000).toISOString(), createdAt: new Date().toISOString() };
   window.confirmCalls = 0;
   window.QaryaAuth = {
    getSession: () => user, canAccessWallet: () => true, getUserByEmail: () => user,
    normalizeEmail: s => String(s).toLowerCase(), getTransactionsByEmail: () => [window.tx],
    refreshFromRemote: async () => {},
    confirmWithdrawalCode: async (_, id, code) => {
     window.confirmCalls++;
     await new Promise(r => setTimeout(r, 50));
     if (code !== '123456') return { ok: false, message: 'رمز التأكيد غير مطابق' };
     window.tx.confirmationVerifiedAt = new Date().toISOString();
     window.tx.confirmationStatus = 'verified';
     return { ok: true, transaction: window.tx };
    }
   };
  });
  await page.addScriptTag({ path: path.join(__dirname, '../app/js/wallet.js') });
  assert.equal(await page.$eval('#withdrawal-confirmation-panel', el => el.classList.contains('show')), true);
  await page.type('#withdrawal-confirmation-code', '000000');
  await page.$eval('#withdrawal-confirmation-form', el => el.requestSubmit());
  await page.waitForFunction(() => document.querySelector('#withdrawal-result').textContent.includes('غير مطابق'));
  assert.equal(await page.$eval('#withdrawal-confirmation-panel', el => el.classList.contains('show')), true);
  await page.$eval('#withdrawal-confirmation-code', el => { el.value = '123456'; });
  await page.$eval('#withdrawal-confirmation-form', el => { el.requestSubmit(); el.requestSubmit(); });
  await page.waitForFunction(() => !document.querySelector('#withdrawal-confirmation-panel').classList.contains('show'));
  assert.equal(await page.$eval('#withdrawal-confirmation-code', el => el.value), '');
  assert.equal(await page.evaluate(() => window.confirmCalls), 2, 'Double submission makes only one success request');
  assert.equal(await page.$eval('#withdrawal-result', el => el.textContent.includes('تم تأكيد رمز السحب بنجاح')), true);
  assert.deepEqual(errors, []);
  console.log('PASS wallet browser: invalid code remains visible, valid code clears and hides input, double submit guarded');
 } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
