const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class MemoryStorage {
    constructor() { this.values = new Map(); }
    getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
    setItem(key, value) { this.values.set(key, String(value)); }
    removeItem(key) { this.values.delete(key); }
    clear() { this.values.clear(); }
}

const localStorage = new MemoryStorage();
const sessionStorage = new MemoryStorage();
const listeners = new Map();
const headNodes = [];

const document = {
    head: {
        querySelector() { return null; },
        appendChild(node) { headNodes.push(node); }
    },
    visibilityState: 'visible',
    createElement(tagName) {
        return {
            tagName: String(tagName).toUpperCase(),
            dataset: {},
            addEventListener() {},
            setAttribute() {}
        };
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {}
};

const context = {
    console,
    document,
    localStorage,
    sessionStorage,
    navigator: { userAgent: 'QaryaEdu automated test', userAgentData: {} },
    location: { pathname: '/app/login.html', replace() {}, href: '' },
    CustomEvent: class CustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
    fetch: async (url) => String(url).includes('ipapi.co')
        ? { ok: true, json: async () => ({ ip: '198.51.100.7' }) }
        : { ok: false },
    setTimeout: () => 0,
    clearTimeout() {},
    setInterval: () => 0,
    clearInterval() {},
    addEventListener(type, listener) { listeners.set(type, listener); },
    dispatchEvent() {},
    Date,
    JSON,
    Map,
    Set,
    Promise,
    URLSearchParams
};
context.window = context;

const source = fs.readFileSync(path.join(__dirname, '..', 'app', 'js', 'auth.js'), 'utf8');
vm.runInNewContext(source, context, { filename: 'auth.js' });

(async () => {
    const auth = context.QaryaAuth;
    assert.ok(auth, 'QaryaAuth should initialize');

    const users = auth.getAllUsers();
    const activeEmails = Array.from(users.filter((user) => !user.isSuspended), (user) => String(user.email)).sort();
    assert.deepEqual(activeEmails, [
        'abdou@qarya.edu',
        'gehad@qarya.edu',
        'mohamed.shaban@qarya.edu'
    ]);

    const gehad = auth.getUserByEmail('gehad@qarya.edu');
    assert.equal(gehad.loginAccessMode, 'device_notice');
    assert.equal(gehad.loginDeviceLabel, 'Galaxy A12');

    const noticeResult = await auth.login('gehad@qarya.edu', '12356');
    assert.equal(noticeResult.ok, false);
    assert.match(noticeResult.message, /Galaxy A12/);
    assert.match(noticeResult.message, /IP/);

    const ipUpdateResult = await auth.updateUserPersistentData('gehad@qarya.edu', {
        loginAccessMode: 'device_notice',
        loginDeviceLabel: 'Galaxy A12',
        primaryDeviceIp: '198.51.100.7',
        loginAccessPolicyVersion: 1
    });
    assert.equal(ipUpdateResult.ok, true);
    const ipLoginResult = await auth.login('gehad@qarya.edu', '12356');
    assert.equal(ipLoginResult.ok, true);
    auth.logout();

    const updateResult = await auth.updateUserPersistentData('gehad@qarya.edu', {
        loginAccessMode: 'direct',
        loginDeviceLabel: 'Galaxy A12',
        loginAccessPolicyVersion: 1
    });
    assert.equal(updateResult.ok, true);

    const directResult = await auth.login('gehad@qarya.edu', '12356');
    assert.equal(directResult.ok, true);
    auth.logout();
    localStorage.removeItem('qaryaeduStudentDeviceOwner');

    const normalizedPasswordResult = await auth.login(' gehad@qarya.edu ', ' ١٢٣٥٦ ');
    assert.equal(normalizedPasswordResult.ok, true);
    auth.logout();
    localStorage.removeItem('qaryaeduStudentDeviceOwner');

    const mohamedResult = await auth.login('mohamed.shaban@qarya.edu', '123456');
    assert.equal(mohamedResult.ok, true);
    auth.logout();

    const leaderResult = await auth.login('abdou@qarya.edu', 'Abdou');
    assert.equal(leaderResult.ok, true);
    auth.logout();

    const stoppedResult = await auth.login('abdelrahman@qarya.edu', 'ADMIN');
    assert.equal(stoppedResult.ok, false);
    assert.match(stoppedResult.message, /موقوف/);

    console.log('PASS auth policy: active accounts, Galaxy A12 notice, direct login, and suspension rules');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
