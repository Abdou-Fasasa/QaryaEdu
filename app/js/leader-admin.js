(() => {
    const authApi = window.QaryaAuth;
    const store = window.QaryaPlatformStore;
    const examWindowApi = window.QaryaExamWindow || null;
    const session = authApi?.getSession?.();

    if (!authApi || !store || !session || (!authApi.isLeader(session.email) && !authApi.isAdminSession(session))) {
        window.location.href = '../login.html?next=pages/leader-admin.html';
        return;
    }

    const isAdmin = authApi.isAdminSession(session);
    const currentLeader = authApi.getUserByEmail(session.email);
    const welcomeEl = document.getElementById('leader-welcome');
    const studentsListEl = document.getElementById('students-list');
    const allWithdrawalsListEl = document.getElementById('all-withdrawals-list');
    const allUsersListEl = document.getElementById('all-users-list');
    const adminTabsContainer = document.getElementById('admin-tabs-container');
    const withdrawalsTabEl = document.getElementById('withdrawals-tab');
    const usersTabEl = document.getElementById('users-tab');
    const examsTabEl = document.getElementById('exams-tab');
    const supportTabEl = document.getElementById('support-tab');
    const notificationsTabEl = document.getElementById('notifications-tab');
    const notificationsFeedEl = document.getElementById('notifications-feed');
    const supportInboxListEl = document.getElementById('support-inbox-list');
    const globalExamControlEl = document.getElementById('global-exam-control');
    const adminModal = document.getElementById('admin-modal');
    const adminModalTitle = document.getElementById('admin-modal-title');
    const adminModalBody = document.getElementById('admin-modal-body');
    const adminModalConfirm = document.getElementById('admin-modal-confirm');
    const overviewStripEl = document.getElementById('admin-overview-strip');
    const globalSearchEl = document.getElementById('admin-global-search');
    const searchStatusEl = document.getElementById('admin-search-status');
    const activeTabLabelEl = document.getElementById('admin-active-tab-label');
    const roleLabelEl = document.getElementById('admin-role-label');
    const tabSelectEl = document.getElementById('admin-tab-select');
    const studentsSearchEl = document.getElementById('students-search');
    const studentsStatusFilterEl = document.getElementById('students-status-filter');
    const studentsExamFilterEl = document.getElementById('students-exam-filter');
    const withdrawalsSearchEl = document.getElementById('withdrawals-search');
    const withdrawalsStatusFilterEl = document.getElementById('withdrawals-status-filter');
    const withdrawalsMethodFilterEl = document.getElementById('withdrawals-method-filter');
    const usersSearchEl = document.getElementById('users-search');
    const usersStatusFilterEl = document.getElementById('users-status-filter');
    const usersExamFilterEl = document.getElementById('users-exam-filter');
    const notificationsSearchEl = document.getElementById('notifications-search');
    const notificationsTypeFilterEl = document.getElementById('notifications-type-filter');
    const supportSearchEl = document.getElementById('support-search');
    const supportStatusFilterEl = document.getElementById('support-status-filter');

    let currentModalAction = null;
    const dashboardState = {
        activeTab: 'students-tab',
        globalSearch: '',
        seenTabCounts: {},
        tabCountsInitialized: false,
        students: { search: '', status: 'all', exam: 'all' },
        withdrawals: { search: '', status: 'all', method: 'all' },
        users: { search: '', status: 'all', exam: 'all' },
        support: { search: '', status: 'all', selectedEmail: '' },
        notifications: { search: '', type: 'all' }
    };
    const dashboardTabMeta = {
        'students-tab': { label: 'طلابي', accent: 'الطلبات والطلاب', emptyIcon: 'fa-users-slash' },
        'withdrawals-tab': { label: 'الماليات', accent: 'طلبات السحب', emptyIcon: 'fa-wallet' },
        'users-tab': { label: 'المستخدمين', accent: 'قاعدة الحسابات', emptyIcon: 'fa-user-slash' },
        'exams-tab': { label: 'الامتحانات', accent: 'التشغيل والتحكم', emptyIcon: 'fa-file-circle-xmark' },
        'support-tab': { label: 'الدعم', accent: 'محادثات الدعم', emptyIcon: 'fa-headset' },
        'notifications-tab': { label: 'التنبيهات', accent: 'الإشعارات والمنشورات', emptyIcon: 'fa-bell-slash' }
    };

    let renderFrameId = 0;
    let refreshInFlight = null;
    const inputDebounceTimers = new WeakMap();

    function scheduleRenderAll() {
        if (renderFrameId) return;
        renderFrameId = window.requestAnimationFrame(() => {
            renderFrameId = 0;
            renderAll();
        });
    }

    function scheduleInputRender(element, delay = 140) {
        const existing = inputDebounceTimers.get(element);
        if (existing) window.clearTimeout(existing);
        const timeoutId = window.setTimeout(() => {
            inputDebounceTimers.delete(element);
            scheduleRenderAll();
        }, delay);
        inputDebounceTimers.set(element, timeoutId);
    }

    function getSelectedSupportThread(threads = []) {
        if (!Array.isArray(threads) || !threads.length) {
            dashboardState.support.selectedEmail = '';
            return null;
        }

        const selected = threads.find((thread) => thread.email === dashboardState.support.selectedEmail);
        if (selected) return selected;

        dashboardState.support.selectedEmail = threads[0].email || '';
        return threads[0];
    }

    function encodeValue(value) {
        return encodeURIComponent(String(value || ''));
    }

    function decodeValue(value) {
        return decodeURIComponent(String(value || ''));
    }

    function isSuperAdminSession() {
        return authApi.getManagementRole?.(authApi.getSession?.() || session) === 'super_admin';
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatDate(value) {
        if (!value) return 'غير محدد';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? 'غير محدد' : date.toLocaleString('ar-EG');
    }

    function formatMoney(value) {
        return `${Number(value || 0).toLocaleString('en-US')} EGP`;
    }

    function getFirebaseApi() {
        return window.QaryaFirebase || null;
    }

    function getSafeNotificationEmail(email) {
        return authApi.normalizeEmail(email).replace(/\./g, '_');
    }

    function getNotificationDisplayLabel(mode) {
        if (mode === 'banner') return 'شريط ثابت';
        if (mode === 'floating') return 'عائم';
        return 'داخل القائمة';
    }

    function getDateTimeLocalValue(value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        const pad = (part) => String(part).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function normalizeDateTimeInput(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        const date = new Date(raw);
        return Number.isNaN(date.getTime()) ? '' : date.toISOString();
    }

    function getNotificationScheduleLabel(note) {
        const start = formatDate(note.startAt);
        const end = formatDate(note.endAt);
        if (note.startAt && note.endAt) return `${start} حتى ${end}`;
        if (note.startAt) return `يبدأ ${start}`;
        if (note.endAt) return `ينتهي ${end}`;
        return 'بدون توقيت';
    }

    function getNotificationRuntimeLabel(note) {
        const now = Date.now();
        const start = new Date(note.startAt || '').getTime();
        const end = new Date(note.endAt || '').getTime();

        if (Number.isFinite(start) && start > now) return 'مجدول';
        if (Number.isFinite(end) && end > 0 && end <= now) return 'منتهي';
        return 'نشط';
    }

    function getNotificationAudienceLabel(note) {
        return note.audience === 'private' ? 'خاص' : 'عام';
    }

    function getNotificationSourceKey(note) {
        if (note.audience === 'private') {
            return `private::${authApi.normalizeEmail(note.recipientEmail)}::${note.id}`;
        }
        return `global::${note.id}`;
    }

    function parseNotificationSourceKey(sourceKey) {
        const raw = String(sourceKey || '');
        if (raw.startsWith('private::')) {
            const parts = raw.split('::');
            return {
                audience: 'private',
                recipientEmail: authApi.normalizeEmail(parts[1] || ''),
                id: parts.slice(2).join('::')
            };
        }
        return {
            audience: 'global',
            recipientEmail: '',
            id: raw.replace(/^global::/, '')
        };
    }

    function getAllPrivateNotificationRecords() {
        return authApi.getAllUsers().flatMap((user) => {
            const email = authApi.normalizeEmail(user.email);
            return authApi.getPrivateNotifications(email).map((note) => ({
                ...note,
                audience: 'private',
                recipientEmail: email,
                recipientName: user.name
            }));
        });
    }

    function getNotificationRecord(sourceKey) {
        const parsed = parseNotificationSourceKey(sourceKey);
        if (parsed.audience === 'private') {
            const note = authApi.getPrivateNotifications(parsed.recipientEmail)
                .find((item) => item.id === parsed.id);
            return note ? {
                ...note,
                audience: 'private',
                recipientEmail: parsed.recipientEmail,
                recipientName: authApi.getUserByEmail(parsed.recipientEmail)?.name || ''
            } : null;
        }

        const note = store.getNotifications().find((item) => item.id === parsed.id);
        return note ? { ...note, audience: 'global' } : null;
    }

    async function syncPrivateNotificationFirebase(email, notification) {
        const firebase = getFirebaseApi();
        if (!firebase) return;

        const { db, ref, set } = firebase;
        await set(ref(db, `notifications/${getSafeNotificationEmail(email)}/${notification.id}`), {
            title: notification.title,
            text: notification.body,
            actionUrl: notification.actionUrl,
            actionLabel: notification.actionLabel,
            timestamp: notification.updatedAt || notification.createdAt,
            read: false
        });
    }

    async function deletePrivateNotificationFirebase(email, notificationId) {
        const firebase = getFirebaseApi();
        if (!firebase) return;

        const { db, ref, set } = firebase;
        await set(ref(db, `notifications/${getSafeNotificationEmail(email)}/${notificationId}`), null);
    }

    async function publishPrivateNotification(email, payload) {
        const notification = {
            id: payload.id || `PN-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            title: String(payload.title || 'إشعار خاص').trim(),
            body: String(payload.body || '').trim(),
            type: String(payload.type || 'update').trim(),
            actionUrl: String(payload.actionUrl || '').trim(),
            actionLabel: String(payload.actionLabel || '').trim(),
            createdAt: payload.createdAt || new Date().toISOString(),
            updatedAt: payload.updatedAt || payload.createdAt || new Date().toISOString(),
            sticky: Boolean(payload.sticky),
            dismissible: payload.dismissible !== false,
            displayMode: payload.displayMode || 'feed',
            startAt: payload.startAt || '',
            endAt: payload.endAt || '',
            recipientEmail: authApi.normalizeEmail(email),
            recipientName: authApi.getUserByEmail(email)?.name || ''
        };

        authApi.pushPrivateNotification(email, notification);
        await syncPrivateNotificationFirebase(email, notification);
        return notification;
    }

    function getApplicationRecipientEmail(application) {
        if (!application) return '';
        const directEmail = authApi.normalizeEmail(application.studentEmail || application.email || '');
        if (directEmail) return directEmail;

        const byNationalId = application.nationalId ? authApi.getUserByNationalId?.(application.nationalId) : null;
        if (byNationalId?.email) return authApi.normalizeEmail(byNationalId.email);

        const byRequestId = authApi.getAllUsers?.().find((user) => (
            String(user.requestId || user.applicationRequestId || '').trim().toUpperCase() === String(application.requestId || '').trim().toUpperCase()
        ));
        return authApi.normalizeEmail(byRequestId?.email || '');
    }

    async function notifyApplicationOwner(application, payload = {}) {
        const recipientEmail = getApplicationRecipientEmail(application);
        if (!recipientEmail) return null;

        return await publishPrivateNotification(recipientEmail, {
            type: 'application',
            displayMode: 'floating',
            sticky: false,
            actionUrl: `./status.html?requestId=${encodeURIComponent(application.requestId || '')}&nationalId=${encodeURIComponent(application.nationalId || '')}`,
            actionLabel: 'فتح حالة الطلب',
            ...payload
        });
    }

    async function notifyUserAccountChange(email, payload = {}) {
        const normalizedEmail = authApi.normalizeEmail(email);
        if (!normalizedEmail) return null;
        return await publishPrivateNotification(normalizedEmail, {
            type: 'update',
            displayMode: 'floating',
            sticky: false,
            actionUrl: './notifications.html',
            actionLabel: 'فتح الإشعارات',
            ...payload
        });
    }

    async function publishGlobalNotification(payload) {
        const notification = {
            id: payload.id,
            title: String(payload.title || 'إشعار جديد').trim(),
            body: String(payload.body || '').trim(),
            type: String(payload.type || 'update').trim(),
            actionUrl: String(payload.actionUrl || '').trim(),
            actionLabel: String(payload.actionLabel || '').trim(),
            displayMode: payload.displayMode || 'feed',
            sticky: Boolean(payload.sticky),
            dismissible: payload.dismissible !== false,
            startAt: payload.startAt || '',
            endAt: payload.endAt || '',
            createdAt: payload.createdAt || new Date().toISOString(),
            updatedAt: payload.updatedAt || payload.createdAt || new Date().toISOString()
        };

        store.addNotification(notification);

        const firebase = getFirebaseApi();
        if (!firebase) return notification;

        const { db, ref, set } = firebase;
        await set(ref(db, 'global_notification'), {
            title: notification.title,
            text: notification.body,
            actionUrl: notification.actionUrl,
            actionLabel: notification.actionLabel,
            timestamp: new Date().toISOString()
        });

        return notification;
    }

    function getAdminRecipients() {
        return authApi.getAllUsers()
            .filter((user) => authApi.isAdminSession(user.email))
            .map((user) => user.email);
    }

    function showToast(message) {
        window.alert(message);
    }

    function guardAdmin() {
        if (isAdmin) return true;
        showToast('هذه الصلاحية متاحة للإدارة العامة فقط.');
        return false;
    }

    async function refreshAll(force = false) {
        if (refreshInFlight && !force) {
            return refreshInFlight;
        }

        if (refreshInFlight && force) {
            await refreshInFlight.catch(() => {});
        }

        refreshInFlight = (async () => {
            if (store?.refreshFromRemote) await store.refreshFromRemote({ force });
            if (authApi?.refreshFromRemote) await authApi.refreshFromRemote({ force });
            renderAll();
        })();

        try {
            await refreshInFlight;
        } finally {
            refreshInFlight = null;
        }
    }

    async function syncAll(options = {}) {
        const tasks = [];
        if (store?.syncNow) tasks.push(store.syncNow(options));
        if (authApi?.syncNow) tasks.push(authApi.syncNow(options));
        await Promise.all(tasks);
    }

    function openModal(title, bodyHtml, onConfirm, confirmLabel = 'حفظ التغييرات') {
        if (!adminModal || !adminModalTitle || !adminModalBody || !adminModalConfirm) return;
        adminModalTitle.textContent = title;
        adminModalBody.innerHTML = `<div class="admin-modal-form-grid">${bodyHtml}</div>`;
        const modalGrid = adminModalBody.querySelector('.admin-modal-form-grid');
        Array.from(modalGrid?.children || []).forEach((child) => {
            if (child.classList.contains('admin-edit-grid')) {
                child.classList.add('modal-grid-full');
            }
            if (child.classList.contains('form-group') && child.querySelector('textarea')) {
                child.classList.add('form-group-full');
            }
        });
        adminModalBody.scrollTop = 0;
        adminModal.querySelector('.modal-content')?.scrollTo(0, 0);
        adminModalConfirm.textContent = confirmLabel;
        currentModalAction = onConfirm;
        adminModal.classList.add('open');
    }

    function closeModal() {
        currentModalAction = null;
        adminModal?.classList.remove('open');
    }

    window.closeAdminModal = closeModal;

    adminModalConfirm?.addEventListener('click', async () => {
        if (!currentModalAction) {
            closeModal();
            return;
        }
        adminModalConfirm.disabled = true;
        try {
            const result = await currentModalAction();
            if (result === false) return;
            closeModal();
            await refreshAll(true);
            showToast('تم حفظ البيانات بنجاح.');
        } finally {
            adminModalConfirm.disabled = false;
            adminModalConfirm.textContent = 'حفظ التغييرات';
        }
    });

    adminModal?.addEventListener('click', (event) => {
        if (event.target === adminModal) closeModal();
    });

    function renderSummaryRow(items) {
        return `
            <div class="admin-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin-bottom: 1rem;">
                ${items.map((item) => `
                    <div class="admin-card">
                        <div class="user-info">
                            <span>${escapeHtml(item.label)}</span>
                            <h4>${escapeHtml(item.value)}</h4>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function normalizeSearch(value) {
        return String(value || '').trim().toLowerCase();
    }

    function matchesSearch(parts, query) {
        const normalized = normalizeSearch(query);
        if (!normalized) return true;
        const haystack = parts
            .flat()
            .map((value) => normalizeSearch(value))
            .filter(Boolean)
            .join(' ');
        return haystack.includes(normalized);
    }

    function renderEmptyState(icon, title, description) {
        return `
            <div class="admin-card admin-empty-state">
                <i class="fas ${escapeHtml(icon)}"></i>
                <h4>${escapeHtml(title)}</h4>
                <p>${escapeHtml(description)}</p>
            </div>
        `;
    }

    function getApplicationExamFilterValue(application) {
        if (application?.examAccess === 'blocked') return 'blocked';
        if (application?.examAccess === 'allowed') return 'allowed';
        return 'schedule';
    }

    function getWithdrawalMethodFilterValue(transaction) {
        const text = normalizeSearch([
            transaction?.method,
            transaction?.channelName,
            transaction?.details
        ].join(' '));
        if (text.includes('bank') || text.includes('بنك') || text.includes('iban')) return 'bank';
        if (text.includes('wallet') || text.includes('محفظ') || text.includes('vodafone') || text.includes('orange') || text.includes('etisalat')) return 'wallet';
        if (text.includes('cash') || text.includes('كاش')) return 'cash';
        return 'other';
    }

    function getStatusBadgeClass(status) {
        if (status === 'accepted' || status === 'completed') return 'pill-active';
        if (status === 'rejected' || status === 'error') return 'pill-suspended';
        return '';
    }

    function getActiveTabMeta() {
        return dashboardTabMeta[dashboardState.activeTab] || dashboardTabMeta['students-tab'];
    }

    function getStudentsDataset() {
        const all = getManagedApplications();
        const localSearch = dashboardState.students.search;
        const globalSearch = dashboardState.globalSearch;
        const filtered = all.filter((application) => {
            if (dashboardState.students.status !== 'all' && String(application.status || 'pending') !== dashboardState.students.status) {
                return false;
            }
            if (dashboardState.students.exam !== 'all' && getApplicationExamFilterValue(application) !== dashboardState.students.exam) {
                return false;
            }
            if (!matchesSearch([application.name, application.requestId, application.nationalId, application.studentEmail], globalSearch)) {
                return false;
            }
            return matchesSearch([application.name, application.requestId, application.nationalId, application.studentEmail], localSearch);
        });
        return { all, filtered };
    }

    function getWithdrawalsDataset() {
        const all = authApi.getAllTransactions();
        const localSearch = dashboardState.withdrawals.search;
        const globalSearch = dashboardState.globalSearch;
        const filtered = all.filter((transaction) => {
            if (dashboardState.withdrawals.status !== 'all' && String(transaction.status || 'pending') !== dashboardState.withdrawals.status) {
                return false;
            }
            if (dashboardState.withdrawals.method !== 'all' && getWithdrawalMethodFilterValue(transaction) !== dashboardState.withdrawals.method) {
                return false;
            }
            if (!matchesSearch([transaction.userName, transaction.email, transaction.txId, transaction.method, transaction.channelName], globalSearch)) {
                return false;
            }
            return matchesSearch([transaction.userName, transaction.email, transaction.txId, transaction.method, transaction.channelName], localSearch);
        });
        return { all, filtered };
    }

    function getUsersDataset() {
        const all = authApi.getAllUsers();
        const localSearch = dashboardState.users.search;
        const globalSearch = dashboardState.globalSearch;
        const filtered = all.filter((user) => {
            if (dashboardState.users.status === 'active' && user.isSuspended) return false;
            if (dashboardState.users.status === 'suspended' && !user.isSuspended) return false;
            if (dashboardState.users.exam === 'allowed' && user.examAllowed === false) return false;
            if (dashboardState.users.exam === 'blocked' && user.examAllowed !== false) return false;
            if (!matchesSearch([user.name, user.email, user.leaderCode, user.role], globalSearch)) {
                return false;
            }
            return matchesSearch([user.name, user.email, user.leaderCode, user.role], localSearch);
        });
        return { all, filtered };
    }

    function getSupportDataset() {
        const all = store.getSupportThreads ? store.getSupportThreads() : [];
        const localSearch = dashboardState.support.search;
        const globalSearch = dashboardState.globalSearch;
        const filtered = all.filter((thread) => {
            if (dashboardState.support.status === 'open' && thread.status !== 'open') return false;
            if (dashboardState.support.status === 'closed' && thread.status !== 'closed') return false;
            if (dashboardState.support.status === 'unread' && Number(thread.unreadByAdmin || 0) <= 0) return false;
            if (!matchesSearch([thread.userName, thread.email, thread.lastMessagePreview, ...(thread.messages || []).map((message) => message.text)], globalSearch)) {
                return false;
            }
            return matchesSearch([thread.userName, thread.email, thread.lastMessagePreview, ...(thread.messages || []).map((message) => message.text)], localSearch);
        });
        return { all, filtered };
    }

    function getNotificationsDataset() {
        const all = [
            ...(store.getNotifications() || []).map((note) => ({
                ...note,
                audience: 'global',
                sourceKey: getNotificationSourceKey({ ...note, audience: 'global' })
            })),
            ...getAllPrivateNotificationRecords().map((note) => ({
                ...note,
                sourceKey: getNotificationSourceKey(note)
            }))
        ].sort((first, second) => new Date(second.updatedAt || second.createdAt || 0).getTime() - new Date(first.updatedAt || first.createdAt || 0).getTime());
        const nState = dashboardState.notifications || { search: '', type: 'all' };
        const localSearch = nState.search || '';
        const globalSearch = dashboardState.globalSearch || '';
        
        const filtered = all.filter((notification) => {
            if (!notification) return false;
            if (nState.type !== 'all') {
                if (nState.type === 'private' && notification.audience !== 'private') return false;
                if (nState.type === 'sticky' && !notification.sticky) return false;
                if (nState.type !== 'private' && nState.type !== 'sticky' && String(notification.type || 'update') !== nState.type) {
                    return false;
                }
            }
            const searchFields = [
                notification.title,
                notification.body,
                notification.type,
                notification.actionLabel,
                notification.recipientName,
                notification.recipientEmail,
                notification.displayMode,
                notification.sticky ? 'ثابت' : 'عادي',
                getNotificationRuntimeLabel(notification),
                getNotificationScheduleLabel(notification)
            ];
            if (!matchesSearch(searchFields, globalSearch)) {
                return false;
            }
            return matchesSearch(searchFields, localSearch);
        });
        return { all, filtered };
    }

    function getDashboardTabCounts() {
        const supportUnreadCount = getSupportDataset().all.reduce((sum, thread) => (
            sum + Math.max(0, Number(thread.unreadByAdmin || 0))
        ), 0);

        return {
            'students-tab': getStudentsDataset().all.filter((item) => item.status === 'pending').length,
            'withdrawals-tab': getWithdrawalsDataset().all.filter((item) => item.status === 'pending').length,
            'users-tab': getUsersDataset().all.length,
            'exams-tab': store.getExamHistory().length,
            'support-tab': supportUnreadCount,
            'notifications-tab': getNotificationsDataset().all.length
        };
    }

    function markTabCounterSeen(tabId) {
        const counts = getDashboardTabCounts();
        dashboardState.seenTabCounts[tabId] = Number(counts[tabId] || 0);
    }

    function updateTabCounters() {
        const counts = getDashboardTabCounts();

        document.querySelectorAll('.admin-tab-btn[data-tab-target]').forEach((button) => {
            const tabId = button.dataset.tabTarget;
            const currentCount = Number(counts[tabId] || 0);
            if (tabId === dashboardState.activeTab) {
                dashboardState.seenTabCounts[tabId] = currentCount;
            }
            const seenCount = Number(dashboardState.seenTabCounts?.[tabId] || 0);
            const visibleCount = Math.max(0, currentCount - seenCount);

            let badge = button.querySelector('.admin-tab-count');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'admin-tab-count';
                button.appendChild(badge);
            }

            badge.textContent = visibleCount > 99 ? '99+' : String(visibleCount);
            badge.hidden = visibleCount <= 0 || tabId === dashboardState.activeTab;
        });
    }

    function setOverviewCards(cards) {
        if (!overviewStripEl) return;
        overviewStripEl.innerHTML = cards.map((card) => `
            <div class="admin-overview-card">
                <span>${escapeHtml(card.label)}</span>
                <strong>${escapeHtml(card.value)}</strong>
                <small>${escapeHtml(card.caption)}</small>
            </div>
        `).join('');
    }

    function buildFilterSummary() {
        const chunks = [];
        if (dashboardState.globalSearch) chunks.push(`بحث عام: ${dashboardState.globalSearch}`);
        if (dashboardState.activeTab === 'students-tab') {
            if (dashboardState.students.search) chunks.push(`بحث الطلاب: ${dashboardState.students.search}`);
            if (dashboardState.students.status !== 'all') chunks.push(`حالة الطلب: ${dashboardState.students.status}`);
            if (dashboardState.students.exam !== 'all') chunks.push(`وضع الامتحان: ${dashboardState.students.exam}`);
        } else if (dashboardState.activeTab === 'withdrawals-tab') {
            if (dashboardState.withdrawals.search) chunks.push(`بحث الماليات: ${dashboardState.withdrawals.search}`);
            if (dashboardState.withdrawals.status !== 'all') chunks.push(`الحالة: ${dashboardState.withdrawals.status}`);
            if (dashboardState.withdrawals.method !== 'all') chunks.push(`الوسيلة: ${dashboardState.withdrawals.method}`);
        } else if (dashboardState.activeTab === 'users-tab') {
            if (dashboardState.users.search) chunks.push(`بحث المستخدمين: ${dashboardState.users.search}`);
            if (dashboardState.users.status !== 'all') chunks.push(`النشاط: ${dashboardState.users.status}`);
            if (dashboardState.users.exam !== 'all') chunks.push(`الامتحان: ${dashboardState.users.exam}`);
        } else if (dashboardState.activeTab === 'support-tab') {
            if (dashboardState.support.search) chunks.push(`بحث الدعم: ${dashboardState.support.search}`);
            if (dashboardState.support.status !== 'all') chunks.push(`حالة المحادثة: ${dashboardState.support.status}`);
        } else if (dashboardState.activeTab === 'notifications-tab') {
            if (dashboardState.notifications.search) chunks.push(`بحث الإشعارات: ${dashboardState.notifications.search}`);
            if (dashboardState.notifications.type !== 'all') chunks.push(`النوع: ${dashboardState.notifications.type}`);
        }
        return chunks.length ? chunks.join(' | ') : 'بدون فلاتر';
    }

    function updateDashboardChrome() {
        const tabMeta = getActiveTabMeta();
        if (activeTabLabelEl) activeTabLabelEl.textContent = tabMeta.label;
        if (roleLabelEl) roleLabelEl.textContent = isAdmin ? 'الإدارة العامة' : 'قائد الطلاب';
        if (tabSelectEl) {
            tabSelectEl.value = dashboardState.activeTab;
            Array.from(tabSelectEl.options).forEach((option) => {
                option.hidden = !isAdmin && option.value !== 'students-tab';
                option.disabled = !isAdmin && option.value !== 'students-tab';
            });
        }

        let total = 0;
        let visible = 0;
        let primary = '--';
        let secondary = buildFilterSummary();

        if (dashboardState.activeTab === 'students-tab') {
            const dataset = getStudentsDataset();
            total = dataset.all.length;
            visible = dataset.filtered.length;
            primary = `${dataset.filtered.filter((item) => item.status === 'pending').length} قيد المراجعة`;
        } else if (dashboardState.activeTab === 'withdrawals-tab') {
            const dataset = getWithdrawalsDataset();
            total = dataset.all.length;
            visible = dataset.filtered.length;
            primary = `${dataset.filtered.filter((item) => item.status === 'pending').length} طلبات تنتظر القرار`;
        } else if (dashboardState.activeTab === 'users-tab') {
            const dataset = getUsersDataset();
            total = dataset.all.length;
            visible = dataset.filtered.length;
            primary = `${dataset.filtered.filter((item) => !item.isSuspended).length} حسابات نشطة`;
        } else if (dashboardState.activeTab === 'support-tab') {
            const dataset = getSupportDataset();
            total = dataset.all.length;
            visible = dataset.filtered.length;
            primary = `${dataset.filtered.filter((item) => Number(item.unreadByAdmin || 0) > 0).length} رسائل غير مقروءة`;
        } else if (dashboardState.activeTab === 'exams-tab') {
            total = store.getExamHistory().length;
            visible = total;
            primary = 'تشغيل ومراقبة الحالة العامة';
        } else if (dashboardState.activeTab === 'notifications-tab') {
            const dataset = getNotificationsDataset();
            total = dataset.all.length;
            visible = dataset.filtered.length;
            primary = `${dataset.filtered.filter((item) => item.type === 'finance').length} إشعارات مالية`;
        }

        if (searchStatusEl) {
            searchStatusEl.textContent = `القسم الحالي: ${tabMeta.label} | المعروض الآن: ${visible} من ${total} | ${secondary}`;
        }

        updateTabCounters();

        setOverviewCards([
            { label: 'القسم', value: tabMeta.label, caption: tabMeta.accent },
            { label: 'العناصر الظاهرة', value: `${visible}`, caption: `من أصل ${total}` },
            { label: 'أولوية المتابعة', value: primary, caption: 'أبرز ما يحتاج انتباهًا سريعًا' },
            { label: 'حالة التصفية', value: dashboardState.globalSearch ? 'بحث نشط' : 'عرض كامل', caption: secondary }
        ]);
    }

    function bindDashboardControls() {
        const bindings = [
            [globalSearchEl, 'globalSearch', null],
            [studentsSearchEl, 'students.search', null],
            [studentsStatusFilterEl, 'students.status', null],
            [studentsExamFilterEl, 'students.exam', null],
            [withdrawalsSearchEl, 'withdrawals.search', null],
            [withdrawalsStatusFilterEl, 'withdrawals.status', null],
            [withdrawalsMethodFilterEl, 'withdrawals.method', null],
            [usersSearchEl, 'users.search', null],
            [usersStatusFilterEl, 'users.status', null],
            [usersExamFilterEl, 'users.exam', null],
            [supportSearchEl, 'support.search', null],
            [supportStatusFilterEl, 'support.status', null],
            [notificationsSearchEl, 'notifications.search', null],
            [notificationsTypeFilterEl, 'notifications.type', null]
        ];

        bindings.forEach(([element, path]) => {
            if (!element || element.dataset.bound === 'true') return;
            const updateState = () => {
                const parts = path.split('.');
                if (parts.length === 1) {
                    dashboardState[parts[0]] = element.value;
                } else {
                    dashboardState[parts[0]][parts[1]] = element.value;
                }
                if (element.tagName === 'SELECT') {
                    scheduleRenderAll();
                } else {
                    scheduleInputRender(element);
                }
            };
            element.addEventListener(element.tagName === 'SELECT' ? 'change' : 'input', updateState);
            element.dataset.bound = 'true';
        });

        if (tabSelectEl && tabSelectEl.dataset.bound !== 'true') {
            tabSelectEl.addEventListener('change', () => {
                window.switchTab(tabSelectEl.value);
            });
            tabSelectEl.dataset.bound = 'true';
        }
    }

    function getManagedApplications() {
        const applications = store.getAllApplications();
        if (isAdmin) return applications;
        
        // تأمين إضافي: القائد يرى طلابه فقط بناءً على كود القائد (Leader Code)
        const leaderCode = String(currentLeader?.leaderCode || '').trim();
        if (!leaderCode) return []; // إذا لم يكن للقائد كود، لا يرى شيئاً لضمان الخصوصية
        
        return applications.filter((application) => (
            String(application.leaderCode || '').trim() === leaderCode
        ));
    }

    function renderStudents() {
        const applications = getManagedApplications();
        const summaryHtml = renderSummaryRow([
            { label: isAdmin ? 'إجمالي الطلبات' : 'طلباتك المرتبطة', value: applications.length },
            { label: 'قيد المراجعة', value: applications.filter((item) => item.status === 'pending').length },
            { label: 'مقبول', value: applications.filter((item) => item.status === 'accepted').length },
            { label: 'مرفوض', value: applications.filter((item) => item.status === 'rejected').length },
            { label: 'ممنوع امتحان', value: applications.filter((item) => item.examAccess === 'blocked').length }
        ]);

        if (welcomeEl) {
            welcomeEl.textContent = `مرحبًا بك يا ${session.name}`;
        }

        if (!applications.length) {
            studentsListEl.innerHTML = `${summaryHtml}<div class="admin-card" style="grid-column: 1 / -1; text-align: center;"><h4>لا توجد طلبات مرتبطة حاليًا.</h4><span>سيظهر هنا أي طلب جديد أو تحديث جديد.</span></div>`;
            return;
        }

        studentsListEl.innerHTML = `${summaryHtml}${applications.map((application) => {
            const latestAttempt = store.getLatestExamAttempt(application.requestId);
            const actionBlock = isAdmin ? `
                <div class="card-actions">
                    <button class="btn-action success" onclick="approveApplication('${encodeValue(application.requestId)}')"><i class="fas fa-check"></i> قبول</button>
                    <button class="btn-action danger" onclick="rejectApplication('${encodeValue(application.requestId)}')"><i class="fas fa-xmark"></i> رفض</button>
                    <button class="btn-action" onclick="setPendingApplication('${encodeValue(application.requestId)}')"><i class="fas fa-clock"></i> انتظار</button>
                    <button class="btn-action" onclick="allowStudentExam('${encodeValue(application.requestId)}')"><i class="fas fa-unlock"></i> سماح</button>
                    <button class="btn-action danger" onclick="blockStudentExam('${encodeValue(application.requestId)}')"><i class="fas fa-ban"></i> منع</button>
                    <button class="btn-action" onclick="resetStudentExam('${encodeValue(application.requestId)}')"><i class="fas fa-rotate-left"></i> تصفير</button>
                    <button class="btn-action" onclick="editApplication('${encodeValue(application.requestId)}')"><i class="fas fa-pen"></i> تعديل</button>
                    <button class="btn-action" onclick="openStudentEditor('${encodeValue(application.requestId)}')"><i class="fas fa-up-right-from-square"></i> شاشة التعديل</button>
                    <button class="btn-action danger" onclick="removeApplication('${encodeValue(application.requestId)}')"><i class="fas fa-trash"></i> حذف</button>
                </div>
            ` : `
                <div class="card-actions">
                    <button class="btn-action" onclick="viewStudentStatus('${encodeValue(application.requestId)}', '${encodeValue(application.nationalId || '')}')"><i class="fas fa-eye"></i> فتح الطلب</button>
                    <button class="btn-action" onclick="openStudentEditor('${encodeValue(application.requestId)}')"><i class="fas fa-up-right-from-square"></i> شاشة التعديل</button>
                    <button class="btn-action" onclick="copyStudentRequestId('${encodeValue(application.requestId)}')"><i class="fas fa-copy"></i> نسخ الرقم</button>
                </div>
            `;

            return `
                <div class="admin-card student-card">
                    <div class="card-header">
                        <div class="user-info">
                            <h4>${escapeHtml(application.name || application.requestId)}</h4>
                            <span>${escapeHtml(application.requestId)} - ${escapeHtml(application.nationalId || 'بدون رقم قومي')}</span>
                        </div>
                        <span class="status-pill ${application.status === 'accepted' ? 'pill-active' : application.status === 'rejected' ? 'pill-suspended' : ''}">
                            ${escapeHtml(store.getStatusLabel(application.status))}
                        </span>
                    </div>
                    <div class="card-body">
                        <p><span>العمر</span><strong>${escapeHtml(application.age || '--')}</strong></p>
                        <p><span>المحافظة</span><strong>${escapeHtml(application.governorate || '--')}</strong></p>
                        <p><span>المركز</span><strong>${escapeHtml(application.city || '--')}</strong></p>
                        <p><span>القرية</span><strong>${escapeHtml(application.village || '--')}</strong></p>
                        <p><span>كود القائد</span><strong>${escapeHtml(application.leaderCode || '--')}</strong></p>
                        <p><span>بريد الدخول</span><strong>${escapeHtml(application.studentEmail || '--')}</strong></p>
                        <p><span>وضع الامتحان</span><strong>${escapeHtml(store.getExamAccessLabel(application.examAccess))}</strong></p>
                        <p><span>آخر تحديث</span><strong>${escapeHtml(formatDate(application.updatedAt || application.createdAt))}</strong></p>
                        <p><span>آخر نتيجة</span><strong>${latestAttempt ? `${latestAttempt.percentage || 0}%` : 'لا يوجد'}</strong></p>
                        ${application.message ? `<p style="display:block; margin-top:0.75rem;"><span>ملاحظة</span><strong style="display:block; margin-top:0.35rem;">${escapeHtml(application.message)}</strong></p>` : ''}
                    </div>
                    ${actionBlock}
                </div>
            `;
        }).join('')}`;
    }

    function renderWithdrawals() {
        if (!allWithdrawalsListEl) return;
        if (!isAdmin) {
            allWithdrawalsListEl.innerHTML = '<div class="admin-card"><h4>هذه المساحة متاحة للإدارة فقط.</h4></div>';
            return;
        }

        const transactions = authApi.getAllTransactions();
        const summaryHtml = renderSummaryRow([
            { label: 'كل العمليات', value: transactions.length },
            { label: 'قيد المراجعة', value: transactions.filter((item) => item.status === 'pending').length },
            { label: 'مرفوض أو خطأ', value: transactions.filter((item) => item.status === 'rejected' || item.status === 'error').length },
            { label: 'إجمالي المنفذ', value: formatMoney(transactions.filter((item) => item.status === 'completed').reduce((sum, item) => sum + Number(item.amount || 0), 0)) }
        ]);

        allWithdrawalsListEl.innerHTML = !transactions.length
            ? `${summaryHtml}<div class="admin-card"><h4>لا توجد طلبات سحب حتى الآن.</h4></div>`
            : `${summaryHtml}${transactions.map((transaction) => `
                <div class="admin-card">
                    <div class="card-header">
                        <div class="user-info">
                            <h4>${escapeHtml(transaction.userName || transaction.email)}</h4>
                            <span>${escapeHtml(transaction.email)} - ${escapeHtml(transaction.txId)}</span>
                        </div>
                        <span class="status-pill ${transaction.status === 'completed' ? 'pill-active' : (transaction.status === 'rejected' || transaction.status === 'error') ? 'pill-suspended' : ''}">
                            ${escapeHtml(transaction.statusLabel || transaction.status)}
                        </span>
                    </div>
                    <div class="card-body">
                        <p><span>المبلغ</span><strong>${escapeHtml(formatMoney(transaction.amount))}</strong></p>
                        <p><span>الوسيلة</span><strong>${escapeHtml(transaction.method || '--')}</strong></p>
                        <p><span>الجهة</span><strong>${escapeHtml(transaction.channelName || '--')}</strong></p>
                        <p><span>التفاصيل</span><strong>${escapeHtml(transaction.details || '--')}</strong></p>
                        <p><span>التاريخ</span><strong>${escapeHtml(formatDate(transaction.createdAt))}</strong></p>
                        <p><span>خصم الرصيد</span><strong>${transaction.debitedAt ? escapeHtml(formatDate(transaction.debitedAt)) : 'لم يخصم بعد'}</strong></p>
                        <p><span>آخر قرار</span><strong>${transaction.resolvedAt ? escapeHtml(formatDate(transaction.resolvedAt)) : 'لم يحسم بعد'}</strong></p>
                        ${transaction.adminMessage ? `<p style="display:block; margin-top:0.75rem;"><span>رسالة الإدارة</span><strong style="display:block; margin-top:0.35rem;">${escapeHtml(transaction.adminMessage)}</strong></p>` : ''}
                    </div>
                    <div class="card-actions">
                        <button class="btn-action success" onclick="promptWithdrawalStatus('${encodeValue(transaction.email)}', '${encodeValue(transaction.txId)}', 'completed')"><i class="fas fa-circle-check"></i> تنفيذ</button>
                        <button class="btn-action" onclick="promptWithdrawalStatus('${encodeValue(transaction.email)}', '${encodeValue(transaction.txId)}', 'pending')"><i class="fas fa-hourglass-half"></i> مراجعة</button>
                        <button class="btn-action danger" onclick="promptWithdrawalStatus('${encodeValue(transaction.email)}', '${encodeValue(transaction.txId)}', 'rejected')"><i class="fas fa-ban"></i> رفض</button>
                        <button class="btn-action danger" onclick="promptWithdrawalStatus('${encodeValue(transaction.email)}', '${encodeValue(transaction.txId)}', 'error')"><i class="fas fa-triangle-exclamation"></i> خطأ</button>
                        <button class="btn-action" onclick="editWithdrawal('${encodeValue(transaction.email)}', '${encodeValue(transaction.txId)}')"><i class="fas fa-pen"></i> تعديل</button>
                        <button class="btn-action danger" onclick="removeWithdrawal('${encodeValue(transaction.email)}', '${encodeValue(transaction.txId)}')"><i class="fas fa-trash"></i> حذف</button>
                    </div>
                </div>
            `).join('')}`;
    }

    function renderUsers() {
        if (!allUsersListEl) return;
        if (!isAdmin) {
            allUsersListEl.innerHTML = '<div class="admin-card"><h4>هذه المساحة متاحة للإدارة فقط.</h4></div>';
            return;
        }

        const users = authApi.getAllUsers();
        const summaryHtml = renderSummaryRow([
            { label: 'كل المستخدمين', value: users.length },
            { label: 'نشط', value: users.filter((user) => !user.isSuspended).length },
            { label: 'موقوف', value: users.filter((user) => user.isSuspended).length },
            { label: 'ممنوع امتحان', value: users.filter((user) => user.examAllowed === false).length }
        ]);

        allUsersListEl.innerHTML = `${summaryHtml}${users.map((user) => `
            <div class="admin-card" style="opacity:${user.isSuspended ? 0.7 : 1};">
                <div class="card-header">
                    <div class="user-info">
                        <h4>${escapeHtml(user.name || 'مستخدم بدون اسم')}</h4>
                        <span>${escapeHtml(user.email)}</span>
                    </div>
                    <span class="status-pill ${user.isSuspended ? 'pill-suspended' : 'pill-active'}">${user.isSuspended ? 'موقوف' : 'نشط'}</span>
                </div>
                <div class="card-body">
                    <p><span>الدور</span><strong>${escapeHtml(user.role || '--')}</strong></p>
                    <p><span>الرصيد</span><strong>${escapeHtml(formatMoney(user.balance))}</strong></p>
                    <p><span>كود القائد</span><strong>${escapeHtml(user.leaderCode || '--')}</strong></p>
                    <p><span>صلاحية الامتحان</span><strong>${user.examAllowed === false ? 'موقوفة' : 'مسموحة'}</strong></p>
                    <p><span>آخر دخول</span><strong>${escapeHtml(formatDate(user.lastLoginAt))}</strong></p>
                </div>
                <div class="card-actions">
                    <button class="btn-action" onclick="editUser('${encodeValue(user.email)}')"><i class="fas fa-user-pen"></i> تعديل</button>
                    <button class="btn-action" onclick="changeUserBalance('${encodeValue(user.email)}')"><i class="fas fa-coins"></i> رصيد</button>
                    <button class="btn-action ${user.isSuspended ? 'success' : 'danger'}" onclick="toggleUserStatus('${encodeValue(user.email)}')"><i class="fas ${user.isSuspended ? 'fa-play' : 'fa-pause'}"></i> ${user.isSuspended ? 'تنشيط' : 'إيقاف'}</button>
                    <button class="btn-action ${user.examAllowed === false ? 'success' : 'danger'}" onclick="toggleUserExam('${encodeValue(user.email)}')"><i class="fas ${user.examAllowed === false ? 'fa-unlock' : 'fa-lock'}"></i> ${user.examAllowed === false ? 'سماح امتحان' : 'منع امتحان'}</button>
                    ${isSuperAdminSession() ? `<button class="btn-action" data-pro-action="permissions-${escapeHtml(user.email)}" onclick="editUserPermissions('${encodeValue(user.email)}')"><i class="fas fa-shield-halved"></i> صلاحيات</button>` : ''}
                    <button class="btn-action" onclick="sendUserNotification('${encodeValue(user.email)}')"><i class="fas fa-bell"></i> إشعار</button>
                    <button class="btn-action danger" onclick="removeUser('${encodeValue(user.email)}')"><i class="fas fa-trash"></i> حذف</button>
                </div>
            </div>
        `).join('')}`;
    }

    function renderExams() {
        if (!globalExamControlEl) return;
        if (!isAdmin) {
            globalExamControlEl.innerHTML = '<div class="admin-card"><h4>هذه المساحة متاحة للإدارة فقط.</h4></div>';
            return;
        }

        const settings = store.getPlatformSettings();
        const attempts = store.getExamHistory().slice(0, 8);
        const now = examWindowApi?.getEgyptNow?.() || new Date();
        const windowState = examWindowApi?.getExamWindowState?.(now, settings) || { open: false, statusText: 'غير متاح', showCountdown: false };
        const modeLabel = settings.examMode === 'open'
            ? 'فتح يدوي'
            : settings.examMode === 'closed'
                ? 'إيقاف يدوي'
                : 'الجدول الرسمي';
        const openUntilText = settings.manualExamEndsAt ? formatDate(settings.manualExamEndsAt) : 'غير محدد';
        const manualDuration = Number(settings.manualExamDurationMinutes || 60);
        const liveCountdown = windowState.showCountdown && windowState.countdownTarget
            ? `${windowState.countdownPrefix}: ${examWindowApi.formatCountdown(windowState.countdownTarget - now)}`
            : windowState.statusText;

        globalExamControlEl.innerHTML = `
            ${renderSummaryRow([
                { label: 'الوضع الحالي', value: modeLabel },
                { label: 'حالة البوابة الآن', value: windowState.statusText },
                { label: 'آخر تحديث', value: formatDate(settings.updatedAt) },
                { label: 'إجمالي المحاولات', value: store.getExamHistory().length }
            ])}
            <div class="admin-grid" style="grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));">
                <div class="admin-card">
                    <div class="card-header"><div class="user-info"><h4>التحكم العام في الامتحانات</h4><span>أي تغيير هنا ينعكس على البوابة مباشرة.</span></div></div>
                    <div class="card-body">
                        <p><span>الوضع</span><strong>${escapeHtml(modeLabel)}</strong></p>
                        <p><span>الحالة المباشرة</span><strong>${escapeHtml(windowState.statusText)}</strong></p>
                        <p><span>نهاية الفتح اليدوي</span><strong>${escapeHtml(openUntilText)}</strong></p>
                        <p><span>مدة الفتح اليدوي</span><strong>${escapeHtml(String(manualDuration))} دقيقة</strong></p>
                        <p><span>الرسالة الحالية</span><strong>${escapeHtml(settings.examModeMessage || 'لا توجد رسالة مخصصة')}</strong></p>
                        <p><span>المؤقت الحالي</span><strong>${escapeHtml(liveCountdown)}</strong></p>
                    </div>
                    <div class="card-actions" style="grid-template-columns: repeat(3, 1fr);">
                        <button class="btn-action success" onclick="openExamWindow()"><i class="fas fa-door-open"></i> فتح الآن</button>
                        <button class="btn-action danger" onclick="closeExamWindow()"><i class="fas fa-circle-stop"></i> إيقاف الآن</button>
                        <button class="btn-action" onclick="restoreExamSchedule()"><i class="fas fa-calendar-days"></i> العودة للجدول</button>
                    </div>
                    <div class="card-actions" style="grid-template-columns: 1fr;">
                        <button class="btn-action" onclick="editExamMessage()"><i class="fas fa-comment-medical"></i> تعديل الرسالة</button>
                    </div>
                </div>
                <div class="admin-card">
                    <div class="card-header"><div class="user-info"><h4>إدارة الدورة الحالية</h4><span>يمكن فتح الامتحان بعدد دقائق محدد أو تصفير محاولات طالب محدد.</span></div></div>
                    <div class="card-body">
                        <p><span>الوضع المتوقع الآن</span><strong>${escapeHtml(windowState.bannerText || windowState.statusText)}</strong></p>
                    </div>
                    <div class="card-actions">
                        <button class="btn-action success" onclick="openExamWindow()"><i class="fas fa-hourglass-start"></i> فتح بمؤقت</button>
                        <button class="btn-action" onclick="manualExamReset()"><i class="fas fa-rotate-left"></i> تصفير يدوي</button>
                    </div>
                </div>
            </div>
            <div class="admin-card" style="margin-top: 1.25rem;">
                <div class="card-header"><div class="user-info"><h4>آخر محاولات الامتحان</h4><span>أحدث عمليات التسليم المسجلة.</span></div></div>
                <div class="card-body">
                    ${attempts.length ? attempts.map((attempt) => `<p><span>${escapeHtml(attempt.name || attempt.requestId)}</span><strong>${escapeHtml(attempt.requestId)} - ${escapeHtml(String(attempt.percentage || 0))}% - ${escapeHtml(formatDate(attempt.date))}</strong></p>`).join('') : '<p>لا توجد محاولات مسجلة بعد.</p>'}
                </div>
            </div>
        `;
    }

    function renderSupportDeskMessages(thread) {
        const messages = Array.isArray(thread?.messages) ? thread.messages : [];
        if (!messages.length) {
            return `
                <div class="support-desk-empty">
                    <i class="fas fa-headset"></i>
                    <strong>لا توجد رسائل بعد</strong>
                    <p>بمجرد وصول أول رسالة من المستخدم ستظهر المحادثة هنا بشكل مرتب.</p>
                </div>
            `;
        }

        return messages.map((message) => {
            const sender = message.sender === 'admin'
                ? 'admin'
                : message.sender === 'bot'
                    ? 'bot'
                    : 'user';
            const senderLabel = sender === 'admin'
                ? (message.senderName || 'الدعم الإداري')
                : sender === 'bot'
                    ? 'المساعد الآلي'
                    : (thread.userName || 'المستخدم');
            const senderState = sender === 'admin'
                ? 'رد الإدارة'
                : sender === 'bot'
                    ? 'رد تلقائي'
                    : 'رسالة مستخدم';
            const avatarLabel = sender === 'admin' ? 'د' : sender === 'bot' ? 'آ' : 'م';
            const isUserMessage = sender === 'user';

            return `
                <article class="support-desk-message is-${sender}">
                    ${isUserMessage ? '' : `<span class="support-desk-avatar">${escapeHtml(avatarLabel)}</span>`}
                    <div class="support-desk-bubble">
                        <span>${escapeHtml(senderLabel)} - ${escapeHtml(senderState)}</span>
                        <p>${escapeHtml(message.text)}</p>
                        <small>${escapeHtml(formatDate(message.createdAt))}</small>
                    </div>
                    ${isUserMessage ? `<span class="support-desk-avatar">${escapeHtml(avatarLabel)}</span>` : ''}
                </article>
            `;
        }).join('');
    }

    function renderSupportThreadListItem(thread, isActive = false) {
        return `
            <button type="button" class="support-desk-thread-btn${isActive ? ' is-active' : ''}" onclick="selectSupportThread('${encodeValue(thread.email)}')">
                <div class="support-desk-thread-top">
                    <strong>${escapeHtml(thread.userName || thread.email)}</strong>
                    ${Number(thread.unreadByAdmin || 0) > 0 ? `<span class="support-desk-unread">${thread.unreadByAdmin > 99 ? '99+' : escapeHtml(thread.unreadByAdmin)}</span>` : ''}
                </div>
                <p class="support-desk-thread-preview">${escapeHtml(thread.lastMessagePreview || 'لا توجد معاينة متاحة.')}</p>
                <div class="support-desk-thread-bottom">
                    <span class="support-desk-subtext">${escapeHtml(thread.role || 'مستخدم المنصة')}</span>
                    <span class="support-desk-subtext">${escapeHtml(formatDate(thread.updatedAt))}</span>
                </div>
            </button>
        `;
    }

    function renderSupportConversation(thread) {
        return `
            <div class="support-desk-conversation-head">
                <div class="support-desk-meta">
                    <div>
                        <h3>${escapeHtml(thread.userName || thread.email)}</h3>
                        <p class="support-desk-subtext">${escapeHtml(thread.email)}${thread.role ? ` - ${escapeHtml(thread.role)}` : ''}</p>
                    </div>
                    <span class="status-pill ${thread.status === 'closed' ? 'pill-suspended' : 'pill-active'}">${thread.status === 'closed' ? 'مغلقة' : 'نشطة'}</span>
                </div>
                <div class="support-desk-meta">
                    <span class="support-desk-subtext">عدد الرسائل: ${escapeHtml((thread.messages || []).length)}</span>
                    <span class="support-desk-subtext">آخر تحديث: ${escapeHtml(formatDate(thread.updatedAt))}</span>
                    <span class="support-desk-subtext">غير مقروء: ${escapeHtml(thread.unreadByAdmin || 0)}</span>
                </div>
                <div class="support-desk-actions">
                    <button class="btn-action success" onclick="replySupportThread('${encodeValue(thread.email)}')"><i class="fas fa-reply"></i> رد سريع</button>
                    <button class="btn-action" onclick="markSupportMessagesRead('${encodeValue(thread.email)}')"><i class="fas fa-envelope-open-text"></i> تعليم كمقروء</button>
                    <button class="btn-action ${thread.status === 'closed' ? 'success' : 'danger'}" onclick="toggleSupportThreadStatus('${encodeValue(thread.email)}', '${thread.status === 'closed' ? 'open' : 'closed'}')"><i class="fas ${thread.status === 'closed' ? 'fa-lock-open' : 'fa-lock'}"></i> ${thread.status === 'closed' ? 'إعادة فتح' : 'إغلاق'}</button>
                    <button class="btn-action danger" onclick="removeSupportThread('${encodeValue(thread.email)}')"><i class="fas fa-trash"></i> حذف المحادثة</button>
                </div>
            </div>
            <div class="support-desk-body">
                <div class="support-desk-stream">
                    ${renderSupportDeskMessages(thread)}
                </div>
            </div>
        `;
    }

    renderSupport = function renderSupportInbox() {
        if (!supportInboxListEl) return;
        if (!isAdmin) {
            supportInboxListEl.innerHTML = renderEmptyState('fa-lock', 'هذه المساحة للإدارة فقط', 'صندوق الدعم الإداري لا يظهر إلا للإدارة العامة.');
            return;
        }

        const { all, filtered } = getSupportDataset();
        const summaryHtml = renderSummaryRow([
            { label: 'المعروض الآن', value: filtered.length },
            { label: 'إجمالي المحادثات', value: all.length },
            { label: 'مفتوحة', value: all.filter((item) => item.status === 'open').length },
            { label: 'غير مقروءة', value: all.filter((item) => Number(item.unreadByAdmin || 0) > 0).length }
        ]);

        if (!filtered.length) {
            dashboardState.support.selectedEmail = '';
            supportInboxListEl.innerHTML = `${summaryHtml}${renderEmptyState('fa-headset', 'لا توجد محادثات دعم مطابقة', 'ستظهر هنا الرسائل الواردة من المستخدمين عند التواصل مع الدعم الإداري.')}`;
            return;
        }

        const selectedThread = getSelectedSupportThread(filtered);

        supportInboxListEl.innerHTML = `
            ${summaryHtml}
            <div class="support-desk">
                <aside class="support-desk-sidebar">
                    <div class="support-desk-sidebar-head">
                        <h3>صندوق الدعم</h3>
                        <p class="support-desk-subtext">اختر أي محادثة لعرضها بالكامل والرد عليها بسرعة.</p>
                    </div>
                    <div class="support-desk-list">
                        ${filtered.map((thread) => renderSupportThreadListItem(thread, thread.email === selectedThread?.email)).join('')}
                    </div>
                </aside>
                <section class="support-desk-conversation">
                    ${selectedThread ? renderSupportConversation(selectedThread) : `
                        <div class="support-desk-empty">
                            <i class="fas fa-comments"></i>
                            <strong>اختر محادثة من القائمة</strong>
                            <p>بمجرد اختيار أي مستخدم ستظهر تفاصيل الرسائل هنا مع أدوات الرد السريع.</p>
                        </div>
                    `}
                </section>
            </div>
        `;
    };

    window.selectSupportThread = (encodedEmail) => {
        if (!guardAdmin()) return false;
        const email = decodeValue(encodedEmail);
        dashboardState.support.selectedEmail = email;

        const thread = store.getSupportThreadByEmail?.(email);
        if (thread && Number(thread.unreadByAdmin || 0) > 0 && store.markSupportThreadRead) {
            store.markSupportThreadRead(email, 'admin');
            Promise.resolve(store.syncNow?.()).catch(() => {});
        }

        scheduleRenderAll();
        return true;
    };

    renderSupport = function renderSupportInboxFinal() {
        if (!supportInboxListEl) return;
        if (!isAdmin) {
            supportInboxListEl.innerHTML = renderEmptyState('fa-lock', 'هذه المساحة للإدارة فقط', 'صندوق الدعم الإداري لا يظهر إلا للإدارة العامة.');
            return;
        }

        const { all, filtered } = getSupportDataset();
        const summaryHtml = renderSummaryRow([
            { label: 'المعروض الآن', value: filtered.length },
            { label: 'إجمالي المحادثات', value: all.length },
            { label: 'مفتوحة', value: all.filter((item) => item.status === 'open').length },
            { label: 'غير مقروءة', value: all.filter((item) => Number(item.unreadByAdmin || 0) > 0).length }
        ]);

        if (!filtered.length) {
            dashboardState.support.selectedEmail = '';
            supportInboxListEl.innerHTML = `${summaryHtml}${renderEmptyState('fa-headset', 'لا توجد محادثات دعم مطابقة', 'ستظهر هنا الرسائل الواردة من المستخدمين عند التواصل مع الدعم الإداري.')}`;
            return;
        }

        const selectedThread = getSelectedSupportThread(filtered);

        supportInboxListEl.innerHTML = `
            ${summaryHtml}
            <div class="support-desk">
                <aside class="support-desk-sidebar">
                    <div class="support-desk-sidebar-head">
                        <h3>صندوق الدعم</h3>
                        <p class="support-desk-subtext">اختر أي محادثة لعرضها بالكامل والرد عليها بسرعة.</p>
                    </div>
                    <div class="support-desk-list">
                        ${filtered.map((thread) => renderSupportThreadListItem(thread, thread.email === selectedThread?.email)).join('')}
                    </div>
                </aside>
                <section class="support-desk-conversation">
                    ${selectedThread ? renderSupportConversation(selectedThread) : `
                        <div class="support-desk-empty">
                            <i class="fas fa-comments"></i>
                            <strong>اختر محادثة من القائمة</strong>
                            <p>بمجرد اختيار أي مستخدم ستظهر تفاصيل الرسائل هنا مع أدوات الرد السريع.</p>
                        </div>
                    `}
                </section>
            </div>
        `;
    };

    window.selectSupportThread = (encodedEmail) => {
        if (!guardAdmin()) return false;
        const email = decodeValue(encodedEmail);
        dashboardState.support.selectedEmail = email;

        const thread = store.getSupportThreadByEmail?.(email);
        if (thread && Number(thread.unreadByAdmin || 0) > 0 && store.markSupportThreadRead) {
            store.markSupportThreadRead(email, 'admin');
            Promise.resolve(store.syncNow?.()).catch(() => {});
        }

        scheduleRenderAll();
        return true;
    };

    renderSupport = function renderSupportInboxLatest() {
        if (!supportInboxListEl) return;
        if (!isAdmin) {
            supportInboxListEl.innerHTML = renderEmptyState('fa-lock', 'هذه المساحة للإدارة فقط', 'صندوق الدعم الإداري لا يظهر إلا للإدارة العامة.');
            return;
        }

        const { all, filtered } = getSupportDataset();
        const summaryHtml = renderSummaryRow([
            { label: 'المعروض الآن', value: filtered.length },
            { label: 'إجمالي المحادثات', value: all.length },
            { label: 'مفتوحة', value: all.filter((item) => item.status === 'open').length },
            { label: 'غير مقروءة', value: all.filter((item) => Number(item.unreadByAdmin || 0) > 0).length }
        ]);

        if (!filtered.length) {
            dashboardState.support.selectedEmail = '';
            supportInboxListEl.innerHTML = `${summaryHtml}${renderEmptyState('fa-headset', 'لا توجد محادثات دعم مطابقة', 'ستظهر هنا الرسائل الواردة من المستخدمين عند التواصل مع الدعم الإداري.')}`;
            return;
        }

        const selectedThread = getSelectedSupportThread(filtered);

        supportInboxListEl.innerHTML = `
            ${summaryHtml}
            <div class="support-desk">
                <aside class="support-desk-sidebar">
                    <div class="support-desk-sidebar-head">
                        <h3>صندوق الدعم</h3>
                        <p class="support-desk-subtext">اختر أي محادثة لعرضها بالكامل والرد عليها بسرعة.</p>
                    </div>
                    <div class="support-desk-list">
                        ${filtered.map((thread) => renderSupportThreadListItem(thread, thread.email === selectedThread?.email)).join('')}
                    </div>
                </aside>
                <section class="support-desk-conversation">
                    ${selectedThread ? renderSupportConversation(selectedThread) : `
                        <div class="support-desk-empty">
                            <i class="fas fa-comments"></i>
                            <strong>اختر محادثة من القائمة</strong>
                            <p>بمجرد اختيار أي مستخدم ستظهر تفاصيل الرسائل هنا مع أدوات الرد السريع.</p>
                        </div>
                    `}
                </section>
            </div>
        `;
    };

    window.selectSupportThread = (encodedEmail) => {
        if (!guardAdmin()) return false;
        const email = decodeValue(encodedEmail);
        dashboardState.support.selectedEmail = email;

        const thread = store.getSupportThreadByEmail?.(email);
        if (thread && Number(thread.unreadByAdmin || 0) > 0 && store.markSupportThreadRead) {
            store.markSupportThreadRead(email, 'admin');
            Promise.resolve(store.syncNow?.()).catch(() => {});
        }

        scheduleRenderAll();
        return true;
    };

    function renderNotifications() {
        if (!notificationsTabEl) return;
        if (!isAdmin) {
            notificationsTabEl.innerHTML = '<div class="content-card"><div class="admin-card"><h4>هذه المساحة متاحة للإدارة فقط.</h4></div></div>';
            return;
        }

        const notifications = store.getNotifications();
        notificationsTabEl.innerHTML = `
            <div class="content-card">
                <div class="card-heading">
                    <span class="mini-badge">التواصل</span>
                    <h3>إدارة الإشعارات المنشورة</h3>
                    <p>إنشاء إشعار جديد أو تعديل أي إشعار منشور أو حذفه.</p>
                </div>
                ${renderSummaryRow([
                    { label: 'كل الإشعارات', value: notifications.length },
                    { label: 'امتحانات', value: notifications.filter((item) => item.type === 'exam').length },
                    { label: 'طلبات', value: notifications.filter((item) => item.type === 'application').length },
                    { label: 'ماليات', value: notifications.filter((item) => item.type === 'finance').length }
                ])}
                <div class="admin-grid" style="grid-template-columns: 1fr;">
                    <div class="admin-card">
                        <h4>إشعار جديد</h4>
                        <p>يمكن نشر إشعار عام أو تنبيه خاص بنوع محدد.</p>
                        <button class="btn-primary" onclick="createPlatformNotification()"><i class="fas fa-plus"></i> إنشاء إشعار</button>
                    </div>
                    ${notifications.map((note) => `
                        <div class="admin-card">
                            <div class="card-header">
                                <div class="user-info">
                                    <h4>${escapeHtml(note.title)}</h4>
                                    <span>${escapeHtml(formatDate(note.createdAt))} - ${escapeHtml(note.type || 'update')}</span>
                                </div>
                            </div>
                            <div class="card-body">
                                <p style="display:block;"><strong>${escapeHtml(note.body)}</strong></p>
                                <p><span>الرابط</span><strong>${escapeHtml(note.actionUrl || '--')}</strong></p>
                                <p><span>زر الإجراء</span><strong>${escapeHtml(note.actionLabel || '--')}</strong></p>
                            </div>
                            <div class="card-actions">
                                <button class="btn-action" onclick="editPlatformNotification('${encodeValue(note.id)}')"><i class="fas fa-pen"></i> تعديل</button>
                                <button class="btn-action danger" onclick="removePlatformNotification('${encodeValue(note.id)}')"><i class="fas fa-trash"></i> حذف</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    function renderAll() {
        if (adminTabsContainer) adminTabsContainer.style.display = isAdmin ? 'flex' : 'none';
        if (!isAdmin) [withdrawalsTabEl, usersTabEl, examsTabEl, notificationsTabEl].forEach((tab) => {
            if (tab) tab.style.display = 'none';
        });
        renderStudents();
        renderWithdrawals();
        renderUsers();
        renderExams();
        renderNotifications();
    }

    window.switchTab = (tabId) => {
        document.querySelectorAll('.admin-tab-content').forEach((content) => content.classList.toggle('active', content.id === tabId));
        document.querySelectorAll('.admin-tab-btn').forEach((button) => button.classList.toggle('active', button === window.event?.currentTarget));
    };

    window.viewStudentStatus = (encodedRequestId, encodedNationalId) => {
        const requestId = decodeValue(encodedRequestId);
        const nationalId = decodeValue(encodedNationalId);
        window.location.href = `./status.html?requestId=${encodeURIComponent(requestId)}&nationalId=${encodeURIComponent(nationalId)}`;
    };

    window.copyStudentRequestId = async (encodedRequestId) => {
        const requestId = decodeValue(encodedRequestId);
        try {
            await navigator.clipboard.writeText(requestId);
            showToast(`تم نسخ رقم الطلب ${requestId}`);
        } catch (error) {
            showToast(`رقم الطلب: ${requestId}`);
        }
    };

    window.openStudentEditor = (encodedRequestId) => {
        const requestId = decodeValue(encodedRequestId);
        window.location.href = `./student-editor.html?requestId=${encodeURIComponent(requestId)}`;
    };

    window.approveApplication = async (encodedRequestId) => {
        if (!guardAdmin()) return;
        const requestId = decodeValue(encodedRequestId);
        const application = store.getApplicationByRequestId(requestId);
        if (!application) return;

        // تحديث حالة الطلب في منصة التسجيل
        store.updateApplicationStatus(requestId, 'accepted');
        
        // إذا كان للطالب حساب مفعل، نقوم بتحديث حالته في نظام الأمان أيضاً
        if (application.studentEmail) {
            authApi.updateUserPersistentData(application.studentEmail, {
                isSuspended: false,
                examAllowed: true,
                applicationStatus: 'accepted'
            });
        }

        await syncAll();
        await refreshAll(true);
        showToast(`تم قبول الطلب ${requestId} بنجاح.`);
    };

    window.rejectApplication = (encodedRequestId) => {
        if (!guardAdmin()) return;
        const requestId = decodeValue(encodedRequestId);
        const application = store.getApplicationByRequestId(requestId);
        if (!application) return;

        openModal('رفض الطلب', `
            <div class="form-group"><label>اسم الطالب</label><input class="form-control" type="text" value="${escapeHtml(application.name || requestId)}" disabled></div>
            <div class="form-group"><label>سبب الرفض</label><textarea class="form-control" id="reject-reason" rows="4">${escapeHtml(application.message || '')}</textarea></div>
        `, async () => {
            const reason = document.getElementById('reject-reason')?.value.trim() || 'تم رفض الطلب بعد المراجعة الحالية.';
            
            // تحديث حالة الطلب في منصة التسجيل
            store.updateApplicationStatus(requestId, 'rejected', reason);
            
            // تحديث حساب الطالب إذا وجد
            if (application.studentEmail) {
                authApi.updateUserPersistentData(application.studentEmail, {
                    isSuspended: true,
                    applicationStatus: 'rejected'
                });
            }

            await syncAll();
            showToast(`تم رفض الطلب ${requestId}.`);
        }, 'حفظ الرفض');
    };

    window.setPendingApplication = async (encodedRequestId) => {
        if (!guardAdmin()) return;
        store.updateApplicationStatus(decodeValue(encodedRequestId), 'pending', 'الطلب قيد المراجعة حاليًا وسيتم تحديث الحالة بعد انتهاء المراجعة.');
        await syncAll();
        await refreshAll(true);
        showToast('تم تحويل الطلب للمراجعة وحفظ البيانات.');
    };

    window.allowStudentExam = async (encodedRequestId) => {
        if (!guardAdmin()) return;
        store.setExamAccess(decodeValue(encodedRequestId), 'allowed', 'تم السماح بدخول الامتحان بقرار إداري.');
        await syncAll();
        await refreshAll(true);
        showToast('تم تفعيل دخول الامتحان وحفظ البيانات.');
    };

    window.blockStudentExam = (encodedRequestId) => {
        if (!guardAdmin()) return;
        const requestId = decodeValue(encodedRequestId);
        openModal('منع الطالب من الامتحان', `
            <div class="form-group"><label>سبب المنع</label><textarea class="form-control" id="exam-block-reason" rows="4">تم إيقاف صلاحية دخول الامتحان بقرار من الإدارة.</textarea></div>
        `, async () => {
            const reason = document.getElementById('exam-block-reason')?.value.trim() || 'تم إيقاف صلاحية دخول الامتحان بقرار من الإدارة.';
            store.setExamAccess(requestId, 'blocked', reason);
            await syncAll();
        }, 'حفظ المنع');
    };

    window.resetStudentExam = async (encodedRequestId) => {
        if (!guardAdmin()) return;
        const requestId = decodeValue(encodedRequestId);
        if (!window.confirm(`تصفير محاولات الامتحان للطلب ${requestId}؟`)) return;
        const application = store.getApplicationByRequestId(requestId);
        store.clearExamAttempts(requestId);
        if (application) {
            await notifyApplicationOwner(application, {
                title: `تصفير الامتحان ${application.requestId}`,
                body: 'تم تصفير سجل محاولات الامتحان الخاص بطلبك من الإدارة.',
                type: 'exam',
                actionUrl: './exam-status.html',
                actionLabel: 'فتح بوابة الامتحان'
            });
        }
        await syncAll();
        await refreshAll(true);
        showToast('تم تصفير محاولات الامتحان بنجاح.');
    };

    window.editApplication = (encodedRequestId) => {
        if (!guardAdmin()) return;
        const requestId = decodeValue(encodedRequestId);
        const application = store.getApplicationByRequestId(requestId);
        if (!application) return;
        openModal('تعديل بيانات الطلب', `
            <div class="form-group"><label>الاسم</label><input class="form-control" id="edit-app-name" type="text" value="${escapeHtml(application.name || '')}"></div>
            <div class="form-group"><label>العمر</label><input class="form-control" id="edit-app-age" type="number" value="${escapeHtml(application.age || '')}"></div>
            <div class="form-group"><label>المحافظة</label><input class="form-control" id="edit-app-governorate" type="text" value="${escapeHtml(application.governorate || '')}"></div>
            <div class="form-group"><label>المركز</label><input class="form-control" id="edit-app-city" type="text" value="${escapeHtml(application.city || '')}"></div>
            <div class="form-group"><label>القرية</label><input class="form-control" id="edit-app-village" type="text" value="${escapeHtml(application.village || '')}"></div>
            <div class="form-group"><label>كود القائد</label><input class="form-control" id="edit-app-leader" type="text" value="${escapeHtml(application.leaderCode || '')}"></div>
            <div class="form-group"><label>رسالة الحالة</label><textarea class="form-control" id="edit-app-message" rows="4">${escapeHtml(application.message || '')}</textarea></div>
        `, async () => {
            const updatedApplication = store.updateApplicationDetails(requestId, {
                name: document.getElementById('edit-app-name')?.value.trim() || application.name,
                age: Number(document.getElementById('edit-app-age')?.value || application.age || 0),
                governorate: document.getElementById('edit-app-governorate')?.value.trim() || '',
                city: document.getElementById('edit-app-city')?.value.trim() || '',
                village: document.getElementById('edit-app-village')?.value.trim() || '',
                leaderCode: document.getElementById('edit-app-leader')?.value.trim() || '',
                message: document.getElementById('edit-app-message')?.value.trim() || ''
            });
            if (updatedApplication) {
                const changeParts = [];
                if (String(updatedApplication.leaderCode || '') !== String(application.leaderCode || '')) {
                    changeParts.push(`تم تحديث كود القائد إلى ${updatedApplication.leaderCode || '--'}.`);
                }
                if (String(updatedApplication.message || '') !== String(application.message || '')) {
                    changeParts.push('تم تحديث رسالة الطلب من الإدارة.');
                }
                await notifyApplicationOwner(updatedApplication, {
                    title: `تحديث بيانات الطلب ${updatedApplication.requestId}`,
                    body: changeParts.length ? changeParts.join(' ') : 'تم تحديث بيانات طلبك من الإدارة.',
                    type: 'application'
                });
            }
            await syncAll();
        });
    };

    window.removeApplication = async (encodedRequestId) => {
        if (!guardAdmin()) return;
        const requestId = decodeValue(encodedRequestId);
        if (!window.confirm(`حذف الطلب ${requestId} نهائيًا؟`)) return;
        store.deleteApplication(requestId);
        await syncAll();
        await refreshAll(true);
        showToast('تم حذف الطلب نهائيًا بنجاح.');
    };

    function getWithdrawalStatusMeta(status) {
        if (status === 'completed') {
            return {
                label: 'تم التنفيذ',
                defaultMessage: 'تم تنفيذ عملية السحب وتحويل المبلغ بنجاح.',
                requiresReason: false
            };
        }
        if (status === 'rejected') {
            return {
                label: 'مرفوض',
                defaultMessage: 'تم رفض طلب السحب بعد المراجعة.',
                requiresReason: true
            };
        }
        if (status === 'error') {
            return {
                label: 'خطأ في البيانات',
                defaultMessage: 'تم إيقاف الطلب لوجود خطأ في بيانات السحب. يرجى مراجعة البيانات ثم إعادة الطلب.',
                requiresReason: true
            };
        }
        return {
            label: 'قيد المراجعة',
            defaultMessage: 'تم إعادة الطلب إلى المراجعة.',
            requiresReason: false
        };
    }

    window.promptWithdrawalStatus = (encodedEmail, encodedTxId, status) => {
        if (!guardAdmin()) return;
        const email = decodeValue(encodedEmail);
        const txId = decodeValue(encodedTxId);
        const transaction = authApi.getTransaction(email, txId);
        if (!transaction) return;

        const statusMeta = getWithdrawalStatusMeta(status);
        const textareaLabel = statusMeta.requiresReason ? 'سبب القرار' : 'ملاحظة للمستخدم';
        openModal('تحديث حالة عملية السحب', `
            <div class="form-group"><label>رقم العملية</label><input class="form-control" type="text" value="${escapeHtml(txId)}" disabled></div>
            <div class="form-group"><label>الحالة الجديدة</label><input class="form-control" type="text" value="${escapeHtml(statusMeta.label)}" disabled></div>
            <div class="form-group"><label>${textareaLabel}</label><textarea class="form-control" id="withdrawal-admin-message" rows="4">${escapeHtml(transaction.adminMessage || statusMeta.defaultMessage)}</textarea></div>
        `, async () => {
            const message = document.getElementById('withdrawal-admin-message')?.value.trim() || statusMeta.defaultMessage;
            if (statusMeta.requiresReason && !message) {
                showToast('اكتب سبب القرار أولًا.');
                return false;
            }
            return await window.setWithdrawalStatus(encodedEmail, encodedTxId, status, message);
        }, 'حفظ القرار');
    };

    renderSupport = function renderSupportInboxTerminal() {
        if (!supportInboxListEl) return;
        if (!isAdmin) {
            supportInboxListEl.innerHTML = renderEmptyState('fa-lock', 'هذه المساحة للإدارة فقط', 'صندوق الدعم الإداري لا يظهر إلا للإدارة العامة.');
            return;
        }

        const { all, filtered } = getSupportDataset();
        const summaryHtml = renderSummaryRow([
            { label: 'المعروض الآن', value: filtered.length },
            { label: 'إجمالي المحادثات', value: all.length },
            { label: 'مفتوحة', value: all.filter((item) => item.status === 'open').length },
            { label: 'غير مقروءة', value: all.filter((item) => Number(item.unreadByAdmin || 0) > 0).length }
        ]);

        if (!filtered.length) {
            dashboardState.support.selectedEmail = '';
            supportInboxListEl.innerHTML = `${summaryHtml}${renderEmptyState('fa-headset', 'لا توجد محادثات دعم مطابقة', 'ستظهر هنا الرسائل الواردة من المستخدمين عند التواصل مع الدعم الإداري.')}`;
            return;
        }

        const selectedThread = getSelectedSupportThread(filtered);

        supportInboxListEl.innerHTML = `
            ${summaryHtml}
            <div class="support-desk">
                <aside class="support-desk-sidebar">
                    <div class="support-desk-sidebar-head">
                        <h3>صندوق الدعم</h3>
                        <p class="support-desk-subtext">اختر أي محادثة لعرضها بالكامل والرد عليها بسرعة.</p>
                    </div>
                    <div class="support-desk-list">
                        ${filtered.map((thread) => renderSupportThreadListItem(thread, thread.email === selectedThread?.email)).join('')}
                    </div>
                </aside>
                <section class="support-desk-conversation">
                    ${selectedThread ? renderSupportConversation(selectedThread) : `
                        <div class="support-desk-empty">
                            <i class="fas fa-comments"></i>
                            <strong>اختر محادثة من القائمة</strong>
                            <p>بمجرد اختيار أي مستخدم ستظهر تفاصيل الرسائل هنا مع أدوات الرد السريع.</p>
                        </div>
                    `}
                </section>
            </div>
        `;
    };

    window.selectSupportThread = (encodedEmail) => {
        if (!guardAdmin()) return false;
        const email = decodeValue(encodedEmail);
        dashboardState.support.selectedEmail = email;

        const thread = store.getSupportThreadByEmail?.(email);
        if (thread && Number(thread.unreadByAdmin || 0) > 0 && store.markSupportThreadRead) {
            store.markSupportThreadRead(email, 'admin');
            Promise.resolve(store.syncNow?.()).catch(() => {});
        }

        scheduleRenderAll();
        return true;
    };

    window.switchTab = (tabId) => {
        const next = !isAdmin ? 'students-tab' : tabId;
        dashboardState.activeTab = next;
        markTabCounterSeen(next);
        document.querySelectorAll('.admin-tab-content').forEach(c => {
            c.classList.toggle('active', c.id === next);
        });
        document.querySelectorAll('.admin-tab-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.tabTarget === next);
        });
        if (tabSelectEl) tabSelectEl.value = next;
        updateDashboardChrome();
        scheduleRenderAll();
    };

    window.setWithdrawalStatus = async (encodedEmail, encodedTxId, status, adminMessage = '') => {
        if (!guardAdmin()) return false;
        const email = decodeValue(encodedEmail);
        const txId = decodeValue(encodedTxId);
        
        // جلب أحدث البيانات من السيرفر قبل اتخاذ أي قرار مالي لضمان عدم التكرار
        await authApi.refreshFromRemote?.({ force: true });
        
        const transaction = authApi.getTransaction(email, txId);
        const user = authApi.getUserByEmail(email);
        
        if (!transaction || !user) {
            showToast('تعذر العثور على عملية السحب أو المستخدم.');
            return false;
        }

        const statusMeta = getWithdrawalStatusMeta(status);
        const amount = Number(transaction.amount || 0);
        const currentBalance = Number(user.balance || 0);
        const currentStatus = String(transaction.status || 'pending').trim();
        
        // التحقق مما إذا كان الرصيد قد خصم بالفعل
        const alreadyDebited = Boolean(transaction.debitedAt) || currentStatus === 'completed';
        
        const nextMessage = String(adminMessage || transaction.adminMessage || statusMeta.defaultMessage).trim();
        const now = new Date().toISOString();
        let nextBalance = currentBalance;
        let debitedAt = transaction.debitedAt || '';
        let resolvedAt = transaction.resolvedAt || '';

        // 1. إذا كانت الحالة الجديدة هي "تم التنفيذ"
        if (status === 'completed') {
            if (!alreadyDebited) {
                if (amount > currentBalance) {
                    showToast('فشل: رصيد المستخدم غير كافٍ لتنفيذ هذه العملية.');
                    return false;
                }
                nextBalance = currentBalance - amount;
                debitedAt = now;
                // تحديث رصيد المستخدم فوراً في الذاكرة والقاعدة
                authApi.updateUserPersistentData(email, { balance: nextBalance });
            }
            resolvedAt = now;
        } 
        // 2. إذا تم تغيير الحالة من "منفذ" إلى أي حالة أخرى (إرجاع الرصيد)
        else if (alreadyDebited && (status === 'pending' || status === 'rejected' || status === 'error')) {
            nextBalance = currentBalance + amount;
            authApi.updateUserPersistentData(email, { balance: nextBalance });
            debitedAt = '';
            resolvedAt = (status === 'pending') ? '' : now;
        }
        // 3. حالة الرفض أو الخطأ لأول مرة (لا يوجد خصم رصيد)
        else if (status === 'rejected' || status === 'error') {
            resolvedAt = now;
            debitedAt = '';
        }

        // تحديث بيانات العملية (الحالة والملاحظات والتواريخ)
        authApi.updateTransaction(email, txId, {
            status,
            statusLabel: statusMeta.label,
            adminMessage: nextMessage,
            debitedAt,
            resolvedAt,
            updatedAt: now
        });

        // إرسال إشعار خاص للطالب
        try {
            await authApi.pushPrivateNotification?.(email, {
                title: `تحديث عملية السحب: ${statusMeta.label}`,
                body: `${nextMessage} (رقم العملية: ${txId})`,
                type: 'finance',
                actionUrl: './wallet.html',
                actionLabel: 'فتح المحفظة'
            });
        } catch (error) {
            console.error('Private notification failed:', error);
        }

        // إضافة إشعار عام للمنصة (اختياري)
        store.addNotification({
            title: `تحديث عملية سحب`,
            body: `تم تحديث حالة العملية ${txId} للمستخدم ${user.name || user.email} إلى ${statusMeta.label}.`,
            type: 'finance',
            actionUrl: './wallet.html',
            actionLabel: 'التفاصيل'
        });

        // المزامنة النهائية مع Firebase وتحديث الواجهة
        await syncAll();
        await refreshAll(true);
        showToast(`تم التحديث بنجاح: ${statusMeta.label}`);
        return true;
    };

    window.editWithdrawal = (encodedEmail, encodedTxId) => {
        if (!guardAdmin()) return;
        const email = decodeValue(encodedEmail);
        const txId = decodeValue(encodedTxId);
        const transaction = authApi.getTransaction(email, txId);
        if (!transaction) return;
        openModal('تعديل بيانات عملية السحب', `
            <div class="form-group"><label>المبلغ</label><input class="form-control" id="edit-tx-amount" type="number" value="${escapeHtml(transaction.amount)}"></div>
            <div class="form-group"><label>الوسيلة</label><input class="form-control" id="edit-tx-method" type="text" value="${escapeHtml(transaction.method || '')}"></div>
            <div class="form-group"><label>الجهة</label><input class="form-control" id="edit-tx-channel" type="text" value="${escapeHtml(transaction.channelName || '')}"></div>
            <div class="form-group"><label>التفاصيل</label><input class="form-control" id="edit-tx-details" type="text" value="${escapeHtml(transaction.details || '')}"></div>
            <div class="form-group"><label>الملاحظات</label><textarea class="form-control" id="edit-tx-notes" rows="4">${escapeHtml(transaction.notes || '')}</textarea></div>
        `, async () => {
            authApi.updateTransaction(email, txId, {
                amount: Number(document.getElementById('edit-tx-amount')?.value || transaction.amount),
                method: document.getElementById('edit-tx-method')?.value.trim() || transaction.method,
                channelName: document.getElementById('edit-tx-channel')?.value.trim() || transaction.channelName,
                details: document.getElementById('edit-tx-details')?.value.trim() || transaction.details,
                notes: document.getElementById('edit-tx-notes')?.value.trim() || transaction.notes
            });
            await syncAll();
        });
    };

    window.removeWithdrawal = async (encodedEmail, encodedTxId) => {
        if (!guardAdmin()) return;
        const email = decodeValue(encodedEmail);
        const txId = decodeValue(encodedTxId);
        if (!window.confirm(`حذف عملية السحب ${txId}؟`)) return;
        authApi.deleteTransaction(email, txId);
        await syncAll();
        await refreshAll(true);
        showToast('تم حذف عملية السحب بنجاح.');
    };

    window.showAddUserModal = () => {
        if (!guardAdmin()) return;
        openModal('إضافة مستخدم جديد متكامل', `
            <div class="admin-edit-grid">
                <div class="admin-field"><label>البريد الإلكتروني</label><input class="form-control" id="add-user-email" type="email" placeholder="example@qarya.edu"></div>
                <div class="admin-field"><label>الاسم الكامل</label><input class="form-control" id="add-user-name" type="text"></div>
                <div class="admin-field"><label>كلمة مرور الدخول</label><input class="form-control" id="add-user-password" type="text" value="123456"></div>
                <div class="admin-field"><label>كلمة مرور السحب</label><input class="form-control" id="add-user-withdraw" type="text" value="SPEED"></div>
                <div class="admin-field"><label>الدور</label><input class="form-control" id="add-user-role" type="text" value="طالب المنصة"></div>
                <div class="admin-field"><label>كود القائد</label><input class="form-control" id="add-user-leader" type="text"></div>
                <div class="admin-field"><label>المحافظة</label><input class="form-control" id="add-user-gov" type="text" value="بني سويف"></div>
                <div class="admin-field"><label>المركز</label><input class="form-control" id="add-user-city" type="text"></div>
                <div class="admin-field"><label>القرية</label><input class="form-control" id="add-user-village" type="text"></div>
                <div class="admin-field"><label>الرصيد الابتدائي</label><input class="form-control" id="add-user-balance" type="number" value="0"></div>
                <div class="admin-field-full">
                    <div class="exam-toggle-row">
                        <span>تفعيل دخول الامتحانات فوراً</span>
                        <label class="switch"><input type="checkbox" id="add-user-exam" checked><span class="slider"></span></label>
                    </div>
                </div>
            </div>
        `, async () => {
            const email = document.getElementById('add-user-email')?.value.trim();
            const name = document.getElementById('add-user-name')?.value.trim();
            
            const result = authApi.addUser({
                name: name,
                email: email,
                password: document.getElementById('add-user-password')?.value.trim() || '123456',
                withdrawalPassword: document.getElementById('add-user-withdraw')?.value.trim() || 'SPEED',
                role: document.getElementById('add-user-role')?.value.trim() || 'طالب المنصة',
                leaderCode: document.getElementById('add-user-leader')?.value.trim() || '',
                governorate: document.getElementById('add-user-gov')?.value.trim() || 'بني سويف',
                city: document.getElementById('add-user-city')?.value.trim() || '',
                village: document.getElementById('add-user-village')?.value.trim() || '',
                balance: Number(document.getElementById('add-user-balance')?.value || 0),
                examAllowed: document.getElementById('add-user-exam')?.checked !== false
            });
            if (!result.ok) {
                showToast(result.message);
                return false;
            }
            await syncAll();
            return true;
        }, 'إضافة المستخدم والحفظ في القاعدة');

        // ملء الاسم تلقائياً عند كتابة الإيميل
        const emailInput = document.getElementById('add-user-email');
        const nameInput = document.getElementById('add-user-name');
        if (emailInput && nameInput) {
            emailInput.addEventListener('input', () => {
                if (!nameInput.value || nameInput.value === (emailInput.dataset.lastPrefix || '')) {
                    const prefix = emailInput.value.split('@')[0];
                    nameInput.value = prefix;
                    emailInput.dataset.lastPrefix = prefix;
                }
            });
        }
    };

    window.editUser = (encodedEmail) => {
        if (!guardAdmin()) return;
        const email = decodeValue(encodedEmail);
        const user = authApi.getUserByEmail(email);
        if (!user) return;
        const currentManagementRole = authApi.getManagementRole(user);
        openModal('تعديل بيانات وصلاحيات المستخدم', `
            <div class="form-group"><label>الاسم</label><input class="form-control" id="edit-user-name" type="text" value="${escapeHtml(user.name || '')}"></div>
            <div class="form-group"><label>البريد الإلكتروني</label><input class="form-control" id="edit-user-email" type="email" value="${escapeHtml(user.email || '')}" disabled></div>
            <div class="form-group"><label>كلمة مرور الدخول</label><input class="form-control" id="edit-user-password" type="text" value="${escapeHtml(user.password || '')}"></div>
            <div class="form-group">
                <label style="color: #2563eb; font-weight: bold;">نوع الحساب (الصلاحيات الثابتة)</label>
                <select class="form-control" id="edit-user-management-role" style="border: 2px solid #2563eb;">
                    <option value="user" ${currentManagementRole === 'user' ? 'selected' : ''}>مستخدم عادي</option>
                    <option value="leader" ${currentManagementRole === 'leader' ? 'selected' : ''}>قائد طلاب</option>
                    <option value="operations_admin" ${currentManagementRole === 'operations_admin' ? 'selected' : ''}>ادمن تشغيل</option>
                    <option value="super_admin" ${currentManagementRole === 'super_admin' ? 'selected' : ''}>مدير عام</option>
                </select>
            </div>
            <div class="form-group"><label>المسمى الوظيفي (يظهر تحت الاسم)</label><input class="form-control" id="edit-user-role" type="text" value="${escapeHtml(user.role || '')}" placeholder="مثلاً: طالب المنصة، قائد، مدير"></div>
            <div class="form-group"><label>كود القائد (إذا كان قائداً)</label><input class="form-control" id="edit-user-leader" type="text" value="${escapeHtml(user.leaderCode || '')}"></div>
            <div class="form-group"><label>المحافظة</label><input class="form-control" id="edit-user-governorate" type="text" value="${escapeHtml(user.governorate || '')}"></div>
            <div class="form-group">
                <div class="checkbox-group" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; padding: 0.5rem; background: #f8fafc; border-radius: 8px;">
                    <label><input type="checkbox" id="edit-user-exam-allowed" ${user.examAllowed !== false ? 'checked' : ''}> سماح بالامتحان</label>
                    <label><input type="checkbox" id="edit-user-wallet-enabled" ${user.walletEnabled !== false ? 'checked' : ''}> إظهار المحفظة</label>
                    <label><input type="checkbox" id="edit-user-withdrawals-enabled" ${user.withdrawalsEnabled !== false ? 'checked' : ''}> فتح السحب</label>
                    <label><input type="checkbox" id="edit-user-private-notes" ${user.privateNotificationsEnabled !== false ? 'checked' : ''}> إشعارات خاصة</label>
                </div>
            </div>
            <div class="form-group"><label>رسالة قفل السحب</label><textarea class="form-control" id="edit-user-withdrawal-lock-message" rows="3" placeholder="تظهر للمستخدم عند قفل السحب">${escapeHtml(user.withdrawalLockMessage || '')}</textarea></div>
        `, async () => {
            const mRole = document.getElementById('edit-user-management-role').value;
            const nextRoleName = document.getElementById('edit-user-role').value.trim();
            
            const updates = {
                name: document.getElementById('edit-user-name')?.value.trim() || user.name,
                password: document.getElementById('edit-user-password')?.value.trim() || user.password,
                role: nextRoleName || user.role,
                managementRole: mRole,
                isLeader: mRole === 'leader',
                leaderCode: document.getElementById('edit-user-leader')?.value.trim() || user.leaderCode || '',
                governorate: document.getElementById('edit-user-governorate')?.value.trim() || user.governorate || '',
                examAllowed: document.getElementById('edit-user-exam-allowed')?.checked,
                walletEnabled: document.getElementById('edit-user-wallet-enabled')?.checked,
                withdrawalsEnabled: document.getElementById('edit-user-withdrawals-enabled')?.checked,
                withdrawalLockMessage: document.getElementById('edit-user-withdrawal-lock-message')?.value.trim() || '',
                privateNotificationsEnabled: document.getElementById('edit-user-private-notes')?.checked,
                updatedAt: new Date().toISOString()
            };

            const result = authApi.updateUserPersistentData(email, updates);
            
            if (result.ok) {
                // إرسال إشعار عائم للمستخدم فوراً
                await authApi.pushPrivateNotification(email, {
                    title: 'تحديث صلاحيات الحساب',
                    body: `تم تحديث صلاحيات حسابك إلى: ${nextRoleName || mRole}. يرجى ملاحظة التغييرات في لوحة التحكم الخاصة بك.`,
                    type: 'update',
                    displayMode: 'floating', // إشعار عائم
                    sticky: true,
                    actionLabel: 'فهمت'
                });
                
                showToast('تم تحديث البيانات وإرسال إشعار للمستخدم.');
                await syncAll();
                return true;
            } else {
                showToast(result.message);
                return false;
            }
        });
    };

    window.changeUserBalance = (encodedEmail) => {
        if (!guardAdmin()) return;
        const email = decodeValue(encodedEmail);
        const user = authApi.getUserByEmail(email);
        if (!user) return;
        openModal('تعديل رصيد المستخدم', `
            <div class="form-group"><label>الرصيد الحالي</label><input class="form-control" type="text" value="${escapeHtml(formatMoney(user.balance))}" disabled></div>
            <div class="form-group"><label>الرصيد الجديد</label><input class="form-control" id="edit-user-balance" type="number" value="${escapeHtml(user.balance)}"></div>
        `, async () => {
            const nextBalance = Number(document.getElementById('edit-user-balance')?.value || user.balance || 0);
            const result = authApi.updateUserPersistentData(email, { balance: nextBalance });
            if (result?.ok === false) {
                showToast(result.message || 'تعذر تحديث رصيد المستخدم.');
                return false;
            }
            await authApi.refreshFromRemote?.({ force: true });
            await notifyUserAccountChange(email, {
                title: 'تحديث رصيد الحساب',
                body: `تم تحديث رصيد حسابك إلى ${formatMoney(nextBalance)} من الإدارة.`
            });
            await syncAll();
            await authApi.refreshFromRemote?.({ force: true });
            await refreshAll(true);
        });
    };

    window.toggleUserStatus = async (encodedEmail) => {
        if (!guardAdmin()) return;
        const email = decodeValue(encodedEmail);
        const user = authApi.getUserByEmail(email);
        if (!user) return;
        const nextSuspended = !user.isSuspended;
        authApi.updateUserPersistentData(email, { isSuspended: nextSuspended });
        await notifyUserAccountChange(email, {
            title: nextSuspended ? 'إيقاف الحساب' : 'تنشيط الحساب',
            body: nextSuspended
                ? 'تم إيقاف حسابك مؤقتًا من الإدارة. إذا كنت تحتاج مراجعة الحالة تابع الإشعارات.'
                : 'تمت إعادة تنشيط حسابك ويمكنك متابعة استخدام المنصة الآن.'
        });
        await syncAll();
        await refreshAll(true);
        showToast(`تم ${nextSuspended ? 'إيقاف' : 'تنشيط'} حساب المستخدم بنجاح.`);
    };

    window.toggleUserExam = async (encodedEmail) => {
        if (!guardAdmin()) return;
        const email = decodeValue(encodedEmail);
        const user = authApi.getUserByEmail(email);
        if (!user) return;
        const nextExamAllowed = user.examAllowed === false;
        authApi.updateUserPersistentData(email, { examAllowed: nextExamAllowed });
        await notifyUserAccountChange(email, {
            title: nextExamAllowed ? 'السماح بالامتحان' : 'منع الامتحان',
            body: nextExamAllowed
                ? 'تم السماح لك بدخول الامتحان من الإدارة.'
                : 'تم إيقاف صلاحية دخول الامتحان على حسابك من الإدارة.'
        });
        await syncAll();
        await refreshAll(true);
        showToast(`تم ${nextExamAllowed ? 'السماح بدخول' : 'منع'} الامتحان للمستخدم بنجاح.`);
    };

    window.removeUser = async (encodedEmail) => {
        if (!guardAdmin()) return;
        const email = decodeValue(encodedEmail);
        if (!window.confirm(`حذف حساب المستخدم ${email} نهائيًا؟`)) return;
        authApi.deleteUserAccount(email);
        await syncAll();
        await refreshAll(true);
        showToast('تم حذف حساب المستخدم بنجاح.');
    };

    window.clearAllUsers = async () => {
        if (!guardAdmin()) return;
        if (!window.confirm('⚠️ تحذير نهائي: سيتم تصفير كافة بيانات المستخدمين والبدء من جديد (باستثناء الإدارة)! هل تريد الاستمرار؟')) return;
        
        const allUsers = authApi.getAllUsersRaw();
        const nextUsers = allUsers.filter(u => authApi.isAdminSession(u.email));
        
        if (window.QaryaFirebase) {
            const { db, ref, set } = window.QaryaFirebase;
            try {
                // 1. مسح عقدة المستخدمين بالكامل
                await set(ref(db, 'users'), null);
                // 2. مسح الحالة المسجلة للمنصة (الطلبات، الامتحانات، الإشعارات)
                await set(ref(db, 'state/platform'), null);
                await set(ref(db, 'applications'), null);
                await set(ref(db, 'notifications'), null);
                
                // 3. إعادة رفع الأدمن فقط
                const updates = {};
                nextUsers.forEach(u => {
                    const safeEmail = authApi.normalizeEmail(u.email).replace(/\./g, '_');
                    updates[`users/${safeEmail}`] = u;
                });
                if (Object.keys(updates).length > 0) {
                    const { update } = window.QaryaFirebase;
                    await update(ref(db), updates);
                }
                
                // 4. تهيئة إعدادات المنصة الافتراضية
                await set(ref(db, 'state/platform/settings'), {
                    examMode: 'default',
                    examModeMessage: 'تم تصفير المنصة وبدء دورة جديدة.',
                    updatedAt: new Date().toISOString()
                });

                console.log("Firebase Database Fully Reset & Bootstrapped");
            } catch (e) {
                console.error("Firebase Reset Error:", e);
            }
        }
        
        authApi.writeUsers(nextUsers);
        store.saveStoredApplications([]);
        store.saveExamHistory([]);
        store.saveNotifications([]);
        
        await syncAll();
        await refreshAll(true);
        showToast('تم تصفير قاعدة البيانات وإعادة تهيئة المنصة بنجاح.');
    };

    window.clearAllWithdrawals = async () => {
        if (!guardAdmin()) return;
        if (!window.confirm('⚠️ تحذير: سيتم مسح كافة سجلات عمليات السحب نهائيًا! هل تريد الاستمرار؟')) return;
        
        if (window.QaryaFirebase) {
            const { db, ref, set } = window.QaryaFirebase;
            try {
                await set(ref(db, 'transactions'), null);
            } catch (e) {
                console.error("Firebase Clear Transactions Error:", e);
            }
        }
        
        authApi.writeTransactions([]);
        await syncAll();
        await refreshAll(true);
        showToast('تم مسح سجل العمليات بنجاح.');
    };

    window.sendUserNotification = (encodedEmail) => {
        if (!guardAdmin()) return;
        const email = decodeValue(encodedEmail);
        const user = authApi.getUserByEmail(email);
        if (!user) return;
        openModal('نشر إشعار مرتبط بمستخدم', `
            <div class="form-group"><label>العنوان</label><input class="form-control" id="user-note-title" type="text" value="تنبيه إداري للمستخدم"></div>
            <div class="form-group"><label>النص</label><textarea class="form-control" id="user-note-body" rows="4">تم تحديث حالة الحساب الخاص بك من الإدارة.</textarea></div>
            <div class="form-group"><label>النوع</label><select class="form-control" id="user-note-type"><option value="update">تحديث</option><option value="support">دعم</option><option value="finance">ماليات</option><option value="exam">امتحانات</option></select></div>
            <div class="form-group"><label>نمط العرض</label><select class="form-control" id="user-note-display"><option value="feed">داخل القائمة</option><option value="floating">عائم</option><option value="banner">شريط ثابت</option></select></div>
            <div class="form-group"><label>نوع الإشعار</label><select class="form-control" id="user-note-sticky"><option value="false">عادي</option><option value="true">ثابت</option></select></div>
            <div class="form-group"><label>وقت البداية</label><input class="form-control" id="user-note-start" type="datetime-local"></div>
            <div class="form-group"><label>وقت النهاية</label><input class="form-control" id="user-note-end" type="datetime-local"></div>
        `, async () => {
            await publishPrivateNotification(email, {
                title: document.getElementById('user-note-title')?.value.trim() || 'تنبيه إداري للمستخدم',
                body: document.getElementById('user-note-body')?.value.trim() || `تم تحديث حالة الحساب الخاص بك من الإدارة. المستخدم: ${user.name || user.email}`,
                type: document.getElementById('user-note-type')?.value || 'update',
                displayMode: document.getElementById('user-note-display')?.value || 'feed',
                sticky: document.getElementById('user-note-sticky')?.value === 'true',
                startAt: normalizeDateTimeInput(document.getElementById('user-note-start')?.value),
                endAt: normalizeDateTimeInput(document.getElementById('user-note-end')?.value),
                actionUrl: './notifications.html',
                actionLabel: 'فتح الإشعارات'
            });
            await syncAll();
        }, 'نشر الإشعار');
    };

    async function applyExamSettings(nextSettings) {
        store.updatePlatformSettings(nextSettings);
        await syncAll();
        await refreshAll(true);
    }

    window.toggleMaintenanceMode = () => {
        if (!guardAdmin()) return;
        const settings = store.getPlatformSettings();
        const isActive = Boolean(settings.maintenanceMode);
        openModal(isActive ? 'إيقاف وضع الصيانة' : 'تفعيل وضع الصيانة', `
            <div class="form-group">
                <label>رسالة الصيانة</label>
                <textarea class="form-control" id="maintenance-message" rows="4">${escapeHtml(settings.maintenanceMessage || 'جاري الآن صيانة الموقع. يرجى المحاولة لاحقًا.')}</textarea>
            </div>
            <div class="form-group">
                <label>الحالة الجديدة</label>
                <input class="form-control" type="text" value="${isActive ? 'سيتم إيقاف وضع الصيانة وعودة المنصة للعمل.' : 'سيتم تفعيل وضع الصيانة ومنع الدخول لغير المدراء فقط.'}" disabled>
            </div>
        `, async () => {
            const message = document.getElementById('maintenance-message')?.value.trim() || 'جاري الآن صيانة الموقع. يرجى المحاولة لاحقًا.';
            await applyExamSettings({
                maintenanceMode: !isActive,
                maintenanceMessage: message
            });
        }, isActive ? 'إيقاف الصيانة' : 'تفعيل الصيانة');
    };

    window.replySupportThread = (encodedEmail) => {
        if (!guardAdmin()) return;
        const email = decodeValue(encodedEmail);
        const thread = store.getSupportThreadByEmail?.(email);
        if (!thread) return;

        openModal(`الرد على ${thread.userName || thread.email}`, `
            <div class="form-group"><label>المستخدم</label><input class="form-control" type="text" value="${escapeHtml(thread.userName || thread.email)}" disabled></div>
            <div class="form-group"><label>نص الرد</label><textarea class="form-control" id="support-reply-text" rows="5" placeholder="اكتب رد الدعم هنا"></textarea></div>
        `, async () => {
            const text = document.getElementById('support-reply-text')?.value.trim();
            if (!text) {
                showToast('اكتب الرد أولًا.');
                return false;
            }

            store.sendSupportMessage({
                email,
                userName: thread.userName,
                role: thread.role,
                sender: 'admin',
                senderName: session.name,
                text
            }, { silent: true });
            store.markSupportThreadRead?.(email, 'admin', { silent: true });
            store.updateSupportThreadStatus?.(email, 'open', { silent: true });

            try {
                await publishPrivateNotification(email, {
                    title: 'رد جديد من الدعم الإداري',
                    body: text,
                    type: 'support',
                    actionUrl: './notifications.html',
                    actionLabel: 'فتح الإشعارات'
                });
            } catch (error) {
                console.error('Support reply notification failed:', error);
            }

            await syncAll();
            return true;
        }, 'إرسال الرد');
    };

    window.toggleSupportThreadStatus = async (encodedEmail, nextStatus) => {
        if (!guardAdmin()) return;
        const email = decodeValue(encodedEmail);
        const thread = store.getSupportThreadByEmail?.(email);
        if (!thread) return;
        store.updateSupportThreadStatus?.(email, nextStatus);
        store.markSupportThreadRead?.(email, 'admin', { silent: true });
        await syncAll();
        await refreshAll(true);
        showToast(nextStatus === 'closed' ? 'تم إغلاق المحادثة بنجاح.' : 'تمت إعادة فتح المحادثة بنجاح.');
    };

    window.removeSupportThread = async (encodedEmail) => {
        if (!guardAdmin()) return;
        const email = decodeValue(encodedEmail);
        if (!window.confirm(`حذف محادثة ${email} نهائياً من سجلات الإدارة والمستخدم؟`)) return;
        
        store.deleteSupportThread?.(email);
        await syncAll();
        await refreshAll(true);
        showToast('تم حذف المحادثة بنجاح.');
    };

    window.markSupportMessagesRead = async (encodedEmail) => {
        if (!guardAdmin()) return;
        const email = decodeValue(encodedEmail);
        store.markSupportThreadRead?.(email, 'admin');
        await syncAll();
        await refreshAll(true);
        showToast('تم تحديد الرسائل كمقروءة.');
    };

    window.setExamMode = async (mode) => {
        if (!guardAdmin()) return;
        const settings = store.getPlatformSettings();
        await applyExamSettings({
            examMode: mode,
            examModeMessage: settings.examModeMessage || '',
            manualExamOpenedAt: mode === 'open' ? (settings.manualExamOpenedAt || new Date().toISOString()) : '',
            manualExamEndsAt: mode === 'open' ? settings.manualExamEndsAt || '' : '',
            manualExamDurationMinutes: Number(settings.manualExamDurationMinutes || 60)
        });
        showToast('تم تحديث وضع الامتحان بنجاح.');
    };

    window.openExamWindow = () => {
        if (!guardAdmin()) return;
        const settings = store.getPlatformSettings();
        openModal('فتح الامتحان يدويًا', `
            <div class="admin-edit-grid">
                <div class="admin-field">
                    <label>مدة الفتح بالدقائق</label>
                    <input class="form-control" id="manual-open-duration" type="number" min="5" max="240" value="${escapeHtml(String(settings.manualExamDurationMinutes || 60))}">
                </div>
                <div class="admin-field admin-field-full">
                    <label>رسالة الفتح</label>
                    <textarea class="form-control" id="manual-open-message" rows="4">${escapeHtml(settings.examModeMessage || 'تم فتح الامتحان الآن بقرار من الإدارة.')}</textarea>
                </div>
            </div>
        `, async () => {
            const duration = Math.max(5, Number(document.getElementById('manual-open-duration')?.value || settings.manualExamDurationMinutes || 60));
            const openedAt = new Date().toISOString();
            const endsAtDate = new Date();
            endsAtDate.setMinutes(endsAtDate.getMinutes() + duration);
            await applyExamSettings({
                examMode: 'open',
                examModeMessage: document.getElementById('manual-open-message')?.value.trim() || 'تم فتح الامتحان الآن بقرار من الإدارة.',
                manualExamOpenedAt: openedAt,
                manualExamEndsAt: endsAtDate.toISOString(),
                manualExamDurationMinutes: duration
            });
        }, 'فتح الامتحان الآن');
    };

    window.closeExamWindow = async () => {
        if (!guardAdmin()) return;
        const settings = store.getPlatformSettings();
        await applyExamSettings({
            examMode: 'closed',
            examModeMessage: settings.examModeMessage || 'الامتحان متوقف حاليًا بقرار من الإدارة.',
            manualExamOpenedAt: '',
            manualExamEndsAt: '',
            manualExamDurationMinutes: Number(settings.manualExamDurationMinutes || 60)
        });
        showToast('تم إغلاق بوابة الامتحان بنجاح.');
    };

    window.restoreExamSchedule = async () => {
        if (!guardAdmin()) return;
        const settings = store.getPlatformSettings();
        await applyExamSettings({
            examMode: 'default',
            examModeMessage: settings.examModeMessage || '',
            manualExamOpenedAt: '',
            manualExamEndsAt: '',
            manualExamDurationMinutes: Number(settings.manualExamDurationMinutes || 60)
        });
        showToast('تمت العودة للجدول الرسمي للامتحان بنجاح.');
    };

    window.editExamMessage = () => {
        if (!guardAdmin()) return;
        const settings = store.getPlatformSettings();
        openModal('تعديل رسالة وضع الامتحان', `
            <div class="form-group"><label>الرسالة الحالية</label><textarea class="form-control" id="exam-mode-message" rows="5">${escapeHtml(settings.examModeMessage || '')}</textarea></div>
        `, async () => {
            await applyExamSettings({
                examMode: settings.examMode,
                examModeMessage: document.getElementById('exam-mode-message')?.value.trim() || '',
                manualExamOpenedAt: settings.manualExamOpenedAt || '',
                manualExamEndsAt: settings.manualExamEndsAt || '',
                manualExamDurationMinutes: Number(settings.manualExamDurationMinutes || 60)
            });
        });
    };

    window.manualExamReset = () => {
        if (!guardAdmin()) return;
        openModal('تصفير محاولات طالب', `
            <div class="form-group"><label>رقم الطلب</label><input class="form-control" id="manual-reset-request-id" type="text" placeholder="أدخل رقم الطلب"></div>
        `, async () => {
            const requestId = document.getElementById('manual-reset-request-id')?.value.trim();
            if (!requestId) {
                showToast('أدخل رقم الطلب أولًا.');
                return false;
            }
            store.clearExamAttempts(requestId);
            await syncAll();
            return true;
        }, 'تصفير المحاولات');
    };

    window.createPlatformNotification = () => {
        if (!guardAdmin()) return;
        openModal('إنشاء إشعار جديد', `
            <div class="form-group"><label>العنوان</label><input class="form-control" id="note-title" type="text"></div>
            <div class="form-group"><label>النص</label><textarea class="form-control" id="note-body" rows="4"></textarea></div>
            <div class="form-group"><label>النوع</label><select class="form-control" id="note-type"><option value="update">تحديث</option><option value="application">طلبات</option><option value="exam">امتحانات</option><option value="finance">ماليات</option><option value="support">دعم</option></select></div>
            <div class="form-group"><label>نمط العرض</label><select class="form-control" id="note-display"><option value="feed">داخل القائمة</option><option value="floating">عائم</option><option value="banner">شريط ثابت</option></select></div>
            <div class="form-group"><label>نوع الإشعار</label><select class="form-control" id="note-sticky"><option value="false">عادي</option><option value="true">ثابت</option></select></div>
            <div class="form-group"><label>وقت البداية</label><input class="form-control" id="note-start" type="datetime-local"></div>
            <div class="form-group"><label>وقت النهاية</label><input class="form-control" id="note-end" type="datetime-local"></div>
            <div class="form-group"><label>الرابط</label><input class="form-control" id="note-url" type="text" placeholder="./notifications.html"></div>
            <div class="form-group"><label>نص الزر</label><input class="form-control" id="note-label" type="text" placeholder="فتح التفاصيل"></div>
        `, async () => {
            await publishGlobalNotification({
                title: document.getElementById('note-title')?.value.trim() || 'إشعار جديد',
                body: document.getElementById('note-body')?.value.trim() || '',
                type: document.getElementById('note-type')?.value || 'update',
                displayMode: document.getElementById('note-display')?.value || 'feed',
                sticky: document.getElementById('note-sticky')?.value === 'true',
                startAt: normalizeDateTimeInput(document.getElementById('note-start')?.value),
                endAt: normalizeDateTimeInput(document.getElementById('note-end')?.value),
                actionUrl: document.getElementById('note-url')?.value.trim() || '',
                actionLabel: document.getElementById('note-label')?.value.trim() || ''
            });
            await syncAll();
        }, 'نشر الإشعار');
    };

    window.editPlatformNotification = (encodedKey) => {
        if (!guardAdmin()) return;
        const sourceKey = decodeValue(encodedKey);
        const note = getNotificationRecord(sourceKey);
        if (!note) return;

        openModal('تعديل الإشعار', `
            <div class="form-group"><label>العنوان</label><input class="form-control" id="edit-note-title" type="text" value="${escapeHtml(note.title || '')}"></div>
            <div class="form-group"><label>النص</label><textarea class="form-control" id="edit-note-body" rows="4">${escapeHtml(note.body || '')}</textarea></div>
            <div class="form-group"><label>النوع</label><select class="form-control" id="edit-note-type"><option value="update"${note.type === 'update' ? ' selected' : ''}>تحديث</option><option value="application"${note.type === 'application' ? ' selected' : ''}>طلبات</option><option value="exam"${note.type === 'exam' ? ' selected' : ''}>امتحانات</option><option value="finance"${note.type === 'finance' ? ' selected' : ''}>ماليات</option><option value="support"${note.type === 'support' ? ' selected' : ''}>دعم</option></select></div>
            <div class="form-group"><label>نمط العرض</label><select class="form-control" id="edit-note-display"><option value="feed"${(note.displayMode || 'feed') === 'feed' ? ' selected' : ''}>داخل القائمة</option><option value="floating"${note.displayMode === 'floating' ? ' selected' : ''}>عائم</option><option value="banner"${note.displayMode === 'banner' ? ' selected' : ''}>شريط ثابت</option></select></div>
            <div class="form-group"><label>نوع الإشعار</label><select class="form-control" id="edit-note-sticky"><option value="false"${!note.sticky ? ' selected' : ''}>عادي</option><option value="true"${note.sticky ? ' selected' : ''}>ثابت</option></select></div>
            <div class="form-group"><label>وقت البداية</label><input class="form-control" id="edit-note-start" type="datetime-local" value="${escapeHtml(getDateTimeLocalValue(note.startAt))}"></div>
            <div class="form-group"><label>وقت النهاية</label><input class="form-control" id="edit-note-end" type="datetime-local" value="${escapeHtml(getDateTimeLocalValue(note.endAt))}"></div>
            ${note.audience === 'private' ? `<div class="form-group"><label>المستلم</label><input class="form-control" type="text" value="${escapeHtml(note.recipientName || note.recipientEmail || '')}" disabled></div>` : ''}
            <div class="form-group"><label>الرابط</label><input class="form-control" id="edit-note-url" type="text" value="${escapeHtml(note.actionUrl || '')}"></div>
            <div class="form-group"><label>نص الزر</label><input class="form-control" id="edit-note-label" type="text" value="${escapeHtml(note.actionLabel || '')}"></div>
        `, async () => {
            const payload = {
                title: document.getElementById('edit-note-title')?.value.trim() || note.title,
                body: document.getElementById('edit-note-body')?.value.trim() || note.body,
                type: document.getElementById('edit-note-type')?.value || note.type,
                displayMode: document.getElementById('edit-note-display')?.value || note.displayMode || 'feed',
                sticky: document.getElementById('edit-note-sticky')?.value === 'true',
                startAt: normalizeDateTimeInput(document.getElementById('edit-note-start')?.value),
                endAt: normalizeDateTimeInput(document.getElementById('edit-note-end')?.value),
                actionUrl: document.getElementById('edit-note-url')?.value.trim() || '',
                actionLabel: document.getElementById('edit-note-label')?.value.trim() || ''
            };

            if (note.audience === 'private') {
                authApi.updatePrivateNotification(note.recipientEmail, note.id, payload);
                await syncPrivateNotificationFirebase(note.recipientEmail, {
                    ...note,
                    ...payload,
                    id: note.id,
                    updatedAt: new Date().toISOString()
                });
            } else {
                store.updateNotification(note.id, payload);
            }

            await syncAll();
        });
    };

    window.removePlatformNotification = async (encodedKey) => {
        if (!guardAdmin()) return;
        const sourceKey = decodeValue(encodedKey);
        const note = getNotificationRecord(sourceKey);
        if (!note) return;
        if (!window.confirm('حذف هذا الإشعار؟')) return;

        if (note.audience === 'private') {
            authApi.deletePrivateNotification(note.recipientEmail, note.id);
            await deletePrivateNotificationFirebase(note.recipientEmail, note.id);
        } else {
            store.deleteNotification(note.id);
        }

        await syncAll();
        await refreshAll(true);
    };

    window.deleteAllNotifications = async () => {
        if (!guardAdmin()) return;
        const all = getNotificationsDataset().all;
        if (all.length === 0) {
            showToast('لا توجد تنبيهات لحذفها.');
            return;
        }
        if (!window.confirm(`هل أنت متأكد من حذف جميع التنبيهات (${all.length} تنبيه)؟ لا يمكن التراجع عن هذه الخطوة.`)) return;
        
        for (const note of all) {
            if (note.audience === 'private') {
                authApi.deletePrivateNotification(note.recipientEmail, note.id);
                await deletePrivateNotificationFirebase(note.recipientEmail, note.id);
            } else {
                store.deleteNotification(note.id);
            }
        }

        await syncAll();
        await refreshAll(true);
        showToast('تم حذف كافة التنبيهات بنجاح.');
    };

    renderUsers = function renderUsersPatched() {
        if (!allUsersListEl) return;
        if (!isAdmin) {
            allUsersListEl.innerHTML = '<div class="admin-card"><h4>هذه المساحة متاحة للإدارة فقط.</h4></div>';
            return;
        }

        const users = authApi.getAllUsers();
        const summaryHtml = renderSummaryRow([
            { label: 'كل المستخدمين', value: users.length },
            { label: 'نشط', value: users.filter((user) => !user.isSuspended).length },
            { label: 'موقوف', value: users.filter((user) => user.isSuspended).length },
            { label: 'ممنوع امتحان', value: users.filter((user) => user.examAllowed === false).length },
            { label: 'السحب مغلق', value: users.filter((user) => user.withdrawalsEnabled === false).length }
        ]);

        allUsersListEl.innerHTML = `${summaryHtml}${users.map((user) => `
            <div class="admin-card" style="opacity:${user.isSuspended ? 0.7 : 1};">
                <div class="card-header">
                    <div class="user-info">
                        <h4>${escapeHtml(user.name || 'مستخدم بدون اسم')}</h4>
                        <span>${escapeHtml(user.email)}</span>
                    </div>
                    <span class="status-pill ${user.isSuspended ? 'pill-suspended' : 'pill-active'}">${user.isSuspended ? 'موقوف' : 'نشط'}</span>
                </div>
                <div class="card-body">
                    <p><span>الدور</span><strong>${escapeHtml(user.role || '--')}</strong></p>
                    <p><span>الرصيد</span><strong>${escapeHtml(formatMoney(user.balance))}</strong></p>
                    <p><span>كود القائد</span><strong>${escapeHtml(user.leaderCode || '--')}</strong></p>
                    <p><span>صلاحية الامتحان</span><strong>${user.examAllowed === false ? 'موقوفة' : 'مسموحة'}</strong></p>
                    <p><span>صلاحية السحب</span><strong>${user.withdrawalsEnabled === false ? 'مغلقة' : 'مفتوحة'}</strong></p>
                    ${user.withdrawalLockMessage ? `<p style="display:block; margin-top:0.75rem;"><span>رسالة قفل السحب</span><strong style="display:block; margin-top:0.35rem;">${escapeHtml(user.withdrawalLockMessage)}</strong></p>` : ''}
                    <p><span>آخر دخول</span><strong>${escapeHtml(formatDate(user.lastLoginAt))}</strong></p>
                </div>
                <div class="card-actions">
                    <button class="btn-action" onclick="editUser('${encodeValue(user.email)}')"><i class="fas fa-user-pen"></i> تعديل</button>
                    <button class="btn-action" onclick="changeUserBalance('${encodeValue(user.email)}')"><i class="fas fa-coins"></i> رصيد</button>
                    <button class="btn-action ${user.isSuspended ? 'success' : 'danger'}" onclick="toggleUserStatus('${encodeValue(user.email)}')"><i class="fas ${user.isSuspended ? 'fa-play' : 'fa-pause'}"></i> ${user.isSuspended ? 'تنشيط' : 'إيقاف'}</button>
                    <button class="btn-action ${user.examAllowed === false ? 'success' : 'danger'}" onclick="toggleUserExam('${encodeValue(user.email)}')"><i class="fas ${user.examAllowed === false ? 'fa-unlock' : 'fa-lock'}"></i> ${user.examAllowed === false ? 'سماح امتحان' : 'منع امتحان'}</button>
                    <button class="btn-action ${user.withdrawalsEnabled === false ? 'success' : 'danger'}" onclick="toggleUserWithdrawal('${encodeValue(user.email)}')"><i class="fas ${user.withdrawalsEnabled === false ? 'fa-wallet' : 'fa-ban'}"></i> ${user.withdrawalsEnabled === false ? 'فتح السحب' : 'قفل السحب'}</button>
                    ${isSuperAdminSession() ? `<button class="btn-action" data-pro-action="permissions-${escapeHtml(user.email)}" onclick="editUserPermissions('${encodeValue(user.email)}')"><i class="fas fa-shield-halved"></i> صلاحيات</button>` : ''}
                    <button class="btn-action" onclick="sendUserNotification('${encodeValue(user.email)}')"><i class="fas fa-bell"></i> إشعار</button>
                    <button class="btn-action danger" onclick="removeUser('${encodeValue(user.email)}')"><i class="fas fa-trash"></i> حذف</button>
                </div>
            </div>
        `).join('')}`;
    };

    window.toggleUserWithdrawal = async (encodedEmail) => {
        if (!guardAdmin()) return;
        const email = decodeValue(encodedEmail);
        const user = authApi.getUserByEmail(email);
        if (!user) return;
        const nextWithdrawalState = user.withdrawalsEnabled === false;
        const defaultLockMessage = user.withdrawalLockMessage || 'تم إيقاف خدمة السحب على حسابك مؤقتًا بقرار من الإدارة.';

        if (!nextWithdrawalState) {
            openModal('قفل السحب وكتابة رسالة للمستخدم', `
                <div class="form-group"><label>المستخدم</label><input class="form-control" type="text" value="${escapeHtml(user.name || user.email)}" disabled></div>
                <div class="form-group"><label>رسالة تظهر للمستخدم داخل صفحة السحب</label><textarea class="form-control" id="withdrawal-lock-message" rows="5">${escapeHtml(defaultLockMessage)}</textarea></div>
            `, async () => {
                const lockMessage = document.getElementById('withdrawal-lock-message')?.value.trim() || defaultLockMessage;
                authApi.updateUserPersistentData(email, {
                    withdrawalsEnabled: false,
                    withdrawalLockMessage: lockMessage
                });
                await notifyUserAccountChange(email, {
                    title: 'إغلاق السحب على الحساب',
                    body: lockMessage
                });
                await syncAll();
                await refreshAll(true);
            }, 'قفل السحب وإرسال الرسالة');
            return;
        }

        authApi.updateUserPersistentData(email, {
            withdrawalsEnabled: true,
            withdrawalLockMessage: ''
        });
        await notifyUserAccountChange(email, {
            title: 'فتح السحب على الحساب',
            body: 'تم فتح خدمة السحب على حسابك من الإدارة.'
        });
        await syncAll();
        await refreshAll(true);
    };

    window.setWithdrawalStatus = async (encodedEmail, encodedTxId, status, adminMessage = '') => {
        if (!guardAdmin()) return false;

        const email = decodeValue(encodedEmail);
        const txId = decodeValue(encodedTxId);

        await authApi.refreshFromRemote?.({ force: true });

        const transaction = authApi.getTransaction(email, txId);
        const user = authApi.getUserByEmail(email);
        if (!transaction || !user) {
            showToast('تعذر العثور على عملية السحب أو المستخدم.');
            return false;
        }

        const statusMeta = getWithdrawalStatusMeta(status);
        const amount = Number(transaction.amount || 0);
        const currentBalance = Number(user.balance || 0);
        const currentStatus = String(transaction.status || 'pending').trim();
        const alreadyDebited = Boolean(transaction.debitedAt);
        const now = new Date().toISOString();
        const nextMessage = String(adminMessage || transaction.adminMessage || statusMeta.defaultMessage).trim();

        let nextBalance = currentBalance;
        let debitedAt = String(transaction.debitedAt || '');
        let resolvedAt = String(transaction.resolvedAt || '');
        let shouldUpdateBalance = false;

        if (status === 'completed') {
            if (alreadyDebited) {
                resolvedAt = resolvedAt || now;
            } else {
                if (amount > currentBalance) {
                    showToast('لا يمكن تنفيذ العملية لأن الرصيد الحالي للمستخدم أقل من مبلغ السحب.');
                    return false;
                }
                nextBalance = currentBalance - amount;
                debitedAt = now;
                resolvedAt = now;
                shouldUpdateBalance = true;
            }
        } else if (status === 'pending') {
            if (alreadyDebited) {
                nextBalance = currentBalance + amount;
                shouldUpdateBalance = true;
            }
            debitedAt = '';
            resolvedAt = '';
        } else if (status === 'rejected' || status === 'error') {
            if (alreadyDebited) {
                nextBalance = currentBalance + amount;
                shouldUpdateBalance = true;
            }
            debitedAt = '';
            resolvedAt = now;
        }

        const hasMeaningfulChange = (
            currentStatus !== status
            || String(transaction.adminMessage || '').trim() !== nextMessage
            || String(transaction.debitedAt || '') !== debitedAt
            || String(transaction.resolvedAt || '') !== resolvedAt
            || shouldUpdateBalance
        );

        if (!hasMeaningfulChange) {
            await refreshAll(true);
            return true;
        }

        if (shouldUpdateBalance) {
            const balanceResult = authApi.updateUserPersistentData(email, { balance: nextBalance });
            if (balanceResult?.ok === false) {
                showToast(balanceResult.message || 'تعذر تحديث رصيد المستخدم.');
                return false;
            }
        }

        const transactionResult = authApi.updateTransaction(email, txId, {
            status,
            statusLabel: statusMeta.label,
            adminMessage: nextMessage,
            debitedAt,
            resolvedAt
        });

        if (transactionResult?.ok === false) {
            showToast(transactionResult.message || 'تعذر تحديث حالة عملية السحب.');
            return false;
        }

        try {
            await publishPrivateNotification(email, {
                title: `تحديث عملية السحب ${txId}`,
                body: `${statusMeta.label} - ${nextMessage}`,
                type: 'finance',
                actionUrl: './wallet.html',
                actionLabel: 'فتح السحب'
            });
        } catch (error) {
            console.error('Private withdrawal notification failed:', error);
        }

        store.addNotification({
            title: `تحديث عملية السحب ${txId}`,
            body: `تم تغيير حالة عملية السحب الخاصة بالمستخدم ${user.name || user.email} إلى ${statusMeta.label}.`,
            type: 'finance',
            actionUrl: './wallet.html',
            actionLabel: 'فتح السحب'
        });

        await syncAll();
        await authApi.refreshFromRemote?.({ force: true });
        await refreshAll(true);
        return true;
    };

    window.editWithdrawal = (encodedEmail, encodedTxId) => {
        if (!guardAdmin()) return;
        const email = decodeValue(encodedEmail);
        const txId = decodeValue(encodedTxId);
        const transaction = authApi.getTransaction(email, txId);
        if (!transaction) return;

        openModal('تعديل بيانات عملية السحب', `
            <div class="form-group"><label>المبلغ</label><input class="form-control" id="edit-tx-amount" type="number" value="${escapeHtml(transaction.amount)}"></div>
            <div class="form-group"><label>الوسيلة</label><input class="form-control" id="edit-tx-method" type="text" value="${escapeHtml(transaction.method || '')}"></div>
            <div class="form-group"><label>الجهة</label><input class="form-control" id="edit-tx-channel" type="text" value="${escapeHtml(transaction.channelName || '')}"></div>
            <div class="form-group"><label>التفاصيل</label><input class="form-control" id="edit-tx-details" type="text" value="${escapeHtml(transaction.details || '')}"></div>
            <div class="form-group"><label>الملاحظات</label><textarea class="form-control" id="edit-tx-notes" rows="4">${escapeHtml(transaction.notes || '')}</textarea></div>
            <div class="form-group"><label>رسالة الإدارة</label><textarea class="form-control" id="edit-tx-message" rows="4">${escapeHtml(transaction.adminMessage || '')}</textarea></div>
        `, async () => {
            await authApi.refreshFromRemote?.({ force: true });
            const latestTransaction = authApi.getTransaction(email, txId);
            const user = authApi.getUserByEmail(email);
            if (!latestTransaction || !user) {
                showToast('تعذر العثور على عملية السحب أو المستخدم.');
                return false;
            }

            const nextAmount = Math.max(0, Number(document.getElementById('edit-tx-amount')?.value || latestTransaction.amount || 0));
            const amountDelta = nextAmount - Number(latestTransaction.amount || 0);

            if (latestTransaction.status === 'completed' && amountDelta !== 0) {
                const adjustedBalance = Number(user.balance || 0) - amountDelta;
                if (adjustedBalance < 0) {
                    showToast('لا يمكن زيادة مبلغ العملية لأن رصيد المستخدم الحالي لا يكفي.');
                    return false;
                }

                const balanceResult = authApi.updateUserPersistentData(email, { balance: adjustedBalance });
                if (balanceResult?.ok === false) {
                    showToast(balanceResult.message || 'تعذر تحديث رصيد المستخدم.');
                    return false;
                }
            }

            const updateResult = authApi.updateTransaction(email, txId, {
                amount: nextAmount,
                method: document.getElementById('edit-tx-method')?.value.trim() || latestTransaction.method,
                channelName: document.getElementById('edit-tx-channel')?.value.trim() || latestTransaction.channelName,
                details: document.getElementById('edit-tx-details')?.value.trim() || latestTransaction.details,
                notes: document.getElementById('edit-tx-notes')?.value.trim() || latestTransaction.notes,
                adminMessage: document.getElementById('edit-tx-message')?.value.trim() || latestTransaction.adminMessage
            });

            if (updateResult?.ok === false) {
                showToast(updateResult.message || 'تعذر تعديل عملية السحب.');
                return false;
            }

            await syncAll();
            return true;
        });
    };

    window.removeWithdrawal = async (encodedEmail, encodedTxId) => {
        if (!guardAdmin()) return;
        const email = decodeValue(encodedEmail);
        const txId = decodeValue(encodedTxId);

        await authApi.refreshFromRemote?.({ force: true });
        const transaction = authApi.getTransaction(email, txId);
        if (!transaction) {
            showToast('عملية السحب غير موجودة بالفعل.');
            await refreshAll(true);
            return;
        }

        if (!window.confirm(`حذف عملية السحب ${txId}؟`)) return;

        const deleted = authApi.deleteTransaction(email, txId);
        if (!deleted) {
            showToast('تعذر حذف عملية السحب.');
            return;
        }

        await syncAll();
        await authApi.refreshFromRemote?.({ force: true });
        await refreshAll(true);
    };

    window.clearAllWithdrawals = async () => {
        if (!guardAdmin()) return;
        if (!window.confirm('تحذير: سيتم مسح كافة سجلات عمليات السحب نهائيًا. هل تريد الاستمرار؟')) return;

        authApi.writeTransactions([]);
        await syncAll();
        await authApi.refreshFromRemote?.({ force: true });
        await refreshAll(true);
        showToast('تم مسح سجل العمليات بنجاح.');
    };

    function commitWithdrawalState(email, txId, transactionUpdater, userUpdater = null) {
        const normalizedEmail = authApi.normalizeEmail(email);
        const currentTransactions = authApi.getAllTransactions();
        const nextTransactions = currentTransactions.map((candidate) => (
            authApi.normalizeEmail(candidate.email) === normalizedEmail && String(candidate.txId || '').trim() === String(txId || '').trim()
                ? transactionUpdater(candidate)
                : candidate
        ));

        authApi.writeTransactions(nextTransactions);

        if (typeof userUpdater === 'function') {
            const nextUsers = authApi.getAllUsersRaw().map((candidate) => (
                authApi.normalizeEmail(candidate.email) === normalizedEmail
                    ? userUpdater(candidate)
                    : candidate
            ));
            authApi.writeUsers(nextUsers);
        }
    }

    window.setWithdrawalStatus = async (encodedEmail, encodedTxId, status, adminMessage = '') => {
        if (!guardAdmin()) return false;

        const email = decodeValue(encodedEmail);
        const txId = decodeValue(encodedTxId);

        await authApi.refreshFromRemote?.({ force: true });

        const transaction = authApi.getTransaction(email, txId);
        const user = authApi.getUserByEmail(email);
        if (!transaction || !user) {
            showToast('تعذر العثور على عملية السحب أو المستخدم.');
            return false;
        }

        const statusMeta = getWithdrawalStatusMeta(status);
        const amount = Number(transaction.amount || 0);
        const currentBalance = Number(user.balance || 0);
        const currentStatus = String(transaction.status || 'pending').trim();
        const alreadyDebited = Boolean(transaction.debitedAt);
        const now = new Date().toISOString();
        const nextMessage = String(adminMessage || transaction.adminMessage || statusMeta.defaultMessage).trim();

        let nextBalance = currentBalance;
        let debitedAt = String(transaction.debitedAt || '');
        let resolvedAt = String(transaction.resolvedAt || '');
        let shouldUpdateBalance = false;

        if (status === 'completed') {
            if (alreadyDebited) {
                resolvedAt = resolvedAt || now;
            } else {
                if (amount > currentBalance) {
                    showToast('لا يمكن تنفيذ العملية لأن الرصيد الحالي للمستخدم أقل من مبلغ السحب.');
                    return false;
                }
                nextBalance = currentBalance - amount;
                debitedAt = now;
                resolvedAt = now;
                shouldUpdateBalance = true;
            }
        } else if (status === 'pending') {
            if (alreadyDebited) {
                nextBalance = currentBalance + amount;
                shouldUpdateBalance = true;
            }
            debitedAt = '';
            resolvedAt = '';
        } else if (status === 'rejected' || status === 'error') {
            if (alreadyDebited) {
                nextBalance = currentBalance + amount;
                shouldUpdateBalance = true;
            }
            debitedAt = '';
            resolvedAt = now;
        }

        const hasMeaningfulChange = (
            currentStatus !== status
            || String(transaction.adminMessage || '').trim() !== nextMessage
            || String(transaction.debitedAt || '') !== debitedAt
            || String(transaction.resolvedAt || '') !== resolvedAt
            || shouldUpdateBalance
        );

        if (!hasMeaningfulChange) {
            await refreshAll(true);
            return true;
        }

        commitWithdrawalState(
            email,
            txId,
            (candidate) => ({
                ...candidate,
                status,
                statusLabel: statusMeta.label,
                adminMessage: nextMessage,
                debitedAt,
                resolvedAt,
                updatedAt: now
            }),
            shouldUpdateBalance
                ? (candidate) => ({
                    ...candidate,
                    balance: nextBalance,
                    updatedAt: now,
                    lastUpdatedAt: now
                })
                : null
        );

        try {
            await publishPrivateNotification(email, {
                title: `تحديث عملية السحب ${txId}`,
                body: `${statusMeta.label} - ${nextMessage}`,
                type: 'finance',
                actionUrl: './wallet.html',
                actionLabel: 'فتح السحب'
            });
        } catch (error) {
            console.error('Private withdrawal notification failed:', error);
        }

        store.addNotification({
            title: `تحديث عملية السحب ${txId}`,
            body: `تم تغيير حالة عملية السحب الخاصة بالمستخدم ${user.name || user.email} إلى ${statusMeta.label}.`,
            type: 'finance',
            actionUrl: './wallet.html',
            actionLabel: 'فتح السحب'
        });

        await syncAll();
        await authApi.refreshFromRemote?.({ force: true });
        await refreshAll(true);
        return true;
    };

    window.editWithdrawal = (encodedEmail, encodedTxId) => {
        if (!guardAdmin()) return;
        const email = decodeValue(encodedEmail);
        const txId = decodeValue(encodedTxId);
        const transaction = authApi.getTransaction(email, txId);
        if (!transaction) return;

        openModal('تعديل بيانات عملية السحب', `
            <div class="form-group"><label>المبلغ</label><input class="form-control" id="edit-tx-amount" type="number" value="${escapeHtml(transaction.amount)}"></div>
            <div class="form-group"><label>الوسيلة</label><input class="form-control" id="edit-tx-method" type="text" value="${escapeHtml(transaction.method || '')}"></div>
            <div class="form-group"><label>الجهة</label><input class="form-control" id="edit-tx-channel" type="text" value="${escapeHtml(transaction.channelName || '')}"></div>
            <div class="form-group"><label>التفاصيل</label><input class="form-control" id="edit-tx-details" type="text" value="${escapeHtml(transaction.details || '')}"></div>
            <div class="form-group"><label>الملاحظات</label><textarea class="form-control" id="edit-tx-notes" rows="4">${escapeHtml(transaction.notes || '')}</textarea></div>
            <div class="form-group"><label>رسالة الإدارة</label><textarea class="form-control" id="edit-tx-message" rows="4">${escapeHtml(transaction.adminMessage || '')}</textarea></div>
        `, async () => {
            await authApi.refreshFromRemote?.({ force: true });
            const latestTransaction = authApi.getTransaction(email, txId);
            const user = authApi.getUserByEmail(email);
            if (!latestTransaction || !user) {
                showToast('تعذر العثور على عملية السحب أو المستخدم.');
                return false;
            }

            const nextAmount = Math.max(0, Number(document.getElementById('edit-tx-amount')?.value || latestTransaction.amount || 0));
            const amountDelta = nextAmount - Number(latestTransaction.amount || 0);
            const now = new Date().toISOString();

            let nextBalance = Number(user.balance || 0);
            let shouldUpdateBalance = false;

            if (latestTransaction.status === 'completed' && amountDelta !== 0) {
                nextBalance = nextBalance - amountDelta;
                if (nextBalance < 0) {
                    showToast('لا يمكن زيادة مبلغ العملية لأن رصيد المستخدم الحالي لا يكفي.');
                    return false;
                }
                shouldUpdateBalance = true;
            }

            commitWithdrawalState(
                email,
                txId,
                (candidate) => ({
                    ...candidate,
                    amount: nextAmount,
                    method: document.getElementById('edit-tx-method')?.value.trim() || latestTransaction.method,
                    channelName: document.getElementById('edit-tx-channel')?.value.trim() || latestTransaction.channelName,
                    details: document.getElementById('edit-tx-details')?.value.trim() || latestTransaction.details,
                    notes: document.getElementById('edit-tx-notes')?.value.trim() || latestTransaction.notes,
                    adminMessage: document.getElementById('edit-tx-message')?.value.trim() || latestTransaction.adminMessage,
                    updatedAt: now
                }),
                shouldUpdateBalance
                    ? (candidate) => ({
                        ...candidate,
                        balance: nextBalance,
                        updatedAt: now,
                        lastUpdatedAt: now
                    })
                    : null
            );

            await syncAll();
            await authApi.refreshFromRemote?.({ force: true });
            return true;
        });
    };

    window.removeWithdrawal = async (encodedEmail, encodedTxId) => {
        if (!guardAdmin()) return;
        const email = decodeValue(encodedEmail);
        const txId = decodeValue(encodedTxId);

        await authApi.refreshFromRemote?.({ force: true });
        const transaction = authApi.getTransaction(email, txId);
        if (!transaction) {
            showToast('عملية السحب غير موجودة بالفعل.');
            await refreshAll(true);
            return;
        }

        if (!window.confirm(`حذف عملية السحب ${txId}؟`)) return;

        const normalizedEmail = authApi.normalizeEmail(email);
        const nextTransactions = authApi.getAllTransactions().filter((candidate) => !(
            authApi.normalizeEmail(candidate.email) === normalizedEmail && String(candidate.txId || '').trim() === String(txId || '').trim()
        ));

        authApi.writeTransactions(nextTransactions);
        await syncAll();
        await authApi.refreshFromRemote?.({ force: true });
        await refreshAll(true);
    };

    window.clearAllWithdrawals = async () => {
        if (!guardAdmin()) return;
        if (!window.confirm('تحذير: سيتم مسح كافة سجلات عمليات السحب نهائيًا. هل تريد الاستمرار؟')) return;

        authApi.writeTransactions([]);
        await syncAll();
        await authApi.refreshFromRemote?.({ force: true });
        await refreshAll(true);
        showToast('تم مسح سجل العمليات بنجاح.');
    };

    renderStudents = function renderStudentsModern() {
        if (!studentsListEl) return;

        const { filtered } = getStudentsDataset();
        const summaryHtml = renderSummaryRow([
            { label: 'المعروض الآن', value: filtered.length },
            { label: 'قيد المراجعة', value: filtered.filter((item) => item.status === 'pending').length },
            { label: 'مقبول', value: filtered.filter((item) => item.status === 'accepted').length },
            { label: 'مرفوض', value: filtered.filter((item) => item.status === 'rejected').length },
            { label: 'ممنوع امتحان', value: filtered.filter((item) => item.examAccess === 'blocked').length }
        ]);

        if (welcomeEl) {
            welcomeEl.textContent = `مرحبًا بك يا ${session.name}`;
        }

        if (!filtered.length) {
            studentsListEl.innerHTML = `${summaryHtml}${renderEmptyState('fa-users-slash', 'لا توجد نتائج مطابقة', 'جرّب تخفيف البحث أو تغيير الفلاتر لإظهار الطلاب والطلبات.')}`;
            return;
        }

        studentsListEl.innerHTML = `${summaryHtml}${filtered.map((application) => {
            const latestAttempt = store.getLatestExamAttempt(application.requestId);
            const actionBlock = isAdmin ? `
                <div class="card-actions">
                    <button class="btn-action success" onclick="approveApplication('${encodeValue(application.requestId)}')"><i class="fas fa-check"></i> قبول</button>
                    <button class="btn-action danger" onclick="rejectApplication('${encodeValue(application.requestId)}')"><i class="fas fa-xmark"></i> رفض</button>
                    <button class="btn-action" onclick="setPendingApplication('${encodeValue(application.requestId)}')"><i class="fas fa-clock"></i> انتظار</button>
                    <button class="btn-action" onclick="allowStudentExam('${encodeValue(application.requestId)}')"><i class="fas fa-unlock"></i> سماح</button>
                    <button class="btn-action danger" onclick="blockStudentExam('${encodeValue(application.requestId)}')"><i class="fas fa-ban"></i> منع</button>
                    <button class="btn-action" onclick="resetStudentExam('${encodeValue(application.requestId)}')"><i class="fas fa-rotate-left"></i> تصفير</button>
                    <button class="btn-action" onclick="editApplication('${encodeValue(application.requestId)}')"><i class="fas fa-pen"></i> تعديل</button>
                    <button class="btn-action" onclick="openStudentEditor('${encodeValue(application.requestId)}')"><i class="fas fa-up-right-from-square"></i> شاشة التعديل</button>
                    <button class="btn-action danger" onclick="removeApplication('${encodeValue(application.requestId)}')"><i class="fas fa-trash"></i> حذف</button>
                </div>
            ` : `
                <div class="card-actions">
                    <button class="btn-action" onclick="viewStudentStatus('${encodeValue(application.requestId)}', '${encodeValue(application.nationalId || '')}')"><i class="fas fa-eye"></i> فتح الطلب</button>
                    <button class="btn-action" onclick="openStudentEditor('${encodeValue(application.requestId)}')"><i class="fas fa-up-right-from-square"></i> شاشة التعديل</button>
                    <button class="btn-action" onclick="copyStudentRequestId('${encodeValue(application.requestId)}')"><i class="fas fa-copy"></i> نسخ الرقم</button>
                </div>
            `;

            return `
                <div class="admin-card">
                    <div class="card-header">
                        <div class="user-info">
                            <h4>${escapeHtml(application.name || application.requestId)}</h4>
                            <span>${escapeHtml(application.requestId)} - ${escapeHtml(application.nationalId || 'بدون رقم قومي')}</span>
                        </div>
                        <span class="status-pill ${getStatusBadgeClass(application.status)}">
                            ${escapeHtml(store.getStatusLabel(application.status))}
                        </span>
                    </div>
                    <div class="card-body">
                        <p><span>العمر</span><strong>${escapeHtml(application.age || '--')}</strong></p>
                        <p><span>المحافظة</span><strong>${escapeHtml(application.governorate || '--')}</strong></p>
                        <p><span>المركز</span><strong>${escapeHtml(application.city || '--')}</strong></p>
                        <p><span>القرية</span><strong>${escapeHtml(application.village || '--')}</strong></p>
                        <p><span>كود القائد</span><strong>${escapeHtml(application.leaderCode || '--')}</strong></p>
                        <p><span>بريد الدخول</span><strong>${escapeHtml(application.studentEmail || '--')}</strong></p>
                        <p><span>وضع الامتحان</span><strong>${escapeHtml(store.getExamAccessLabel(application.examAccess))}</strong></p>
                        <p><span>آخر تحديث</span><strong>${escapeHtml(formatDate(application.updatedAt || application.createdAt))}</strong></p>
                        <p><span>آخر نتيجة</span><strong>${latestAttempt ? `${latestAttempt.percentage || 0}%` : 'لا يوجد'}</strong></p>
                        ${application.message ? `<p style="display:block; margin-top:0.75rem;"><span>ملاحظة</span><strong style="display:block; margin-top:0.35rem;">${escapeHtml(application.message)}</strong></p>` : ''}
                    </div>
                    ${actionBlock}
                </div>
            `;
        }).join('')}`;
    };

    renderWithdrawals = function renderWithdrawalsModern() {
        if (!allWithdrawalsListEl) return;
        if (!isAdmin) {
            allWithdrawalsListEl.innerHTML = renderEmptyState('fa-lock', 'هذه المساحة للإدارة فقط', 'الماليات لا تظهر إلا للإدارة العامة.');
            return;
        }

        const { filtered } = getWithdrawalsDataset();
        const summaryHtml = renderSummaryRow([
            { label: 'المعروض الآن', value: filtered.length },
            { label: 'قيد المراجعة', value: filtered.filter((item) => item.status === 'pending').length },
            { label: 'تم التنفيذ', value: filtered.filter((item) => item.status === 'completed').length },
            { label: 'مرفوض أو خطأ', value: filtered.filter((item) => item.status === 'rejected' || item.status === 'error').length },
            { label: 'إجمالي المنفذ', value: formatMoney(filtered.filter((item) => item.status === 'completed').reduce((sum, item) => sum + Number(item.amount || 0), 0)) }
        ]);

        if (!filtered.length) {
            allWithdrawalsListEl.innerHTML = `${summaryHtml}${renderEmptyState('fa-wallet', 'لا توجد عمليات مطابقة', 'لا توجد طلبات سحب تطابق الفلاتر أو البحث الحالي.')}`;
            return;
        }

        allWithdrawalsListEl.innerHTML = `${summaryHtml}${filtered.map((transaction) => {
            const statusMeta = getWithdrawalStatusMeta(transaction.status || 'pending');
            return `
                <div class="admin-card">
                    <div class="card-header">
                        <div class="user-info">
                            <h4>${escapeHtml(transaction.userName || transaction.email)}</h4>
                            <span>${escapeHtml(transaction.email)} - ${escapeHtml(transaction.txId)}</span>
                        </div>
                        <span class="status-pill ${getStatusBadgeClass(transaction.status)}">
                            ${escapeHtml(transaction.statusLabel || statusMeta.label)}
                        </span>
                    </div>
                    <div class="card-body">
                        <p><span>المبلغ</span><strong>${escapeHtml(formatMoney(transaction.amount))}</strong></p>
                        <p><span>الوسيلة</span><strong>${escapeHtml(transaction.method || '--')}</strong></p>
                        <p><span>الجهة</span><strong>${escapeHtml(transaction.channelName || '--')}</strong></p>
                        <p><span>التفاصيل</span><strong>${escapeHtml(transaction.details || '--')}</strong></p>
                        <p><span>التاريخ</span><strong>${escapeHtml(formatDate(transaction.createdAt))}</strong></p>
                        <p><span>خصم الرصيد</span><strong>${transaction.debitedAt ? escapeHtml(formatDate(transaction.debitedAt)) : 'لم يخصم بعد'}</strong></p>
                        <p><span>آخر قرار</span><strong>${transaction.resolvedAt ? escapeHtml(formatDate(transaction.resolvedAt)) : 'لم يحسم بعد'}</strong></p>
                        ${transaction.adminMessage ? `<p style="display:block; margin-top:0.75rem;"><span>رسالة الإدارة</span><strong style="display:block; margin-top:0.35rem;">${escapeHtml(transaction.adminMessage)}</strong></p>` : ''}
                    </div>
                    <div class="card-actions">
                        <button class="btn-action success" onclick="promptWithdrawalStatus('${encodeValue(transaction.email)}', '${encodeValue(transaction.txId)}', 'completed')"><i class="fas fa-circle-check"></i> تنفيذ</button>
                        <button class="btn-action" onclick="promptWithdrawalStatus('${encodeValue(transaction.email)}', '${encodeValue(transaction.txId)}', 'pending')"><i class="fas fa-hourglass-half"></i> مراجعة</button>
                        <button class="btn-action danger" onclick="promptWithdrawalStatus('${encodeValue(transaction.email)}', '${encodeValue(transaction.txId)}', 'rejected')"><i class="fas fa-ban"></i> رفض</button>
                        <button class="btn-action danger" onclick="promptWithdrawalStatus('${encodeValue(transaction.email)}', '${encodeValue(transaction.txId)}', 'error')"><i class="fas fa-triangle-exclamation"></i> خطأ</button>
                        <button class="btn-action" onclick="editWithdrawal('${encodeValue(transaction.email)}', '${encodeValue(transaction.txId)}')"><i class="fas fa-pen"></i> تعديل</button>
                        <button class="btn-action danger" onclick="removeWithdrawal('${encodeValue(transaction.email)}', '${encodeValue(transaction.txId)}')"><i class="fas fa-trash"></i> حذف</button>
                    </div>
                </div>
            `;
        }).join('')}`;
    };

    renderUsers = function renderUsersModern() {
        if (!allUsersListEl) return;
        if (!isAdmin) {
            allUsersListEl.innerHTML = renderEmptyState('fa-lock', 'هذه المساحة للإدارة فقط', 'إدارة الحسابات لا تظهر إلا للإدارة العامة.');
            return;
        }

        const { filtered } = getUsersDataset();
        const summaryHtml = renderSummaryRow([
            { label: 'المعروض الآن', value: filtered.length },
            { label: 'نشط', value: filtered.filter((user) => !user.isSuspended).length },
            { label: 'موقوف', value: filtered.filter((user) => user.isSuspended).length },
            { label: 'ممنوع امتحان', value: filtered.filter((user) => user.examAllowed === false).length },
            { label: 'السحب مغلق', value: filtered.filter((user) => user.withdrawalsEnabled === false).length }
        ]);

        if (!filtered.length) {
            allUsersListEl.innerHTML = `${summaryHtml}${renderEmptyState('fa-user-slash', 'لا توجد حسابات مطابقة', 'لا توجد نتائج توافق الفلاتر الحالية داخل قاعدة المستخدمين.')}`;
            return;
        }

        allUsersListEl.innerHTML = `${summaryHtml}${filtered.map((user) => `
            <div class="admin-card" style="opacity:${user.isSuspended ? 0.74 : 1};">
                <div class="card-header">
                    <div class="user-info">
                        <h4>${escapeHtml(user.name || 'مستخدم بدون اسم')}</h4>
                        <span>${escapeHtml(user.email)}</span>
                    </div>
                    <span class="status-pill ${user.isSuspended ? 'pill-suspended' : 'pill-active'}">${user.isSuspended ? 'موقوف' : 'نشط'}</span>
                </div>
                <div class="card-body">
                    <p><span>الدور</span><strong>${escapeHtml(user.role || '--')}</strong></p>
                    <p><span>الرصيد</span><strong>${escapeHtml(formatMoney(user.balance))}</strong></p>
                    <p><span>كود القائد</span><strong>${escapeHtml(user.leaderCode || '--')}</strong></p>
                    <p><span>صلاحية الامتحان</span><strong>${user.examAllowed === false ? 'موقوفة' : 'مسموحة'}</strong></p>
                    <p><span>صلاحية السحب</span><strong>${user.withdrawalsEnabled === false ? 'مغلقة' : 'مفتوحة'}</strong></p>
                    ${user.withdrawalLockMessage ? `<p style="display:block; margin-top:0.75rem;"><span>رسالة قفل السحب</span><strong style="display:block; margin-top:0.35rem;">${escapeHtml(user.withdrawalLockMessage)}</strong></p>` : ''}
                    <p><span>آخر دخول</span><strong>${escapeHtml(formatDate(user.lastLoginAt))}</strong></p>
                </div>
                <div class="card-actions">
                    <button class="btn-action" onclick="editUser('${encodeValue(user.email)}')"><i class="fas fa-user-pen"></i> تعديل</button>
                    <button class="btn-action" onclick="changeUserBalance('${encodeValue(user.email)}')"><i class="fas fa-coins"></i> رصيد</button>
                    <button class="btn-action ${user.isSuspended ? 'success' : 'danger'}" onclick="toggleUserStatus('${encodeValue(user.email)}')"><i class="fas ${user.isSuspended ? 'fa-play' : 'fa-pause'}"></i> ${user.isSuspended ? 'تنشيط' : 'إيقاف'}</button>
                    <button class="btn-action ${user.examAllowed === false ? 'success' : 'danger'}" onclick="toggleUserExam('${encodeValue(user.email)}')"><i class="fas ${user.examAllowed === false ? 'fa-unlock' : 'fa-lock'}"></i> ${user.examAllowed === false ? 'سماح امتحان' : 'منع امتحان'}</button>
                    <button class="btn-action ${user.withdrawalsEnabled === false ? 'success' : 'danger'}" onclick="toggleUserWithdrawal('${encodeValue(user.email)}')"><i class="fas ${user.withdrawalsEnabled === false ? 'fa-wallet' : 'fa-ban'}"></i> ${user.withdrawalsEnabled === false ? 'فتح السحب' : 'قفل السحب'}</button>
                    ${isSuperAdminSession() ? `<button class="btn-action" data-pro-action="permissions-${escapeHtml(user.email)}" onclick="editUserPermissions('${encodeValue(user.email)}')"><i class="fas fa-shield-halved"></i> صلاحيات</button>` : ''}
                    <button class="btn-action" onclick="sendUserNotification('${encodeValue(user.email)}')"><i class="fas fa-bell"></i> إشعار</button>
                    <button class="btn-action danger" onclick="removeUser('${encodeValue(user.email)}')"><i class="fas fa-trash"></i> حذف</button>
                </div>
            </div>
        `).join('')}`;
    };

    renderExams = function renderExamsModern() {
        if (!globalExamControlEl) return;
        if (!isAdmin) {
            globalExamControlEl.innerHTML = renderEmptyState('fa-lock', 'هذه المساحة للإدارة فقط', 'إدارة الامتحانات لا تظهر إلا للإدارة العامة.');
            return;
        }

        const settings = store.getPlatformSettings();
        const attempts = store.getExamHistory().slice(0, 8);
        const now = examWindowApi?.getEgyptNow?.() || new Date();
        const windowState = examWindowApi?.getExamWindowState?.(now, settings) || { open: false, statusText: 'غير متاح', showCountdown: false };
        const modeLabel = settings.examMode === 'open'
            ? 'فتح يدوي'
            : settings.examMode === 'closed'
                ? 'إيقاف يدوي'
                : 'الجدول الرسمي';
        const openUntilText = settings.manualExamEndsAt ? formatDate(settings.manualExamEndsAt) : 'غير محدد';
        const manualDuration = Number(settings.manualExamDurationMinutes || 60);
        const maintenanceStatus = settings.maintenanceMode ? 'مفعل' : 'غير مفعل';
        const liveCountdown = windowState.showCountdown && windowState.countdownTarget
            ? `${windowState.countdownPrefix}: ${examWindowApi.formatCountdown(windowState.countdownTarget - now)}`
            : windowState.statusText;

        globalExamControlEl.innerHTML = `
            ${renderSummaryRow([
                { label: 'الوضع الحالي', value: modeLabel },
                { label: 'حالة البوابة', value: windowState.statusText },
                { label: 'وضع الصيانة', value: maintenanceStatus },
                { label: 'آخر تحديث', value: formatDate(settings.updatedAt) },
                { label: 'المحاولات', value: store.getExamHistory().length }
            ])}
            <div class="admin-grid" style="grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));">
                <div class="admin-card">
                    <div class="card-header"><div class="user-info"><h4>وضع الصيانة</h4><span>تفعيل الصيانة يمنع الدخول لغير المدراء ويُخرجهم من الجلسات الحالية.</span></div></div>
                    <div class="card-body">
                        <p><span>الحالة الحالية</span><strong>${escapeHtml(maintenanceStatus)}</strong></p>
                        <p><span>الرسالة الحالية</span><strong>${escapeHtml(settings.maintenanceMessage || 'جاري الآن صيانة الموقع. يرجى المحاولة لاحقًا.')}</strong></p>
                    </div>
                    <div class="card-actions" style="grid-template-columns: 1fr;">
                        <button class="btn-action ${settings.maintenanceMode ? 'success' : 'danger'}" onclick="toggleMaintenanceMode()"><i class="fas ${settings.maintenanceMode ? 'fa-screwdriver-wrench' : 'fa-power-off'}"></i> ${settings.maintenanceMode ? 'إيقاف الصيانة' : 'تفعيل الصيانة'}</button>
                    </div>
                </div>
                <div class="admin-card">
                    <div class="card-header"><div class="user-info"><h4>التحكم العام في الامتحانات</h4><span>أي تغيير هنا ينعكس على البوابة مباشرة.</span></div></div>
                    <div class="card-body">
                        <p><span>الوضع</span><strong>${escapeHtml(modeLabel)}</strong></p>
                        <p><span>الحالة المباشرة</span><strong>${escapeHtml(windowState.statusText)}</strong></p>
                        <p><span>نهاية الفتح اليدوي</span><strong>${escapeHtml(openUntilText)}</strong></p>
                        <p><span>مدة الفتح اليدوي</span><strong>${escapeHtml(String(manualDuration))} دقيقة</strong></p>
                        <p><span>الرسالة الحالية</span><strong>${escapeHtml(settings.examModeMessage || 'لا توجد رسالة مخصصة')}</strong></p>
                        <p><span>المؤقت الحالي</span><strong>${escapeHtml(liveCountdown)}</strong></p>
                    </div>
                    <div class="card-actions" style="grid-template-columns: repeat(3, 1fr);">
                        <button class="btn-action success" onclick="openExamWindow()"><i class="fas fa-door-open"></i> فتح الآن</button>
                        <button class="btn-action danger" onclick="closeExamWindow()"><i class="fas fa-circle-stop"></i> إيقاف الآن</button>
                        <button class="btn-action" onclick="restoreExamSchedule()"><i class="fas fa-calendar-days"></i> العودة للجدول</button>
                    </div>
                    <div class="card-actions" style="grid-template-columns: 1fr;">
                        <button class="btn-action" onclick="editExamMessage()"><i class="fas fa-comment-medical"></i> تعديل الرسالة</button>
                    </div>
                </div>
                <div class="admin-card">
                    <div class="card-header"><div class="user-info"><h4>إدارة الدورة الحالية</h4><span>يمكن فتح الامتحان بعدد دقائق محدد أو تصفير محاولات طالب محدد.</span></div></div>
                    <div class="card-body">
                        <p><span>الوضع المتوقع الآن</span><strong>${escapeHtml(windowState.bannerText || windowState.statusText)}</strong></p>
                    </div>
                    <div class="card-actions">
                        <button class="btn-action success" onclick="openExamWindow()"><i class="fas fa-hourglass-start"></i> فتح بمؤقت</button>
                        <button class="btn-action" onclick="manualExamReset()"><i class="fas fa-rotate-left"></i> تصفير يدوي</button>
                    </div>
                </div>
            </div>
            <div class="admin-card" style="margin-top: 1.25rem;">
                <div class="card-header"><div class="user-info"><h4>آخر محاولات الامتحان</h4><span>أحدث عمليات التسليم المسجلة.</span></div></div>
                <div class="card-body">
                    ${attempts.length ? attempts.map((attempt) => `<p><span>${escapeHtml(attempt.name || attempt.requestId)}</span><strong>${escapeHtml(attempt.requestId)} - ${escapeHtml(String(attempt.percentage || 0))}% - ${escapeHtml(formatDate(attempt.date))}</strong></p>`).join('') : '<p>لا توجد محاولات مسجلة بعد.</p>'}
                </div>
            </div>
        `;
    };

    function renderSupportMessages(thread) {
        if (!Array.isArray(thread.messages) || !thread.messages.length) {
            return '<div class="admin-card"><p>لا توجد رسائل داخل هذه المحادثة بعد.</p></div>';
        }

        return thread.messages.map((message) => `
            <div class="admin-card" style="padding:0.95rem; gap:0.75rem; ${message.sender === 'admin' ? 'border-color: rgba(37,99,235,0.24); background: linear-gradient(180deg,#eff6ff,#ffffff);' : ''}">
                <div class="card-header" style="padding-bottom:0.65rem;">
                    <div class="user-info">
                        <h4>${escapeHtml(message.sender === 'admin' ? 'الدعم الإداري' : message.sender === 'bot' ? 'المساعد الآلي' : thread.userName || 'المستخدم')}</h4>
                        <span>${escapeHtml(formatDate(message.createdAt))}</span>
                    </div>
                    <span class="status-pill ${message.sender === 'admin' ? 'pill-active' : ''}">${escapeHtml(message.sender === 'admin' ? 'رد الإدارة' : message.sender === 'bot' ? 'رد تلقائي' : 'رسالة مستخدم')}</span>
                </div>
                <div class="card-body">
                    <p style="display:block;"><strong>${escapeHtml(message.text)}</strong></p>
                </div>
            </div>
        `).join('');
    }

    function normalizeAdminSupportAttachment(attachment) {
        const src = String(attachment?.src || '').trim();
        if (!src) return null;

        return {
            src,
            name: String(attachment?.name || 'attachment').trim() || 'attachment'
        };
    }

    function renderAdminSupportAttachments(attachments) {
        const safeAttachments = (Array.isArray(attachments) ? attachments : [])
            .map((item) => normalizeAdminSupportAttachment(item))
            .filter(Boolean);
        if (!safeAttachments.length) return '';

        return `
            <div class="admin-support-message-attachments">
                ${safeAttachments.map((attachment, index) => `
                    <a class="admin-support-message-attachment" href="${attachment.src}" target="_blank" rel="noreferrer" aria-label="فتح الصورة ${index + 1}">
                        <img src="${attachment.src}" alt="${escapeHtml(attachment.name || `attachment-${index + 1}`)}" loading="lazy" />
                    </a>
                `).join('')}
            </div>
        `;
    }

    function getAdminSupportMessageState(message) {
        if (message?.sender === 'user') {
            return message.readByAdminAt ? 'تمت المراجعة' : 'غير مقروءة';
        }
        if (message?.sender === 'admin') {
            return message.readByUserAt ? 'قرأها المستخدم' : 'بانتظار القراءة';
        }
        return '';
    }

    function renderSupportMessages(thread) {
        if (!Array.isArray(thread.messages) || !thread.messages.length) {
            return '<div class="admin-card"><p>لا توجد رسائل داخل هذه المحادثة بعد.</p></div>';
        }

        return thread.messages.map((message) => {
            const sender = message.sender === 'admin'
                ? 'admin'
                : message.sender === 'bot'
                    ? 'bot'
                    : 'user';
            const senderLabel = sender === 'admin'
                ? 'الدعم الإداري'
                : sender === 'bot'
                    ? 'المساعد الآلي'
                    : thread.userName || 'المستخدم';
            const typeLabel = sender === 'admin'
                ? 'رد الإدارة'
                : sender === 'bot'
                    ? 'رد تلقائي'
                    : 'رسالة مستخدم';
            const stateLabel = getAdminSupportMessageState(message);
            const attachmentsHtml = renderAdminSupportAttachments(message.attachments);
            const textHtml = message.text ? `<p class="admin-support-message-text">${escapeHtml(message.text)}</p>` : '';

            return `
                <div class="admin-card admin-support-message-card is-${sender}">
                    <div class="card-header" style="padding-bottom:0.65rem;">
                        <div class="user-info">
                            <h4>${escapeHtml(senderLabel)}</h4>
                            <span>${escapeHtml(formatDate(message.createdAt))}</span>
                        </div>
                        <span class="status-pill ${sender === 'admin' ? 'pill-active' : ''}">${escapeHtml(typeLabel)}</span>
                    </div>
                    <div class="card-body">
                        ${textHtml}
                        ${attachmentsHtml}
                        <div class="admin-support-message-meta">
                            <span>${escapeHtml(message.senderName || '')}</span>
                            ${stateLabel ? `<span class="admin-support-message-state">${escapeHtml(stateLabel)}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderSupport = function renderSupportModern() {
        if (!supportInboxListEl) return;
        if (!isAdmin) {
            supportInboxListEl.innerHTML = renderEmptyState('fa-lock', 'هذه المساحة للإدارة فقط', 'صندوق الدعم الإداري لا يظهر إلا للإدارة العامة.');
            return;
        }

        const { filtered } = getSupportDataset();
        const summaryHtml = renderSummaryRow([
            { label: 'المعروض الآن', value: filtered.length },
            { label: 'مفتوحة', value: filtered.filter((item) => item.status === 'open').length },
            { label: 'مغلقة', value: filtered.filter((item) => item.status === 'closed').length },
            { label: 'غير مقروءة', value: filtered.filter((item) => Number(item.unreadByAdmin || 0) > 0).length }
        ]);

        if (!filtered.length) {
            supportInboxListEl.innerHTML = `${summaryHtml}${renderEmptyState('fa-headset', 'لا توجد محادثات دعم مطابقة', 'ستظهر هنا الرسائل الواردة من المستخدمين عند التواصل مع الدعم الإداري.')}`;
            return;
        }

        supportInboxListEl.innerHTML = `${summaryHtml}${filtered.map((thread) => `
            <div class="admin-card" style="grid-column: 1 / -1;">
                <div class="card-header">
                    <div class="user-info">
                        <h4>${escapeHtml(thread.userName || thread.email)}</h4>
                        <span>${escapeHtml(thread.email)}${thread.role ? ` - ${escapeHtml(thread.role)}` : ''}</span>
                    </div>
                    <span class="status-pill ${thread.status === 'closed' ? 'pill-suspended' : 'pill-active'}">${thread.status === 'closed' ? 'مغلقة' : `مفتوحة${Number(thread.unreadByAdmin || 0) > 0 ? ` - ${thread.unreadByAdmin} جديد` : ''}`}</span>
                </div>
                <div class="card-body">
                    <p><span>آخر تحديث</span><strong>${escapeHtml(formatDate(thread.updatedAt))}</strong></p>
                    <p><span>آخر رسالة</span><strong>${escapeHtml(thread.lastMessagePreview || '--')}</strong></p>
                </div>
                <div class="card-actions">
                    <button class="btn-action success" onclick="replySupportThread('${encodeValue(thread.email)}')"><i class="fas fa-reply"></i> رد</button>
                    <button class="btn-action" onclick="markSupportMessagesRead('${encodeValue(thread.email)}')"><i class="fas fa-envelope-open-text"></i> تعليم كمقروء</button>
                    <button class="btn-action ${thread.status === 'closed' ? 'success' : 'danger'}" onclick="toggleSupportThreadStatus('${encodeValue(thread.email)}', '${thread.status === 'closed' ? 'open' : 'closed'}')"><i class="fas ${thread.status === 'closed' ? 'fa-lock-open' : 'fa-lock'}"></i> ${thread.status === 'closed' ? 'إعادة فتح' : 'إغلاق'}</button>
                    <button class="btn-action danger" onclick="removeSupportThread('${encodeValue(thread.email)}')"><i class="fas fa-trash"></i> حذف</button>
                </div>
                <div class="admin-grid" style="grid-template-columns: 1fr; margin-top: 0.85rem;">
                    ${renderSupportMessages(thread)}
                </div>
            </div>
        `).join('')}`;
    };

    function renderNotifications() {
        const target = notificationsFeedEl || notificationsTabEl;
        if (!target) return;
        
        if (!isAdmin) {
            target.innerHTML = renderEmptyState('fa-lock', 'للإدارة فقط', 'هذا القسم مخصص للإدارة العامة فقط.');
            return;
        }

        const { filtered } = getNotificationsDataset();
        const summaryHtml = renderSummaryRow([
            { label: 'المعروض', value: filtered.length },
            { label: 'إشعارات عامة', value: filtered.filter((item) => item.audience !== 'private').length },
            { label: 'إشعارات خاصة', value: filtered.filter((item) => item.audience === 'private').length },
            { label: 'إشعارات ثابتة', value: filtered.filter((item) => item.sticky).length }
        ]);

        const cardsHtml = filtered.length ? filtered.map(note => `
            <div class="admin-card" style="display: flex !important; opacity: 1 !important; visibility: visible !important;">
                <div class="card-header">
                    <div class="user-info">
                        <h4 style="color: #1e293b !important;">${escapeHtml(note.title)}</h4>
                        <span>${escapeHtml(formatDate(note.createdAt))}</span>
                    </div>
                    <span class="status-pill ${note.audience === 'private' ? '' : 'pill-active'}">${escapeHtml(getNotificationAudienceLabel(note))}</span>
                </div>
                <div class="card-body">
                    <p style="display:block !important; color: #334155 !important; font-weight: 600 !important; opacity: 1 !important;">
                        ${escapeHtml(note.body)}
                    </p>
                    <p><span>النوع</span><strong>${escapeHtml(note.type || 'update')}</strong></p>
                    <p><span>الحالة</span><strong>${note.sticky ? 'ثابت' : 'عادي'}</strong></p>
                    <p><span>التشغيل</span><strong>${escapeHtml(getNotificationRuntimeLabel(note))}</strong></p>
                    <p><span>العرض</span><strong>${escapeHtml(getNotificationDisplayLabel(note.displayMode))}</strong></p>
                    <p><span>الجدولة</span><strong>${escapeHtml(getNotificationScheduleLabel(note))}</strong></p>
                    ${note.audience === 'private' ? `<p><span>المستلم</span><strong>${escapeHtml(note.recipientName || note.recipientEmail || '--')}</strong></p>` : ''}
                    ${note.actionUrl ? `<p><span>الرابط</span><strong>${escapeHtml(note.actionUrl)}</strong></p>` : ''}
                </div>
                <div class="card-actions">
                    <button class="btn-action" onclick="editPlatformNotification('${encodeValue(note.sourceKey || getNotificationSourceKey(note))}')"><i class="fas fa-pen"></i> تعديل</button>
                    <button class="btn-action danger" onclick="removePlatformNotification('${encodeValue(note.sourceKey || getNotificationSourceKey(note))}')"><i class="fas fa-trash"></i> حذف</button>
                </div>
            </div>`).join('') : renderEmptyState('fa-bell-slash', 'لا توجد إشعارات', 'لا توجد إشعارات حاليًا تطابق الفلتر.');

        target.innerHTML = summaryHtml + cardsHtml;
    }

    function renderAll() {
        if (!isAdmin && dashboardState.activeTab !== 'students-tab') {
            dashboardState.activeTab = 'students-tab';
        }

        if (!dashboardState.tabCountsInitialized) {
            markTabCounterSeen(dashboardState.activeTab);
            dashboardState.tabCountsInitialized = true;
        }

        if (adminTabsContainer) adminTabsContainer.style.display = isAdmin ? 'flex' : 'none';
        if (!isAdmin) [withdrawalsTabEl, usersTabEl, examsTabEl, supportTabEl, notificationsTabEl].forEach(t => t && (t.style.display = 'none'));

        renderStudents();
        renderWithdrawals();
        renderUsers();
        renderExams();
        renderSupport();
        renderNotifications();
        updateDashboardChrome();
        bindDashboardControls();
    }

    window.switchTab = (tabId) => {
        const next = !isAdmin ? 'students-tab' : tabId;
        dashboardState.activeTab = next;
        markTabCounterSeen(next);
        document.querySelectorAll('.admin-tab-content').forEach(c => {
            c.classList.toggle('active', c.id === next);
        });
        document.querySelectorAll('.admin-tab-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.tabTarget === next);
        });
        if (tabSelectEl) tabSelectEl.value = next;
        updateDashboardChrome();
        renderAll(); // إعادة الرندرة لضمان تحديث المحتوى
    };

    window.setWithdrawalStatus = async (encodedEmail, encodedTxId, status, adminMessage = '') => {
        if (!guardAdmin()) return false;

        const email = decodeValue(encodedEmail);
        const txId = decodeValue(encodedTxId);

        await authApi.refreshFromRemote?.({ force: true });

        const transaction = authApi.getTransaction(email, txId);
        const user = authApi.getUserByEmail(email);
        if (!transaction || !user) {
            showToast('تعذر العثور على عملية السحب أو المستخدم.');
            return false;
        }

        const statusMeta = getWithdrawalStatusMeta(status);
        const amount = Number(transaction.amount || 0);
        const currentBalance = Number(user.balance || 0);
        const currentStatus = String(transaction.status || 'pending').trim();
        const alreadyDebited = Boolean(transaction.debitedAt);
        const now = new Date().toISOString();
        const nextMessage = String(adminMessage || transaction.adminMessage || statusMeta.defaultMessage).trim();

        let nextBalance = currentBalance;
        let debitedAt = String(transaction.debitedAt || '');
        let resolvedAt = String(transaction.resolvedAt || '');
        let shouldUpdateBalance = false;

        if (status === 'completed') {
            if (alreadyDebited) {
                resolvedAt = resolvedAt || now;
            } else {
                if (amount > currentBalance) {
                    showToast('لا يمكن تنفيذ العملية لأن الرصيد الحالي للمستخدم أقل من مبلغ السحب.');
                    return false;
                }
                nextBalance = currentBalance - amount;
                debitedAt = now;
                resolvedAt = now;
                shouldUpdateBalance = true;
            }
        } else if (status === 'pending') {
            if (alreadyDebited) {
                nextBalance = currentBalance + amount;
                shouldUpdateBalance = true;
            }
            debitedAt = '';
            resolvedAt = '';
        } else if (status === 'rejected' || status === 'error') {
            if (alreadyDebited) {
                nextBalance = currentBalance + amount;
                shouldUpdateBalance = true;
            }
            debitedAt = '';
            resolvedAt = now;
        }

        const hasMeaningfulChange = (
            currentStatus !== status
            || String(transaction.adminMessage || '').trim() !== nextMessage
            || String(transaction.debitedAt || '') !== debitedAt
            || String(transaction.resolvedAt || '') !== resolvedAt
            || shouldUpdateBalance
        );

        if (!hasMeaningfulChange) {
            await refreshAll(true);
            return true;
        }

        commitWithdrawalState(
            email,
            txId,
            (candidate) => ({
                ...candidate,
                status,
                statusLabel: statusMeta.label,
                adminMessage: nextMessage,
                debitedAt,
                resolvedAt,
                updatedAt: now
            }),
            shouldUpdateBalance
                ? (candidate) => ({
                    ...candidate,
                    balance: nextBalance,
                    updatedAt: now,
                    lastUpdatedAt: now
                })
                : null
        );

        try {
            await publishPrivateNotification(email, {
                title: `تحديث عملية السحب ${txId}`,
                body: `${statusMeta.label} - ${nextMessage}`,
                type: 'finance',
                displayMode: 'floating',
                actionUrl: './wallet.html',
                actionLabel: 'فتح السحب'
            });
        } catch (error) {
            console.error('Private withdrawal notification failed:', error);
        }

        await syncAll();
        await authApi.refreshFromRemote?.({ force: true });
        await refreshAll(true);
        return true;
    };

    window.showGlobalNotifModal = window.createPlatformNotification;

    renderSupport = function renderSupportSupportDeskFinal() {
        if (!supportInboxListEl) return;
        if (!isAdmin) {
            supportInboxListEl.innerHTML = renderEmptyState('fa-lock', 'هذه المساحة للإدارة فقط', 'صندوق الدعم الإداري لا يظهر إلا للإدارة العامة.');
            return;
        }

        const { all, filtered } = getSupportDataset();
        const summaryHtml = renderSummaryRow([
            { label: 'المعروض الآن', value: filtered.length },
            { label: 'إجمالي المحادثات', value: all.length },
            { label: 'مفتوحة', value: all.filter((item) => item.status === 'open').length },
            { label: 'غير مقروءة', value: all.filter((item) => Number(item.unreadByAdmin || 0) > 0).length }
        ]);

        if (!filtered.length) {
            dashboardState.support.selectedEmail = '';
            supportInboxListEl.innerHTML = `${summaryHtml}${renderEmptyState('fa-headset', 'لا توجد محادثات دعم مطابقة', 'ستظهر هنا الرسائل الواردة من المستخدمين عند التواصل مع الدعم الإداري.')}`;
            return;
        }

        const selectedThread = getSelectedSupportThread(filtered);

        supportInboxListEl.innerHTML = `
            ${summaryHtml}
            <div class="support-desk">
                <aside class="support-desk-sidebar">
                    <div class="support-desk-sidebar-head">
                        <h3>صندوق الدعم</h3>
                        <p class="support-desk-subtext">اختر أي محادثة لعرضها بالكامل والرد عليها بسرعة.</p>
                    </div>
                    <div class="support-desk-list">
                        ${filtered.map((thread) => renderSupportThreadListItem(thread, thread.email === selectedThread?.email)).join('')}
                    </div>
                </aside>
                <section class="support-desk-conversation">
                    ${selectedThread ? renderSupportConversation(selectedThread) : `
                        <div class="support-desk-empty">
                            <i class="fas fa-comments"></i>
                            <strong>اختر محادثة من القائمة</strong>
                            <p>بمجرد اختيار أي مستخدم ستظهر تفاصيل الرسائل هنا مع أدوات الرد السريع.</p>
                        </div>
                    `}
                </section>
            </div>
        `;
    };

    window.selectSupportThread = (encodedEmail) => {
        if (!guardAdmin()) return false;
        const email = decodeValue(encodedEmail);
        dashboardState.support.selectedEmail = email;

        const thread = store.getSupportThreadByEmail?.(email);
        if (thread && Number(thread.unreadByAdmin || 0) > 0 && store.markSupportThreadRead) {
            store.markSupportThreadRead(email, 'admin');
            Promise.resolve(store.syncNow?.()).catch(() => {});
        }

        scheduleRenderAll();
        return true;
    };

    window.switchTab = (tabId) => {
        const next = !isAdmin ? 'students-tab' : tabId;
        dashboardState.activeTab = next;
        markTabCounterSeen(next);
        document.querySelectorAll('.admin-tab-content').forEach((content) => {
            content.classList.toggle('active', content.id === next);
        });
        document.querySelectorAll('.admin-tab-btn').forEach((button) => {
            button.classList.toggle('active', button.dataset.tabTarget === next);
        });
        if (tabSelectEl) tabSelectEl.value = next;
        updateDashboardChrome();
        scheduleRenderAll();
    };

    window.addEventListener(store.storeEventName || 'qarya:store-updated', scheduleRenderAll);
    window.addEventListener(authApi.storeEventName || 'qarya_auth_store_updated', scheduleRenderAll);
    window.addEventListener('focus', () => {
        if (!document.hidden) {
            void refreshAll(true);
        }
    });

    renderAll();
    void refreshAll(true);
    window.setInterval(() => {
        if (!document.hidden) {
            void refreshAll();
        }
    }, 15000);
})();
