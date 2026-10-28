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
        page.on('request', req => req.url().startsWith(origin) && !req.url().includes('/api/')
            ? req.continue() : req.abort());
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${origin}/login.html`);
        const login = await page.evaluate(() => QaryaAuth.login('abdou@qarya.edu', 'Abdou'));
        assert.equal(login.ok, true);
        await page.goto(`${origin}/pages/leader-admin.html`);
        await page.waitForFunction(() => typeof window.editUserPermissions === 'function');
        await page.addStyleTag({ content: '* { animation: none !important; transition: none !important; }' });
        await page.evaluate(() => {
            // Exercise local UI mutations without waiting for unavailable network sync.
            for (const api of [QaryaAuth, QaryaPlatformStore, QaryaAdminAdvancedStore]) {
                api.syncNow = async () => true;
                api.refreshFromRemote = async () => true;
            }
        });
        await page.evaluate(() => switchTab('users-tab'));
        await page.evaluate(() => toggleUserStatus(encodeURIComponent('abdelrahman@qarya.edu')));
        await page.waitForSelector('#admin-pro-modal.is-open');
        assert.match(await page.$eval('#admin-pro-modal-title', el => el.textContent), /تنشيط/);
        await page.$eval('#pro-user-balance', el => { el.value = '0'; });
        await page.click('#admin-pro-modal-confirm');
        await page.waitForFunction(() => !document.querySelector('#admin-pro-modal.is-open'));
        const activated = await page.evaluate(() => QaryaAuth.getUserByEmail('abdelrahman@qarya.edu'));
        assert.equal(activated.isSuspended, false);
        assert.equal(activated.balance, 0, 'Zero balance must be saved');
        await page.evaluate(() => changeUserBalance(encodeURIComponent('abdelrahman@qarya.edu')));
        await page.select('#balance-operation', 'add');
        await page.$eval('#balance-amount', el => { el.value = '125.50'; });
        await page.waitForFunction(() => !document.querySelector('#admin-modal-confirm').disabled);
        await page.click('#admin-modal-confirm');
        await page.waitForFunction(() => !document.querySelector('#admin-modal.open'), { timeout: 8000 }).catch(async error => {
            console.log(await page.evaluate(() => ({ modal: document.querySelector('#admin-modal').innerText, toasts: document.body.innerText.slice(-1800), balance: QaryaAuth.getUserByEmail('abdelrahman@qarya.edu').balance })));
            throw error;
        });
        assert.equal(await page.evaluate(() => QaryaAuth.getUserByEmail('abdelrahman@qarya.edu').balance), 125.5);
        await page.evaluate(() => changeUserBalance(encodeURIComponent('abdelrahman@qarya.edu')));
        await page.select('#balance-operation', 'subtract');
        await page.$eval('#balance-amount', el => { el.value = '500'; });
        await page.click('#admin-modal-confirm');
        assert.ok(await page.$('#admin-modal.open'), 'Invalid deduction keeps editor open');
        assert.equal(await page.evaluate(() => QaryaAuth.getUserByEmail('abdelrahman@qarya.edu').balance), 125.5);
        await page.evaluate(() => closeAdminModal());
        await page.evaluate(() => toggleUserExam(encodeURIComponent('abdelrahman@qarya.edu')));
        assert.equal(await page.evaluate(() => QaryaAuth.getUserByEmail('abdelrahman@qarya.edu').examAllowed), false);
        await page.evaluate(() => toggleUserWithdrawal(encodeURIComponent('abdelrahman@qarya.edu')));
        await page.click('#admin-modal-confirm');
        await page.waitForFunction(() => !document.querySelector('#admin-modal.open'));
        assert.equal(await page.evaluate(() => QaryaAuth.getUserByEmail('abdelrahman@qarya.edu').withdrawalsEnabled), false);
        for (const width of [1440, 390]) {
            await page.setViewport({ width, height: 900 });
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `No overflow at ${width}px`);
        }
        await page.setViewport({ width: 1440, height: 1000 });
        await page.screenshot({ path: path.join(__dirname, '..', '.codex', 'admin-workspace-desktop.png'), fullPage: true });
        page.on('dialog', dialog => dialog.accept());
        await page.evaluate(() => archiveUserSnapshot(encodeURIComponent('abdelrahman@qarya.edu')));
        assert.equal(await page.evaluate(() => QaryaAuth.getAllUsers().some(user => user.email === 'abdelrahman@qarya.edu')), false);
        await page.evaluate(async () => {
            const archive = QaryaAdminAdvancedStore.getArchives().find(item => item.sourceId === 'abdelrahman@qarya.edu');
            await restoreArchiveItem(encodeURIComponent(archive.id));
        });
        assert.equal(await page.evaluate(() => QaryaAuth.getAllUsers().some(user => user.email === 'abdelrahman@qarya.edu')), true);
        assert.deepEqual(errors, []);
        console.log('PASS admin browser: activation, zero balance, addition, overdraft rejection, exam, withdrawal, responsive layout');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { server.closeAllConnections(); server.close(); });
