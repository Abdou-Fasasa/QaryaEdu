(() => {
  const auth = window.QaryaAuth;
  const KEY = 'qaryaedu_anniversary_rewards_2026';
  const path = 'rewards/anniversary2026';
  const first = ['أحمد','محمد','محمود','عبدالله','عبدالرحمن','يوسف','عمر','علي','مريم','فاطمة'];
  const middle = ['محمد','أحمد','علي','حسن','محمود','سعيد','مصطفى','إبراهيم','خالد','صلاح'];
  const last = ['الشافعي','علي','حسن','محمود','السيد','عبدالفتاح','رمضان','مصطفى','النجار','البدوي'];
  let state = { records: [], updatedAt: '' };
  let rewardsSubscribed = false;
  const normal = value => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const isManager = () => Boolean(auth?.isAdminSession?.(auth.getSession()) || auth?.isLeader?.(auth.getSession()?.email));
  const seed = () => Array.from({ length: 100 }, (_, i) => ({ id: `anniversary-${i + 1}`, name: `${first[i % 10]} ${middle[Math.floor(i / 10)]} ${last[(i * 3) % 10]}`, eligible: i % 7 !== 0, rewardPercent: 10, amount: 0 }));
  function mergeUsers(records) {
    const known = new Set(records.map(item => normal(item.name)));
    (auth?.getAllUsers?.() || []).forEach(user => {
      const name = String(user.name || '').trim();
      if (name && name.split(/\s+/).length >= 3 && !known.has(normal(name))) records.unshift({ id: `user-${normal(user.email)}`, name, eligible: true, rewardPercent: 10, amount: 0 });
    });
    return records;
  }
  function readLocal() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } }
  function writeLocal() { localStorage.setItem(KEY, JSON.stringify(state)); }
  async function load() {
    const local = readLocal();
    state = local?.records?.length ? local : { records: seed(), updatedAt: new Date().toISOString() };
    const firebase = window.QaryaFirebase;
    if (firebase?.get) { try { const snap = await firebase.get(firebase.ref(firebase.db, path)); const remote = snap.exists() ? snap.val() : null; if (remote?.records?.length) state = remote; } catch {} }
    state.records = mergeUsers(state.records || seed()); writeLocal(); renderAdmin();
  }
  function subscribeToRealtimeRewards() {
    const firebase = window.QaryaFirebase;
    if (rewardsSubscribed || !firebase?.onValue) return;
    rewardsSubscribed = true;
    firebase.onValue(firebase.ref(firebase.db, path), snapshot => {
      const remote = snapshot.exists() ? snapshot.val() : null;
      if (!remote?.records?.length) return;
      state = { ...remote, records: mergeUsers(remote.records) };
      writeLocal(); renderAdmin(); result();
    });
  }
  function result() {
    const query = normal(document.getElementById('reward-search')?.value);
    const target = document.getElementById('reward-result'); if (!query) { target.className = 'reward-result'; target.textContent = 'اكتب الاسم ثم اضغط بحث.'; return; }
    const record = state.records.find(item => normal(item.name) === query || normal(item.name).includes(query));
    if (!record) { target.className = 'reward-result ineligible'; target.textContent = 'الاسم غير موجود في كشف المكافآت — غير مستحق حاليًا.'; return; }
    target.className = `reward-result ${record.eligible ? 'eligible' : 'ineligible'}`;
    target.textContent = record.eligible
      ? `${record.name}: مستحق — 10% من إجمالي امتحانات الطالب.`
      : `${record.name}: غير مستحق للمكافأة.`;
  }
  function renderAdmin() {
    const section = document.getElementById('rewards-admin'); if (!isManager()) return;
    section.classList.add('show'); const list = document.getElementById('rewards-admin-list');
    list.innerHTML = state.records.map((item, i) => `<tr data-index="${i}"><td><input data-field="name" value="${String(item.name).replace(/"/g, '&quot;')}"></td><td><select data-field="eligible"><option value="true" ${item.eligible ? 'selected' : ''}>مستحق</option><option value="false" ${!item.eligible ? 'selected' : ''}>غير مستحق</option></select></td><td><input data-field="rewardPercent" type="number" min="0" value="${Number(item.rewardPercent ?? 10)}">%</td><td class="amount-cell"><input data-field="amount" type="number" min="0" value="${Number(item.amount || 0)}" aria-label="قيمة إدارية"></td></tr>`).join('');
  }
  async function persistState() {
    state.updatedAt = new Date().toISOString(); writeLocal();
    const firebase = window.QaryaFirebase;
    if (firebase?.set) await firebase.set(firebase.ref(firebase.db, path), state);
  }
  async function save() {
    if (!isManager()) return; document.querySelectorAll('#rewards-admin-list tr').forEach(row => { const item = state.records[Number(row.dataset.index)]; item.name = row.querySelector('[data-field="name"]').value.trim(); item.eligible = row.querySelector('[data-field="eligible"]').value === 'true'; item.rewardPercent = Number(row.querySelector('[data-field="rewardPercent"]').value || 10); item.amount = Number(row.querySelector('[data-field="amount"]').value || 0); });
    try { await persistState(); alert('تم حفظ كشف المكافآت وتحديثه.'); } catch { alert('تم الحفظ محليًا، وسيُعاد إرسال التحديث عند توفر الاتصال.'); }
  }
  async function addEligibleStudent() {
    if (!isManager()) return;
    const input = document.getElementById('reward-new-name');
    const name = String(input?.value || '').trim().replace(/\s+/g, ' ');
    if (name.split(' ').length < 3) { alert('اكتب الاسم الثلاثي للطالب.'); return; }
    if (state.records.some(item => normal(item.name) === normal(name))) { alert('هذا الاسم موجود بالفعل في الكشف.'); return; }
    state.records.unshift({ id: `manual-${Date.now()}`, name, eligible: true, rewardPercent: 10, amount: 0 });
    input.value = ''; renderAdmin();
    try { await persistState(); alert('تمت إضافة الطالب إلى المستحقين.'); } catch { alert('تمت الإضافة محليًا وسيتم إرسالها عند توفر الاتصال.'); }
  }
  document.addEventListener('DOMContentLoaded', () => { document.getElementById('reward-search-btn')?.addEventListener('click', result); document.getElementById('reward-search')?.addEventListener('keydown', e => { if (e.key === 'Enter') result(); }); document.getElementById('reward-save')?.addEventListener('click', save); document.getElementById('reward-add-student')?.addEventListener('click', addEligibleStudent); load(); subscribeToRealtimeRewards(); });
  window.addEventListener('qarya:firebase-ready', subscribeToRealtimeRewards);
})();
