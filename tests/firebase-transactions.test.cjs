const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../app/js/firebase-init.js'), 'utf8');
const helper = source.slice(source.indexOf('async function runTransactionWithServerState'), source.indexOf('window.QaryaFirebase ='));
(async () => {
 let active = 0, unsubscribed = 0, fail = false, denied = false;
 const server = { users: { student: { balance: 200 } } };
 const context = {
  onValue: (ref, ready, reject) => { active++; queueMicrotask(() => denied ? reject(Error('permission_denied')) : ready({val:()=>server})); return () => { active--; unsubscribed++; }; },
  runTransaction: async (ref, updater, options) => {
   if(fail) throw Error('network');
   const next = updater(active ? structuredClone(server) : null);
   return {committed:next !== undefined, options};
  }
 };
 vm.createContext(context); vm.runInContext(helper, context);
 const run = context.runTransactionWithServerState;
 const result = await run('root', current => {
  assert.equal(current.users.student.balance, 200, 'First callback receives complete data with a live subscription');
  return current;
 }, {applyLocally:false});
 assert.equal(result.committed, true); assert.equal(active, 0); assert.equal(unsubscribed, 1);
 assert.equal((await run('root', () => undefined)).committed, false, 'Business validation still aborts');
 fail = true; await assert.rejects(run('root', c => c), /network/); assert.equal(active, 0);
 fail = false; denied = true; await assert.rejects(run('root', c => c), /permission_denied/); assert.equal(active, 0);
 console.log('PASS Firebase transactions: first callback data, validation abort, network/permission errors and listener cleanup');
})().catch(error => { console.error(error); process.exitCode = 1; });
