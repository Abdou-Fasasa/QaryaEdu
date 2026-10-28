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

    const activated = await auth.updateUserPersistentData('abdelrahman@qarya.edu', {
        isSuspended: false, balance: 0, withdrawalsEnabled: false, examAllowed: false
    });
    assert.equal(activated.ok, true);
    const saved = auth.getUserByEmail('abdelrahman@qarya.edu');
    assert.equal(saved.isSuspended, false, 'Admin activation must survive policy normalization');
    assert.equal(saved.withdrawalsEnabled, false, 'Withdrawal lock must survive wallet normalization');
    assert.equal(saved.balance, 0);
    assert.equal(saved.examAllowed, false);
    assert.equal((await auth.updateUserPersistentData(saved.email, { balance: -10 })).ok, false);
    assert.equal((await auth.updateUserPersistentData(saved.email, { balance: Infinity })).ok, false);
    assert.equal((await auth.updateUserPersistentData(saved.email, { email: 'invalid' })).ok, false);
    assert.equal(auth.getUserByEmail(saved.email).balance, 0, 'Rejected updates must preserve balance');
    assert.equal(auth.deleteUserAccount(saved.email).ok, true);
    assert.equal(auth.getAllUsers().some(user => user.email === saved.email), false, 'Deleted seed must not reappear');
    assert.equal((await auth.login(saved.email, 'ADMIN')).ok, false);
    const restored = await auth.upsertUser({ ...saved, deleted: false }, { currentEmail: saved.email });
    assert.equal(restored.ok, true);
    assert.equal(auth.getAllUsers().some(user => user.email === saved.email), true);

    // Model server transactions, including Firebase's callback retry behavior.
    const financeEmail = 'mohamed.shaban@qarya.edu';
    const financeKey = financeEmail.replace(/\./g, '_');
    let remote = { users: { [financeKey]: { ...auth.getUserByEmail(financeEmail), balance: 0, withdrawalsEnabled: true } }, transactions: {} };
    const at = key => key ? key.split('/').reduce((value, part) => value?.[part], remote) : remote;
    const snapshot = key => ({ val: () => JSON.parse(JSON.stringify(at(key) ?? null)), exists: () => Boolean(at(key)) });
    context.QaryaFirebase = {
        db: {}, ref: (_, key = '') => key,
        get: async key => snapshot(key),
        update: async () => {}, set: async () => {},
        runTransaction: async (key, callback) => {
            callback(JSON.parse(JSON.stringify(at(key) ?? null)));
            const next = callback(JSON.parse(JSON.stringify(at(key) ?? null)));
            if (next !== undefined) {
                if (!key) remote = next;
                else { const parts = key.split('/'); const leaf = parts.pop(); parts.reduce((value, part) => value[part], remote)[leaf] = next; }
            }
            return { committed: next !== undefined, snapshot: snapshot(key) };
        }
    };
    const otherContext = { ...context, QaryaFirebase: undefined, localStorage: new MemoryStorage(), sessionStorage: new MemoryStorage() };
    otherContext.window = otherContext;
    vm.runInNewContext(source, otherContext, { filename: 'auth-other-device.js' });
    otherContext.QaryaFirebase = context.QaryaFirebase;
    const otherDevice = otherContext.QaryaAuth;
    const attempt = { requestId: 'REQ-TEST', examDateKey: '2026-10-28', passed: true, percentage: 90 };
    const repeated = await Promise.all([auth.claimExamReward(financeEmail, attempt), otherDevice.claimExamReward(financeEmail, attempt), auth.claimExamReward(financeEmail, attempt)]);
    assert.equal(repeated.filter(result => result.ok && !result.alreadyGranted).length, 1);
    assert.equal(remote.users[financeKey].balance, 100, 'Triple click grants exactly 100');
    const replay = await auth.claimExamReward(financeEmail, attempt);
    assert.equal(replay.alreadyGranted, true);
    assert.equal(remote.users[financeKey].balance, 100, 'Replay cannot grant another reward');
    assert.equal((await auth.claimExamReward(financeEmail, { ...attempt, examDateKey: '2026-10-29' })).ok, true);
    assert.equal(remote.users[financeKey].balance, 200, 'Different exam grants its own 100');
    const withdrawal = amount => ({ email: financeEmail, txId: `TX-${amount}`, amount, status: 'pending' });
    assert.equal((await auth.createWithdrawalRequest(withdrawal(201))).ok, false);
    assert.equal((await auth.createWithdrawalRequest(withdrawal(NaN))).ok, false);
    assert.equal((await auth.createWithdrawalRequest(withdrawal(100.001))).ok, false);
    const concurrentWithdrawals = await Promise.all([auth.createWithdrawalRequest(withdrawal(150)), otherDevice.createWithdrawalRequest({ ...withdrawal(150), txId: 'TX-other-device' })]);
    assert.equal(concurrentWithdrawals.filter(result => result.ok).length, 1);
    assert.equal((await auth.createWithdrawalRequest(withdrawal(100))).ok, false, 'Pending requests reserve available funds');
    remote.transactions = {};
    assert.equal((await auth.createWithdrawalRequest(withdrawal(200))).ok, true, 'Exact available balance is allowed');
    assert.equal(Object.values(remote.transactions).reduce((sum, item) => sum + item.amount, 0), 200);
    console.log('PASS finance: triple submission, reward replay, next exam, excessive/invalid withdrawals, reservations, exact balance');

    console.log('PASS auth policy: active accounts, Galaxy A12 notice, direct login, and suspension rules');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
