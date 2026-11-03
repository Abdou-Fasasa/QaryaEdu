const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');

// Run against isolated browser storage; no request may reach production services.
const root = path.resolve(__dirname, '..', 'app');
const server = http.createServer((req, res) => {
    const file = path.join(root, decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
    const type = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json' }[path.extname(file)];
    res.setHeader('Content-Type', type || 'application/octet-stream');
    res.end(fs.readFileSync(file));
});


(async () => {
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
 const origin = `http://127.0.0.1:${server.address().port}`;
 const browser = await puppeteer.launch({ headless: true });
 try {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', req => req.url().startsWith(origin) && !req.url().includes('/api/') ? req.continue() : req.abort());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${origin}/login.html`);
  assert.equal((await page.evaluate(() => QaryaAuth.login('abdou@qarya.edu', 'Abdou'))).ok, true);
  await page.goto(`${origin}/pages/leader-admin.html`);
  await page.waitForFunction(() => typeof window.deleteAllNotifications === 'function');
  await page.evaluate(() => {
   QaryaPlatformStore.addNotification({ id: 'old', title: 'قديم', createdAt: '2026-05-27T00:00:00Z' });
   QaryaPlatformStore.addNotification({ id: 'sticky-test', title: 'تنبيه مثبت للاختبار', body: 'يغلق نهائيًا', sticky: true, displayMode: 'floating' });
   window.dispatchEvent(new CustomEvent('qarya:store-updated'));
  });
  await page.waitForFunction(() => [...document.querySelectorAll('[data-managed-notification]')].some(el => el.textContent.includes('تنبيه مثبت للاختبار')));
  await page.evaluate(() => [...document.querySelectorAll('[data-managed-notification]')].find(el => el.textContent.includes('تنبيه مثبت للاختبار')).querySelector('.floating-notification-close').click());
  await page.evaluate(() => {
   QaryaPlatformStore.updateNotification('sticky-test', { body: 'نفس التنبيه بعد التحديث' });
   window.dispatchEvent(new CustomEvent('qarya:store-updated'));
  });
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('[data-managed-notification]')].some(el => el.textContent.includes('تنبيه مثبت للاختبار'))), false);
  await page.reload();
  await page.waitForFunction(() => typeof window.deleteAllNotifications === 'function');
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('[data-managed-notification]')].some(el => el.textContent.includes('تنبيه مثبت للاختبار'))), false);
  assert.equal(await page.evaluate(() => QaryaPlatformStore.getNotifications().some(n => n.id === 'old' || n.id === 'eid-adha-2026-gift')), false);
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  await page.evaluate(src => {
   QaryaPlatformStore.sendSupportMessage({ email: 'mohamed.shaban@qarya.edu', userName: 'طالب الصور', sender: 'user', text: 'صورة توضيحية', attachments: [{ src, name: 'صورة الاختبار' }] });
   QaryaPlatformStore.sendSupportMessage({ email: 'mohamed.shaban@qarya.edu', sender: 'user', text: 'رسالة ثانية' });
   switchTab('support-tab');
   selectSupportThread(encodeURIComponent('mohamed.shaban@qarya.edu'));
  }, png);
  await page.waitForSelector('.support-desk-stream .admin-support-message-attachment');
  assert.equal(await page.evaluate(() => QaryaPlatformStore.getSupportThreadByEmail('mohamed.shaban@qarya.edu').unreadByAdmin), 0);
  await page.click('.support-desk-stream .admin-support-message-attachment');
  await page.waitForSelector('.chat-image-viewer[open]');
  await page.click('[data-media-zoom]');
  assert.equal(await page.$eval('.chat-image-viewer img', img => img.classList.contains('is-zoomed')), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval('.chat-image-viewer', el => el.open), false);
  await page.evaluate(() => replySupportThread(encodeURIComponent('mohamed.shaban@qarya.edu')));
  await page.waitForSelector('#support-reply-images');
  await page.$eval('#support-reply-images', (input, src) => {
   const bytes = Uint8Array.from(atob(src.split(',')[1]), c => c.charCodeAt(0));
   const files = new DataTransfer(); files.items.add(new File([bytes], 'reply.png', { type: 'image/png' })); input.files = files.files;
   input.dispatchEvent(new Event('change', { bubbles: true }));
  }, png);
  assert.equal(await page.$$eval('#support-reply-preview img', els => els.length), 1);
  await page.click('#admin-pro-modal-confirm');
  await page.waitForFunction(() => !document.querySelector('#admin-pro-modal.is-open'));
  assert.equal(await page.evaluate(() => QaryaPlatformStore.getSupportThreadByEmail('mohamed.shaban@qarya.edu').messages.at(-1).attachments.length), 1);
  // One atomic server commit clears public/private/legacy notifications, preserving balances and chats.
  await page.evaluate(() => {
   const users = Object.fromEntries(QaryaAuth.getAllUsersRaw().map(user => [user.email.replace(/\./g, '_'), { ...user, privateNotifications: [{id:'private', createdAt:new Date().toISOString()}] }]));
   window.testRemote = { users, notifications: {legacy:{}}, global_notification: {title:'old'}, state: { auth: {users:Object.values(users)}, platform: { notifications: QaryaPlatformStore.getNotifications(), settings: QaryaPlatformStore.getPlatformSettings(), supportThreads: QaryaPlatformStore.getSupportThreads() } } };
   window.rootCommits = 0;
   QaryaFirebase = { db:{}, ref: (_, p='') => p, get: async () => ({val:()=>testRemote}), runTransaction: async (key, fn) => {
    if(key !== '') throw Error('Unexpected transaction path');
    fn(structuredClone(testRemote)); const next = fn(structuredClone(testRemote));
    testRemote = next; rootCommits++;
    return {committed:true, snapshot:{val:()=>structuredClone(testRemote)}};
   } };
  });
  page.on('dialog', d => d.accept());
  await page.evaluate(() => deleteAllNotifications());
  assert.equal(await page.evaluate(() => rootCommits), 1);
  assert.equal(await page.evaluate(() => QaryaPlatformStore.getNotifications().length), 0);
  assert.equal(await page.evaluate(() => Object.values(testRemote.users).every(user => user.privateNotifications.length === 0)), true);
  assert.equal(await page.evaluate(() => testRemote.state.platform.supportThreads.length > 0), true);
  assert.equal(await page.evaluate(() => testRemote.notifications === null && testRemote.global_notification === null), true);
  // Remove fake Firebase before pending background sync timers can run.
  await page.evaluate(() => { delete window.QaryaFirebase; });
  for (const width of [1440,390]) {
   await page.setViewport({width,height:950});
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `No horizontal overflow ${width}`);
   await page.screenshot({path:path.join(__dirname, '..', '.codex', `chat-${width}.png`),fullPage:true});
  }
  await page.evaluate(src => {
   const me = QaryaAuth.getSession();
   for(let i=0;i<12;i++) QaryaPlatformStore.sendSupportMessage({email:me.email,sender:'admin',text:`رد ${i}`,attachments:i===0?[{src,name:'صورة المستخدم'}]:[]});
   window.dispatchEvent(new CustomEvent('qarya:store-updated'));
  }, png);
  await page.waitForFunction(() => document.querySelector('.support-chat-badge').textContent === '١٢');
  await page.click('.support-chat-toggle');
  assert.equal(await page.evaluate(() => QaryaPlatformStore.getSupportThreadByEmail(QaryaAuth.getSession().email).unreadByUser), 12, 'Opening home does not mark unseen messages read');
  await page.click('[data-support-open-view="chat"]');
  await page.waitForFunction(() => QaryaPlatformStore.getSupportThreadByEmail(QaryaAuth.getSession().email).unreadByUser === 0);
  await page.waitForSelector('.support-chat-attachment');
  await page.$eval('.support-chat-attachment', link => link.click());
  await page.waitForSelector('.chat-image-viewer[open]');
  assert.equal(await page.$eval('.chat-image-viewer img', img => img.alt), 'صورة المستخدم');
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval('.support-chat-send-btn', el => { const box=el.getBoundingClientRect(); return box.top >= 0 && box.bottom <= innerHeight && box.right <= innerWidth; }), true, 'Composer send button stays in the viewport');
  await page.screenshot({path:path.join(__dirname, '..', '.codex', 'chat-user-mobile.png')});
  assert.deepEqual(errors, []);
  console.log('PASS notifications/chat: sticky close persists, old notices suppressed, images displayed/zoomed/replied, read counters, atomic bulk clear, responsive layout');
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { server.closeAllConnections(); server.close(); });
