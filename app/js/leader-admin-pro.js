(() => {
    const authApi = window.QaryaAuth;
    const store = window.QaryaPlatformStore;
    const advancedStore = window.QaryaAdminAdvancedStore;
    const session = authApi?.getSession?.();

    if (!authApi || !store || !advancedStore || !session) {
        return;
    }

    const PRO_TABS = {
        'activity-tab': { label: 'سجل النشاط', permission: 'activity', icon: 'fa-clock-rotate-left' },
        'archives-tab': { label: 'الأرشيف', permission: 'archives', icon: 'fa-box-archive' }
    };
    const MANAGEMENT_ROLE_LABELS = {
        super_admin: 'المدير العام',
        operations_admin: 'إدارة التشغيل',
        finance_admin: 'إدارة الماليات',
        support_admin: 'إدارة الدعم',
        exam_admin: 'إدارة الامتحانات',
        leader: 'قائد الطلاب',
        user: 'مستخدم المنصة',
        exam_student: 'طالب امتحان'
    };
    const MANAGEMENT_ROLE_ACCOUNT_TYPES = {
        super_admin: 'admin',
        operations_admin: 'admin',
        finance_admin: 'admin',
        support_admin: 'admin',
        exam_admin: 'admin',
        leader: 'leader',
        user: 'platform',
        exam_student: 'exam_student'
    };
    const SUPPORT_QUICK_REPLIES = [
        'تم استلام رسالتك وجارٍ مراجعتها الآن.',
        'يرجى إرسال رقم الطلب أو البريد المرتبط بالحساب لاستكمال المراجعة.',
        'تم حل المشكلة ويمكنك تحديث الصفحة والمحاولة مرة أخرى.',
        'تم تحويل طلبك إلى القسم المختص وسيصلك الرد بمجرد الانتهاء.',
        'برجاء التأكد من البيانات ثم إعادة المحاولة خلال دقائق.'
    ];

    let proModalAction = null;
    let restoreInput = null;
    let activeProTab = '';
    let enhancementFrameQueued = false;
    const observedMutationRoots = new WeakSet();

    function encodeValue(value) {
        return encodeURIComponent(String(value || ''));
    }

    function decodeValue(value) {
        return decodeURIComponent(String(value || ''));
    }

    function normalizeText(value) {
        return String(value || '').trim();
    }

    function normalizeSearch(value) {
        return normalizeText(value).toLowerCase();
    }

    function getLiveSession() {
        return authApi.getSession?.() || session;
    }

    function matchesSearch(parts, query) {
        const normalized = normalizeSearch(query);
        if (!normalized) return true;
        const haystack = parts
            .flat()
            .map((part) => normalizeSearch(part))
            .filter(Boolean)
            .join(' ');
        return haystack.includes(normalized);
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

    function formatBytes(value) {
        const size = Number(value || 0);
        if (size < 1024) return `${size} B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
        return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    }

    function alertToast(message) {
        window.alert(message);
    }

    function isSuperAdmin() {
        return authApi.getManagementRole?.(getLiveSession()) === 'super_admin';
    }

    function hasPermission(permission) {
        return Boolean(authApi.hasPermission?.(getLiveSession(), permission));
    }

    function getManagementRoleDisplay(roleOrUser) {
        if (typeof authApi.getManagementRoleLabel === 'function') {
            return authApi.getManagementRoleLabel(roleOrUser);
        }

        const role = typeof roleOrUser === 'string' && !roleOrUser.includes('@')
            ? String(roleOrUser || '').trim()
            : authApi.getManagementRole?.(roleOrUser) || 'user';

        return MANAGEMENT_ROLE_LABELS[role] || 'مستخدم المنصة';
    }

    function getAccountTypeFromManagementRole(role, fallbackAccountType = 'platform') {
        return MANAGEMENT_ROLE_ACCOUNT_TYPES[String(role || '').trim()] || fallbackAccountType || 'platform';
    }

    function buildPermissionUpdatePayload(user, nextManagementRole, nextPermissions) {
        const accountType = getAccountTypeFromManagementRole(nextManagementRole, user?.accountType || 'platform');
        const isExamStudent = accountType === 'exam_student';

        return {
            managementRole: nextManagementRole,
            permissions: nextPermissions,
            role: getManagementRoleDisplay(nextManagementRole),
            accountType,
            isLeader: nextManagementRole === 'leader',
            walletEnabled: true,
            withdrawalsEnabled: true,
            privateNotificationsEnabled: true,
            showWalletQuickAccess: true
        };
    }

    function canAccessUsers() {
        return hasPermission('users');
    }

    function canAccessWithdrawals() {
        return hasPermission('withdrawals');
    }

    function canAccessSupport() {
        return hasPermission('support');
    }

    function canAccessNotifications() {
        return hasPermission('notifications');
    }

    function canAccessExams() {
        return hasPermission('exams');
    }

    function canAccessStudents() {
        return hasPermission('students') || authApi.isLeader(getLiveSession()?.email);
    }

    function getCurrentUser() {
        const liveSession = getLiveSession();
        return authApi.getUserByEmail(liveSession?.email) || liveSession;
    }

    function getRoleBadgeLabel(user = getCurrentUser()) {
        return getManagementRoleDisplay(user);
    }

    async function syncEverything() {
        await Promise.all([
            store.syncNow?.(),
            authApi.syncNow?.(),
            advancedStore.syncNow?.()
        ]);
    }

    async function refreshEverything(force = false) {
        await Promise.all([
            store.refreshFromRemote?.({ force }),
            authApi.refreshFromRemote?.({ force }),
            advancedStore.refreshFromRemote?.({ force })
        ]);
    }

    function ensureStyles() {
        if (document.getElementById('leader-admin-pro-style')) return;
        const style = document.createElement('style');
        style.id = 'leader-admin-pro-style';
        style.textContent = `
            .admin-pro-actions{display:flex;flex-wrap:wrap;gap:.75rem;align-items:center;margin-top:.75rem}
            .admin-pro-action{display:inline-flex;align-items:center;gap:.45rem;padding:.72rem 1rem;border-radius:.95rem;border:1px solid rgba(148,163,184,.3);background:#fff;color:#0f172a;font-weight:700;cursor:pointer;transition:transform .2s ease,box-shadow .2s ease}
            .admin-pro-action:hover{transform:translateY(-1px);box-shadow:0 12px 28px rgba(15,23,42,.08)}
            .admin-pro-subtitle{color:#64748b;font-size:.88rem}
            .admin-pro-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem}
            .admin-pro-log-card{border:1px solid #e2e8f0;border-radius:1.1rem;background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(248,250,252,.98));padding:1rem;display:grid;gap:.75rem}
            .admin-pro-log-meta{display:flex;justify-content:space-between;gap:.75rem;flex-wrap:wrap;color:#64748b;font-size:.86rem}
            .admin-pro-pill-row{display:flex;flex-wrap:wrap;gap:.5rem}
            .admin-pro-pill{display:inline-flex;align-items:center;gap:.35rem;padding:.35rem .7rem;border-radius:999px;font-size:.78rem;font-weight:700;background:#eef2ff;color:#4338ca}
            .admin-pro-pill.is-muted{background:#f1f5f9;color:#475569}
            .admin-pro-kv{display:grid;gap:.55rem}
            .admin-pro-kv p{margin:0;display:flex;justify-content:space-between;gap:1rem;color:#334155}
            .admin-pro-kv strong{color:#0f172a}
            .admin-pro-empty{padding:1.35rem;border:1px dashed #cbd5e1;border-radius:1.1rem;background:#f8fafc;color:#475569;text-align:center}
            .admin-pro-toolbar{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.8rem;margin-bottom:1rem}
            .admin-pro-toolbar .admin-search-field,.admin-pro-toolbar .admin-select{width:100%}
            .admin-pro-modal{position:fixed;inset:0;background:rgba(15,23,42,.66);backdrop-filter:blur(6px);z-index:10020;display:none;align-items:center;justify-content:center;padding:1rem}
            .admin-pro-modal.is-open{display:flex}
            .admin-pro-modal-card{width:min(1120px,calc(100vw - 1.5rem));max-height:calc(100vh - 1.5rem);background:#fff;border-radius:1.4rem;box-shadow:0 30px 80px rgba(15,23,42,.24);display:flex;flex-direction:column;overflow:hidden}
            .admin-pro-modal-head,.admin-pro-modal-foot{padding:1rem 1.15rem;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;gap:1rem}
            .admin-pro-modal-foot{border-bottom:0;border-top:1px solid #e2e8f0}
            .admin-pro-modal-body{padding:1rem 1.15rem 1.15rem;overflow:auto}
            .admin-pro-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}
            .admin-pro-form-grid .full{grid-column:1 / -1}
            .admin-pro-form-group{display:grid;gap:.45rem}
            .admin-pro-form-group label{font-weight:700;color:#0f172a}
            .admin-pro-form-group small{color:#64748b}
            .admin-pro-quick-replies{display:flex;flex-wrap:wrap;gap:.5rem}
            .admin-pro-quick-replies button{border:1px solid #cbd5e1;background:#fff;color:#334155;border-radius:999px;padding:.45rem .85rem;cursor:pointer;font-weight:700;font-size:.82rem}
            .admin-pro-file-list{display:grid;gap:.85rem}
            .admin-pro-file-item{border:1px solid #e2e8f0;border-radius:1rem;padding:.85rem;display:grid;gap:.65rem;background:#fff}
            .admin-pro-inline-actions{display:flex;flex-wrap:wrap;gap:.5rem}
            .admin-pro-inline-actions button{border:1px solid #dbeafe;background:#eff6ff;color:#1d4ed8;border-radius:.8rem;padding:.48rem .8rem;cursor:pointer;font-weight:700}
            .admin-pro-inline-actions .danger{border-color:#fecaca;background:#fff1f2;color:#be123c}
            .admin-pro-stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:.75rem;margin-bottom:1rem}
            .admin-pro-stat-card{padding:.95rem 1rem;border-radius:1rem;background:linear-gradient(180deg,#fff,#f8fafc);border:1px solid #e2e8f0;display:grid;gap:.3rem}
            .admin-pro-stat-card span{color:#64748b;font-size:.82rem}
            .admin-pro-stat-card strong{color:#0f172a;font-size:1.15rem}
            .admin-pro-role-chip{display:inline-flex;align-items:center;gap:.35rem;margin-top:.45rem;padding:.3rem .7rem;border-radius:999px;background:#f8fafc;color:#475569;font-size:.76rem;font-weight:700}
            @media (max-width:768px){.admin-pro-form-grid{grid-template-columns:1fr}.admin-pro-modal-card{width:calc(100vw - 1rem);max-height:calc(100vh - 1rem)}}
        `;
        document.head.appendChild(style);
    }

    function ensureModal() {
        if (document.getElementById('admin-pro-modal')) return;
        const modal = document.createElement('div');
        modal.id = 'admin-pro-modal';
        modal.className = 'admin-pro-modal';
        modal.innerHTML = `
            <div class="admin-pro-modal-card">
                <div class="admin-pro-modal-head">
                    <div>
                        <strong id="admin-pro-modal-title">إجراء إداري</strong>
                        <div id="admin-pro-modal-subtitle" class="admin-pro-subtitle"></div>
                    </div>
                    <button type="button" id="admin-pro-modal-close" class="btn-action danger"><i class="fas fa-xmark"></i> إغلاق</button>
                </div>
                <div id="admin-pro-modal-body" class="admin-pro-modal-body"></div>
                <div class="admin-pro-modal-foot">
                    <button type="button" id="admin-pro-modal-cancel" class="btn-ghost">إلغاء</button>
                    <button type="button" id="admin-pro-modal-confirm" class="btn-primary">حفظ</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        const close = () => closeProModal();
        modal.addEventListener('click', (event) => {
            if (event.target === modal) close();
        });
        document.getElementById('admin-pro-modal-close')?.addEventListener('click', close);
        document.getElementById('admin-pro-modal-cancel')?.addEventListener('click', close);
        document.getElementById('admin-pro-modal-confirm')?.addEventListener('click', async () => {
            const confirmButton = document.getElementById('admin-pro-modal-confirm');
            if (!proModalAction) {
                close();
                return;
            }
            confirmButton.disabled = true;
            try {
                const result = await proModalAction();
                if (result === false) return;
                close();
                alertToast('تم حفظ التغييرات المتقدمة بنجاح.');
            } finally {
                confirmButton.disabled = false;
            }
        });
    }

    function openProModal({ title, subtitle = '', bodyHtml = '', confirmLabel = 'حفظ', onConfirm = null }) {
        ensureModal();
        document.getElementById('admin-pro-modal-title').textContent = title;
        document.getElementById('admin-pro-modal-subtitle').textContent = subtitle;
        document.getElementById('admin-pro-modal-body').innerHTML = bodyHtml;
        document.getElementById('admin-pro-modal-confirm').textContent = confirmLabel;
        proModalAction = onConfirm;
        document.getElementById('admin-pro-modal').classList.add('is-open');
        document.getElementById('admin-pro-modal-body').scrollTop = 0;
    }

    function closeProModal() {
        document.getElementById('admin-pro-modal')?.classList.remove('is-open');
        proModalAction = null;
    }

    function ensureRestoreInput() {
        if (restoreInput) return restoreInput;
        restoreInput = document.createElement('input');
        restoreInput.type = 'file';
        restoreInput.accept = '.json,application/json';
        restoreInput.hidden = true;
        document.body.appendChild(restoreInput);
        return restoreInput;
    }

    function getNotificationRecord(sourceKey) {
        const raw = String(sourceKey || '');
        if (raw.startsWith('private::')) {
            const [, email, ...rest] = raw.split('::');
            const id = rest.join('::');
            const record = authApi.getPrivateNotifications(email).find((item) => item.id === id);
            if (!record) return null;
            return { ...record, audience: 'private', recipientEmail: email, sourceKey: raw };
        }
        const id = raw.replace(/^global::/, '');
        const record = store.getNotifications().find((item) => item.id === id);
        return record ? { ...record, audience: 'global', sourceKey: raw } : null;
    }

    function renderMiniStats(container, items) {
        container.innerHTML = items.map((item) => `
            <div class="admin-pro-stat-card">
                <span>${escapeHtml(item.label)}</span>
                <strong>${escapeHtml(item.value)}</strong>
            </div>
        `).join('');
    }

    function ensureAdvancedLayout() {
        const tabsContainer = document.getElementById('admin-tabs-container');
        const tabSelect = document.getElementById('admin-tab-select');
        const dashboardShell = document.querySelector('.admin-dashboard-shell');
        const commandSecondary = document.querySelector('.admin-command-secondary');
        if (!tabsContainer || !tabSelect || !dashboardShell) return;

        Object.entries(PRO_TABS).forEach(([tabId, meta]) => {
            if (!document.querySelector(`.admin-tab-btn[data-tab-target="${tabId}"]`)) {
                const button = document.createElement('button');
                button.className = 'admin-tab-btn';
                button.dataset.tabTarget = tabId;
                button.innerHTML = `<i class="fas ${meta.icon}"></i> ${meta.label}`;
                button.onclick = () => window.switchTab(tabId);
                tabsContainer.appendChild(button);
            }

            if (!tabSelect.querySelector(`option[value="${tabId}"]`)) {
                const option = document.createElement('option');
                option.value = tabId;
                option.textContent = meta.label;
                tabSelect.appendChild(option);
            }

            if (!document.getElementById(tabId)) {
                const section = document.createElement('div');
                section.id = tabId;
                section.className = 'admin-tab-content';
                section.innerHTML = `
                    <div class="content-card admin-section-card">
                        <div class="admin-toolbar">
                            <div class="admin-toolbar-copy">
                                <span class="mini-badge">${meta.label}</span>
                                <h3>${meta.label}</h3>
                                <p>مساحة إضافية متقدمة لإدارة ${meta.label} من نفس لوحة التحكم.</p>
                            </div>
                        </div>
                        <div id="${tabId}-content"></div>
                    </div>
                `;
                dashboardShell.appendChild(section);
            }
        });

        if (commandSecondary && !document.getElementById('admin-pro-actions')) {
            const actions = document.createElement('div');
            actions.id = 'admin-pro-actions';
            actions.className = 'admin-pro-actions';
            actions.innerHTML = `
                <button type="button" class="admin-pro-action" id="admin-export-active"><i class="fas fa-file-export"></i> تصدير القسم</button>
                <button type="button" class="admin-pro-action" id="admin-export-json"><i class="fas fa-database"></i> تصدير كامل</button>
                <button type="button" class="admin-pro-action" id="admin-backup-download"><i class="fas fa-download"></i> نسخة احتياطية</button>
                <button type="button" class="admin-pro-action" id="admin-backup-restore"><i class="fas fa-upload"></i> استعادة نسخة</button>
            `;
            commandSecondary.appendChild(actions);
        }

        const quickGrid = document.querySelector('.admin-quick-grid');
        if (quickGrid && !quickGrid.querySelector('[data-pro-link="activity"]')) {
            [
                { key: 'activity', icon: 'fa-clock-rotate-left', label: 'سجل النشاط', tab: 'activity-tab' },
                { key: 'archives', icon: 'fa-box-archive', label: 'الأرشيف', tab: 'archives-tab' }
            ].forEach((link) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'admin-quick-link';
                button.dataset.proLink = link.key;
                button.innerHTML = `<i class="fas ${link.icon}"></i><span>${link.label}</span>`;
                button.onclick = () => window.switchTab(link.tab);
                quickGrid.appendChild(button);
            });
        }
    }

    function applyPermissionVisibility() {
        const mapping = {
            'students-tab': canAccessStudents(),
            'withdrawals-tab': canAccessWithdrawals(),
            'users-tab': canAccessUsers(),
            'exams-tab': canAccessExams(),
            'support-tab': canAccessSupport(),
            'notifications-tab': canAccessNotifications(),
            'activity-tab': hasPermission('activity'),
            'archives-tab': hasPermission('archives')
        };

        Object.entries(mapping).forEach(([tabId, allowed]) => {
            document.querySelectorAll(`.admin-tab-btn[data-tab-target="${tabId}"]`).forEach((button) => {
                button.style.display = allowed ? '' : 'none';
            });
            const option = document.querySelector(`#admin-tab-select option[value="${tabId}"]`);
            if (option) {
                option.hidden = !allowed;
                option.disabled = !allowed;
            }
        });

        document.getElementById('admin-export-active')?.toggleAttribute('hidden', !hasPermission('exports'));
        document.getElementById('admin-export-json')?.toggleAttribute('hidden', !hasPermission('exports'));
        document.getElementById('admin-backup-download')?.toggleAttribute('hidden', !hasPermission('backups'));
        document.getElementById('admin-backup-restore')?.toggleAttribute('hidden', !hasPermission('backups'));
    }

    function getGlobalSearchQuery() {
        return document.getElementById('admin-global-search')?.value.trim() || '';
    }

    function getActivityDataset() {
        const content = document.getElementById('activity-tab-content');
        const search = content?.querySelector('[data-activity-search]')?.value.trim() || '';
        const area = content?.querySelector('[data-activity-area]')?.value || 'all';
        const globalSearch = getGlobalSearchQuery();
        const logs = advancedStore.getActivityLogs();
        const filtered = logs.filter((item) => {
            if (area !== 'all' && item.area !== area) return false;
            if (!matchesSearch([item.summary, item.actorName, item.actorEmail, item.area, item.targetType, item.targetId], globalSearch)) return false;
            return matchesSearch([item.summary, item.actorName, item.actorEmail, item.area, item.targetType, item.targetId], search);
        });
        return { all: logs, filtered };
    }

    function getArchiveDataset() {
        const content = document.getElementById('archives-tab-content');
        const search = content?.querySelector('[data-archive-search]')?.value.trim() || '';
        const type = content?.querySelector('[data-archive-type]')?.value || 'all';
        const globalSearch = getGlobalSearchQuery();
        const archives = advancedStore.getArchives();
        const filtered = archives.filter((item) => {
            if (type !== 'all' && item.type !== type) return false;
            if (!matchesSearch([item.title, item.description, item.type, item.actorName, item.sourceId], globalSearch)) return false;
            return matchesSearch([item.title, item.description, item.type, item.actorName, item.sourceId], search);
        });
        return { all: archives, filtered };
    }

    function bindAdvancedFilters() {
        document.querySelectorAll('[data-activity-search], [data-activity-area]').forEach((element) => {
            if (element.dataset.bound === 'true') return;
            element.addEventListener(element.tagName === 'SELECT' ? 'change' : 'input', () => renderActivityTab());
            element.dataset.bound = 'true';
        });
        document.querySelectorAll('[data-archive-search], [data-archive-type]').forEach((element) => {
            if (element.dataset.bound === 'true') return;
            element.addEventListener(element.tagName === 'SELECT' ? 'change' : 'input', () => renderArchivesTab());
            element.dataset.bound = 'true';
        });
    }

    function renderActivityTab() {
        const target = document.getElementById('activity-tab-content');
        if (!target) return;
        if (!hasPermission('activity')) {
            target.innerHTML = `<div class="admin-pro-empty">هذه المساحة غير متاحة لهذا الحساب.</div>`;
            return;
        }
        const currentSearch = target.querySelector('[data-activity-search]')?.value || '';
        const currentArea = target.querySelector('[data-activity-area]')?.value || 'all';
        const { all, filtered } = getActivityDataset();
        const areas = Array.from(new Set(all.map((item) => item.area))).sort();
        target.innerHTML = `
            <div class="admin-pro-toolbar">
                <label class="admin-search-field">
                    <i class="fas fa-magnifying-glass"></i>
                    <input type="search" data-activity-search placeholder="بحث في السجل..." value="${escapeHtml(currentSearch)}">
                </label>
                <select class="admin-select" data-activity-area>
                    <option value="all">كل الأقسام</option>
                    ${areas.map((area) => `<option value="${escapeHtml(area)}">${escapeHtml(area)}</option>`).join('')}
                </select>
                <button type="button" class="admin-pro-action" onclick="clearAdminActivityLogs()"><i class="fas fa-eraser"></i> تفريغ السجل</button>
            </div>
            <div class="admin-pro-stat-grid" id="activity-stats"></div>
            <div class="admin-pro-grid">
                ${filtered.length ? filtered.map((item) => `
                    <div class="admin-pro-log-card">
                        <div class="admin-pro-log-meta">
                            <strong>${escapeHtml(item.summary)}</strong>
                            <span>${escapeHtml(formatDate(item.createdAt))}</span>
                        </div>
                        <div class="admin-pro-pill-row">
                            <span class="admin-pro-pill">${escapeHtml(item.area)}</span>
                            <span class="admin-pro-pill is-muted">${escapeHtml(item.action)}</span>
                            <span class="admin-pro-pill is-muted">${escapeHtml(item.targetType)}</span>
                        </div>
                        <div class="admin-pro-kv">
                            <p><span>بواسطة</span><strong>${escapeHtml(item.actorName || item.actorEmail || '--')}</strong></p>
                            <p><span>المعرف</span><strong>${escapeHtml(item.targetId || '--')}</strong></p>
                        </div>
                    </div>
                `).join('') : '<div class="admin-pro-empty">لا توجد عناصر مطابقة في سجل النشاط.</div>'}
            </div>
        `;
        target.querySelector('[data-activity-area]').value = currentArea;
        renderMiniStats(document.getElementById('activity-stats'), [
            { label: 'كل السجلات', value: all.length },
            { label: 'المعروض الآن', value: filtered.length },
            { label: 'تنبيهات', value: all.filter((item) => item.area === 'notifications').length },
            { label: 'ماليات', value: all.filter((item) => item.area === 'withdrawals').length },
            { label: 'دعم', value: all.filter((item) => item.area === 'support').length }
        ]);
        bindAdvancedFilters();
    }

    function renderArchivesTab() {
        const target = document.getElementById('archives-tab-content');
        if (!target) return;
        if (!hasPermission('archives')) {
            target.innerHTML = `<div class="admin-pro-empty">هذه المساحة غير متاحة لهذا الحساب.</div>`;
            return;
        }
        const currentSearch = target.querySelector('[data-archive-search]')?.value || '';
        const currentType = target.querySelector('[data-archive-type]')?.value || 'all';
        const { all, filtered } = getArchiveDataset();
        const types = Array.from(new Set(all.map((item) => item.type))).sort();
        target.innerHTML = `
            <div class="admin-pro-toolbar">
                <label class="admin-search-field">
                    <i class="fas fa-magnifying-glass"></i>
                    <input type="search" data-archive-search placeholder="بحث في الأرشيف..." value="${escapeHtml(currentSearch)}">
                </label>
                <select class="admin-select" data-archive-type>
                    <option value="all">كل الأنواع</option>
                    ${types.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join('')}
                </select>
            </div>
            <div class="admin-pro-stat-grid" id="archive-stats"></div>
            <div class="admin-pro-grid">
                ${filtered.length ? filtered.map((item) => `
                    <div class="admin-pro-log-card">
                        <div class="admin-pro-log-meta">
                            <strong>${escapeHtml(item.title)}</strong>
                            <span>${escapeHtml(formatDate(item.createdAt))}</span>
                        </div>
                        <div class="admin-pro-pill-row">
                            <span class="admin-pro-pill">${escapeHtml(item.type)}</span>
                            <span class="admin-pro-pill is-muted">${escapeHtml(item.actorName || item.actorEmail || '--')}</span>
                        </div>
                        <div class="admin-pro-kv">
                            <p><span>الوصف</span><strong>${escapeHtml(item.description || '--')}</strong></p>
                            <p><span>المرجع</span><strong>${escapeHtml(item.sourceId || '--')}</strong></p>
                        </div>
                        <div class="admin-pro-inline-actions">
                            <button type="button" onclick="restoreArchiveItem('${encodeValue(item.id)}')"><i class="fas fa-rotate-left"></i> استعادة</button>
                            <button type="button" class="danger" onclick="deleteArchiveItemForever('${encodeValue(item.id)}')"><i class="fas fa-trash"></i> حذف</button>
                        </div>
                    </div>
                `).join('') : '<div class="admin-pro-empty">لا توجد عناصر داخل الأرشيف حاليًا.</div>'}
            </div>
        `;
        target.querySelector('[data-archive-type]').value = currentType;
        renderMiniStats(document.getElementById('archive-stats'), [
            { label: 'كل العناصر', value: all.length },
            { label: 'المعروض الآن', value: filtered.length },
            { label: 'طلبات', value: all.filter((item) => item.type === 'application').length },
            { label: 'دعم', value: all.filter((item) => item.type === 'support_thread').length },
            { label: 'ملفات', value: all.filter((item) => item.type === 'student_file').length }
        ]);
        bindAdvancedFilters();
    }

    function updateProOverview(tabId) {
        const labelEl = document.getElementById('admin-active-tab-label');
        const statusEl = document.getElementById('admin-search-status');
        const overviewEl = document.getElementById('admin-overview-strip');
        if (!labelEl || !statusEl || !overviewEl) return;
        if (tabId === 'activity-tab') {
            const dataset = getActivityDataset();
            labelEl.textContent = PRO_TABS[tabId].label;
            statusEl.textContent = `القسم الحالي: ${PRO_TABS[tabId].label} | المعروض الآن: ${dataset.filtered.length} من ${dataset.all.length} | بحث عام: ${getGlobalSearchQuery() || 'بدون'}`;
            renderMiniStats(overviewEl, [
                { label: 'القسم', value: PRO_TABS[tabId].label },
                { label: 'كل السجلات', value: dataset.all.length },
                { label: 'المعروض', value: dataset.filtered.length },
                { label: 'آخر ساعة', value: dataset.all.filter((item) => Date.now() - new Date(item.createdAt || 0).getTime() < 3600000).length }
            ]);
            return;
        }
        if (tabId === 'archives-tab') {
            const dataset = getArchiveDataset();
            labelEl.textContent = PRO_TABS[tabId].label;
            statusEl.textContent = `القسم الحالي: ${PRO_TABS[tabId].label} | المعروض الآن: ${dataset.filtered.length} من ${dataset.all.length} | بحث عام: ${getGlobalSearchQuery() || 'بدون'}`;
            renderMiniStats(overviewEl, [
                { label: 'القسم', value: PRO_TABS[tabId].label },
                { label: 'كل العناصر', value: dataset.all.length },
                { label: 'طلبات', value: dataset.all.filter((item) => item.type === 'application').length },
                { label: 'دعم', value: dataset.all.filter((item) => item.type === 'support_thread').length }
            ]);
        }
    }

    function renderProTab(tabId) {
        if (tabId === 'activity-tab') {
            renderActivityTab();
            updateProOverview(tabId);
        } else if (tabId === 'archives-tab') {
            renderArchivesTab();
            updateProOverview(tabId);
        }
    }

    function activateProTab(tabId) {
        activeProTab = tabId;
        document.querySelectorAll('.admin-tab-content').forEach((content) => {
            content.classList.toggle('active', content.id === tabId);
        });
        document.querySelectorAll('.admin-tab-btn').forEach((button) => {
            button.classList.toggle('active', button.dataset.tabTarget === tabId);
        });
        const tabSelect = document.getElementById('admin-tab-select');
        if (tabSelect) tabSelect.value = tabId;
        renderProTab(tabId);
    }

    const nativeSwitchTab = window.switchTab;
    if (typeof nativeSwitchTab === 'function') {
        window.switchTab = function patchedSwitchTab(tabId, event) {
            if (PRO_TABS[tabId]) {
                activateProTab(tabId);
                return;
            }
            activeProTab = '';
            nativeSwitchTab(tabId, event);
            window.requestAnimationFrame(() => {
                enhanceRenderedCards();
                applyPermissionVisibility();
            });
        };
    }

    function buildCsv(rows) {
        if (!rows.length) return '';
        const headers = Object.keys(rows[0]);
        const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
        return [
            headers.map(escape).join(','),
            ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))
        ].join('\r\n');
    }

    function downloadFile(fileName, content, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    function getExportRowsForActiveSection() {
        const activeId = activeProTab || document.querySelector('.admin-tab-content.active')?.id || 'students-tab';
        if (activeId === 'students-tab') {
            return store.getAllApplications().map((item) => ({
                requestId: item.requestId,
                name: item.name,
                nationalId: item.nationalId,
                status: item.status,
                governorate: item.governorate,
                city: item.city,
                village: item.village,
                leaderCode: item.leaderCode
            }));
        }
        if (activeId === 'withdrawals-tab') {
            return authApi.getAllTransactions().map((item) => ({
                txId: item.txId,
                email: item.email,
                userName: item.userName,
                amount: item.amount,
                status: item.status,
                method: item.method,
                createdAt: item.createdAt,
                resolvedAt: item.resolvedAt
            }));
        }
        if (activeId === 'users-tab') {
            return authApi.getAllUsers().map((item) => ({
                email: item.email,
                name: item.name,
                role: item.role,
                managementRole: authApi.getManagementRole?.(item),
                leaderCode: item.leaderCode,
                balance: item.balance,
                suspended: item.isSuspended,
                examAllowed: item.examAllowed
            }));
        }
        if (activeId === 'support-tab') {
            return store.getSupportThreads().map((item) => ({
                email: item.email,
                userName: item.userName,
                status: item.status,
                unreadByAdmin: item.unreadByAdmin,
                unreadByUser: item.unreadByUser,
                updatedAt: item.updatedAt
            }));
        }
        if (activeId === 'notifications-tab') {
            const privateRows = authApi.getAllUsers().flatMap((user) => authApi.getPrivateNotifications(user.email).map((note) => ({
                id: note.id,
                audience: 'private',
                recipient: user.email,
                title: note.title,
                type: note.type,
                sticky: note.sticky,
                updatedAt: note.updatedAt
            })));
            return [
                ...store.getNotifications().map((note) => ({
                    id: note.id,
                    audience: 'global',
                    recipient: '',
                    title: note.title,
                    type: note.type,
                    sticky: note.sticky,
                    updatedAt: note.updatedAt
                })),
                ...privateRows
            ];
        }
        if (activeId === 'activity-tab') {
            return advancedStore.getActivityLogs().map((item) => ({
                id: item.id,
                actor: item.actorName || item.actorEmail,
                area: item.area,
                action: item.action,
                targetType: item.targetType,
                targetId: item.targetId,
                summary: item.summary,
                createdAt: item.createdAt
            }));
        }
        if (activeId === 'archives-tab') {
            return advancedStore.getArchives().map((item) => ({
                id: item.id,
                type: item.type,
                title: item.title,
                description: item.description,
                sourceId: item.sourceId,
                actor: item.actorName || item.actorEmail,
                createdAt: item.createdAt
            }));
        }
        return [];
    }

    function buildBackupPayload() {
        return {
            version: 1,
            exportedAt: new Date().toISOString(),
            exportedBy: session.email,
            platform: store.getStateSnapshot?.() || {},
            auth: {
                users: authApi.getAllUsersRaw?.() || [],
                transactions: authApi.getAllTransactions?.() || []
            },
            advanced: advancedStore.getStateSnapshot?.() || {}
        };
    }

    async function restoreBackupPayload(payload) {
        if (!payload || typeof payload !== 'object') {
            throw new Error('ملف النسخة الاحتياطية غير صالح.');
        }
        if (payload.platform) {
            store.replacePlatformState?.(payload.platform, { skipNotify: true });
        }
        if (payload.auth?.users) {
            authApi.writeUsers?.(payload.auth.users);
        }
        if (payload.auth?.transactions) {
            authApi.writeTransactions?.(payload.auth.transactions);
        }
        if (payload.advanced) {
            advancedStore.replaceState?.(payload.advanced, { skipNotify: true });
        }
        await syncEverything();
        await refreshEverything(true);
    }

    function logAdminAction({ area, action, targetType, targetId, summary, details = {} }) {
        advancedStore.addActivityLog({
            actorEmail: session.email,
            actorName: session.name,
            area,
            action,
            targetType,
            targetId,
            summary,
            details
        });
    }

    function getRequestIdFromCard(card) {
        const text = card.querySelector('.card-header .user-info span')?.textContent || '';
        return normalizeText(text.split('-')[0]);
    }

    function getSupportEmailFromCard(card) {
        const text = card.querySelector('.card-header .user-info span')?.textContent || '';
        const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
        return match ? match[0] : '';
    }

    function getUserEmailFromCard(card) {
        return normalizeText(card.querySelector('.card-header .user-info span')?.textContent || '');
    }

    function parsePermissions(raw) {
        return String(raw || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
    }

    function readDateTimeInput(id) {
        const raw = document.getElementById(id)?.value.trim();
        if (!raw) return '';
        const date = new Date(raw);
        return Number.isNaN(date.getTime()) ? '' : date.toISOString();
    }

    function readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(reader.error || new Error('file_read_error'));
            reader.readAsDataURL(file);
        });
    }

    function reopenStudentFilesCenter(requestId) {
        window.setTimeout(() => window.openStudentFilesCenter(encodeValue(requestId)), 0);
    }

    function buildUserFormHtml(user = null) {
        const current = user || {};
        const managementRole = authApi.getManagementRole?.(current) || 'user';
        const permissions = Array.isArray(current.permissions) ? current.permissions.join(', ') : '';
        return `
            <div class="admin-pro-form-grid">
                <div class="admin-pro-form-group"><label>البريد الإلكتروني</label><input class="form-control" id="pro-user-email" type="email" value="${escapeHtml(current.email || '')}"></div>
                <div class="admin-pro-form-group"><label>الاسم الكامل</label><input class="form-control" id="pro-user-name" type="text" value="${escapeHtml(current.name || '')}"></div>
                <div class="admin-pro-form-group"><label>كلمة مرور الدخول</label><input class="form-control" id="pro-user-password" type="text" value="${escapeHtml(current.password || '123456')}"></div>
                <div class="admin-pro-form-group"><label>كلمة مرور السحب</label><input class="form-control" id="pro-user-withdraw" type="text" value="${escapeHtml(current.withdrawalPassword || 'SPEED')}"></div>
                <div class="admin-pro-form-group"><label>الدور النصي</label><input class="form-control" id="pro-user-role" type="text" value="${escapeHtml(current.role || 'طالب المنصة')}"></div>
                <div class="admin-pro-form-group"><label>نوع الحساب</label><select class="form-control" id="pro-user-account-type"><option value="platform">منصة عادي</option><option value="admin">إداري</option><option value="leader">قائد</option><option value="exam_student">طالب امتحان</option></select></div>
                <div class="admin-pro-form-group"><label>الإدارة الدقيقة</label><select class="form-control" id="pro-user-management-role"><option value="super_admin">مدير عام</option><option value="operations_admin">تشغيل</option><option value="finance_admin">ماليات</option><option value="support_admin">دعم</option><option value="exam_admin">امتحانات</option><option value="leader">قائد</option><option value="user">مستخدم عادي</option><option value="exam_student">طالب امتحان</option></select></div>
                <div class="admin-pro-form-group"><label>صلاحيات إضافية</label><input class="form-control" id="pro-user-permissions" type="text" value="${escapeHtml(permissions)}" placeholder="notifications, exports"><small>قائمة مفصولة بفواصل عند الحاجة.</small></div>
                <div class="admin-pro-form-group"><label>كود القائد</label><input class="form-control" id="pro-user-leader-code" type="text" value="${escapeHtml(current.leaderCode || '')}"></div>
                <div class="admin-pro-form-group"><label>المحافظة</label><input class="form-control" id="pro-user-governorate" type="text" value="${escapeHtml(current.governorate || 'بني سويف')}"></div>
                <div class="admin-pro-form-group"><label>المركز</label><input class="form-control" id="pro-user-city" type="text" value="${escapeHtml(current.city || '')}"></div>
                <div class="admin-pro-form-group"><label>القرية</label><input class="form-control" id="pro-user-village" type="text" value="${escapeHtml(current.village || '')}"></div>
                <div class="admin-pro-form-group"><label>الرصيد</label><input class="form-control" id="pro-user-balance" type="number" value="${escapeHtml(current.balance || 0)}"></div>
                <div class="admin-pro-form-group full"><div class="admin-pro-inline-actions"><label><input type="checkbox" id="pro-user-exam-allowed" ${current.examAllowed !== false ? 'checked' : ''}> السماح بالامتحان</label><label><input type="checkbox" id="pro-user-wallet-enabled" ${current.walletEnabled !== false ? 'checked' : ''}> إظهار المحفظة</label><label><input type="checkbox" id="pro-user-withdrawals-enabled" ${current.withdrawalsEnabled !== false ? 'checked' : ''}> فتح السحب</label><label><input type="checkbox" id="pro-user-private-notes" ${current.privateNotificationsEnabled !== false ? 'checked' : ''}> إشعارات خاصة</label></div></div>
                <div class="admin-pro-form-group full"><label>رسالة قفل السحب</label><textarea class="form-control" id="pro-user-withdrawal-lock-message" rows="3" placeholder="تظهر للمستخدم عند قفل السحب">${escapeHtml(current.withdrawalLockMessage || '')}</textarea></div>
            </div>
        `;
    }

    function buildNotificationFormHtml(note = {}) {
        return `
            <div class="admin-pro-form-grid">
                <div class="admin-pro-form-group"><label>العنوان</label><input class="form-control" id="pro-note-title" type="text" value="${escapeHtml(note.title || '')}"></div>
                <div class="admin-pro-form-group"><label>النوع</label><select class="form-control" id="pro-note-type"><option value="update">تحديث</option><option value="application">طلبات</option><option value="exam">امتحانات</option><option value="finance">ماليات</option><option value="support">دعم</option></select></div>
                <div class="admin-pro-form-group"><label>نمط العرض</label><select class="form-control" id="pro-note-display"><option value="feed">داخل القائمة</option><option value="floating">عائم</option><option value="banner">شريط ثابت</option></select></div>
                <div class="admin-pro-form-group"><label>نوع الإشعار</label><select class="form-control" id="pro-note-sticky"><option value="false">عادي</option><option value="true">ثابت</option></select></div>
                <div class="admin-pro-form-group"><label>بداية الظهور</label><input class="form-control" id="pro-note-start" type="datetime-local" value="${note.startAt ? new Date(note.startAt).toISOString().slice(0, 16) : ''}"></div>
                <div class="admin-pro-form-group"><label>نهاية الظهور</label><input class="form-control" id="pro-note-end" type="datetime-local" value="${note.endAt ? new Date(note.endAt).toISOString().slice(0, 16) : ''}"></div>
                <div class="admin-pro-form-group full"><label>النص</label><textarea class="form-control" id="pro-note-body" rows="7">${escapeHtml(note.body || '')}</textarea></div>
                <div class="admin-pro-form-group"><label>الرابط</label><input class="form-control" id="pro-note-url" type="text" value="${escapeHtml(note.actionUrl || '')}"></div>
                <div class="admin-pro-form-group"><label>نص الزر</label><input class="form-control" id="pro-note-label" type="text" value="${escapeHtml(note.actionLabel || '')}"></div>
            </div>
        `;
    }

    function enhanceStudentCards() {
        if (!hasPermission('student_files') && !hasPermission('archives')) return;
        document.querySelectorAll('#students-list .admin-card').forEach((card) => {
            const requestId = getRequestIdFromCard(card);
            const body = card.querySelector('.card-body');
            const actions = card.querySelector('.card-actions');
            if (!requestId || !body || !actions) return;

            if (hasPermission('student_files') && !actions.querySelector(`[data-pro-action="files-${requestId}"]`)) {
                const button = document.createElement('button');
                button.className = 'btn-action';
                button.dataset.proAction = `files-${requestId}`;
                button.innerHTML = '<i class="fas fa-folder-open"></i> الملفات';
                button.onclick = () => window.openStudentFilesCenter(encodeValue(requestId));
                actions.appendChild(button);
            }

            if (hasPermission('archives') && !actions.querySelector(`[data-pro-action="archive-${requestId}"]`)) {
                const button = document.createElement('button');
                button.className = 'btn-action';
                button.dataset.proAction = `archive-${requestId}`;
                button.innerHTML = '<i class="fas fa-box-archive"></i> أرشفة';
                button.onclick = () => window.archiveApplicationSnapshot(encodeValue(requestId));
                actions.appendChild(button);
            }

            let chip = body.querySelector('.admin-pro-role-chip');
            if (!chip) {
                chip = document.createElement('div');
                chip.className = 'admin-pro-role-chip';
                body.appendChild(chip);
            }
            chip.innerHTML = `<i class="fas fa-folder-tree"></i> ملفات الطالب: ${advancedStore.getStudentFiles(requestId).length}`;
        });
    }

    function enhanceSupportCards() {
        if (!hasPermission('archives')) return;
        document.querySelectorAll('#support-inbox-list .admin-card').forEach((card) => {
            const email = getSupportEmailFromCard(card);
            const actions = card.querySelector('.card-actions');
            if (!email || !actions || actions.querySelector(`[data-pro-action="support-archive-${email}"]`)) return;
            const button = document.createElement('button');
            button.className = 'btn-action';
            button.dataset.proAction = `support-archive-${email}`;
            button.innerHTML = '<i class="fas fa-box-archive"></i> أرشفة';
            button.onclick = () => window.archiveSupportThread(encodeValue(email));
            actions.appendChild(button);
        });
    }

    function enhanceUserCards() {
        if (!canAccessUsers()) return;
        document.querySelectorAll('#all-users-list .admin-card').forEach((card) => {
            const email = getUserEmailFromCard(card);
            const body = card.querySelector('.card-body');
            const actions = card.querySelector('.card-actions');
            const user = authApi.getUserByEmail(email);
            if (!email || !body || !actions || !user) return;

            let roleLine = body.querySelector('[data-pro-management-role]');
            if (!roleLine) {
                roleLine = document.createElement('p');
                roleLine.dataset.proManagementRole = 'true';
                body.appendChild(roleLine);
            }
            const nextRoleHtml = `<span>الإدارة الدقيقة</span><strong>${escapeHtml(getRoleBadgeLabel(user))}</strong>`;
            if (roleLine.innerHTML !== nextRoleHtml) {
                roleLine.innerHTML = nextRoleHtml;
            }

            if (isSuperAdmin() && !actions.querySelector(`[data-pro-action="permissions-${email}"]`)) {
                const button = document.createElement('button');
                button.className = 'btn-action';
                button.dataset.proAction = `permissions-${email}`;
                button.innerHTML = '<i class="fas fa-shield-halved"></i> صلاحيات';
                button.onclick = () => window.editUserPermissions(encodeValue(email));
                actions.appendChild(button);
            }

            if (hasPermission('archives') && !actions.querySelector(`[data-pro-action="archive-user-${email}"]`)) {
                const button = document.createElement('button');
                button.className = 'btn-action';
                button.dataset.proAction = `archive-user-${email}`;
                button.innerHTML = '<i class="fas fa-box-archive"></i> أرشفة';
                button.onclick = () => window.archiveUserSnapshot(encodeValue(email));
                actions.appendChild(button);
            }
        });
    }

    function enhanceRenderedCards() {
        ensureAdvancedLayout();
        applyPermissionVisibility();
        enhanceStudentCards();
        enhanceSupportCards();
        enhanceUserCards();
        if (activeProTab) {
            renderProTab(activeProTab);
        }
    }

    function scheduleEnhancement() {
        if (enhancementFrameQueued) return;
        enhancementFrameQueued = true;
        window.requestAnimationFrame(() => {
            enhancementFrameQueued = false;
            enhanceRenderedCards();
            observeRenderedLists();
        });
    }

    function observeRenderedList(element) {
        if (!element || observedMutationRoots.has(element)) return;
        const observer = new MutationObserver(() => {
            scheduleEnhancement();
        });
        observer.observe(element, { childList: true });
        observedMutationRoots.add(element);
    }

    function observeRenderedLists() {
        observeRenderedList(document.getElementById('all-users-list'));
        observeRenderedList(document.getElementById('students-list'));
        observeRenderedList(document.getElementById('support-inbox-list'));
    }

    window.showAddUserModal = () => {
        if (!canAccessUsers()) return alertToast('هذه الصلاحية غير متاحة لهذا الحساب.');
        openProModal({
            title: 'إضافة مستخدم جديد',
            subtitle: 'إنشاء حساب جديد مع نوع حساب وصلاحيات إدارية دقيقة عند الحاجة.',
            bodyHtml: buildUserFormHtml(),
            confirmLabel: 'إضافة المستخدم',
            onConfirm: async () => {
                const email = document.getElementById('pro-user-email')?.value.trim();
                const managementRole = document.getElementById('pro-user-management-role')?.value || 'user';
                const accountType = document.getElementById('pro-user-account-type')?.value || 'platform';
                const result = authApi.addUser({
                    email,
                    name: document.getElementById('pro-user-name')?.value.trim() || email,
                    password: document.getElementById('pro-user-password')?.value.trim() || '123456',
                    withdrawalPassword: document.getElementById('pro-user-withdraw')?.value.trim() || 'SPEED',
                    role: document.getElementById('pro-user-role')?.value.trim() || 'طالب المنصة',
                    accountType,
                    managementRole,
                    permissions: parsePermissions(document.getElementById('pro-user-permissions')?.value),
                    leaderCode: document.getElementById('pro-user-leader-code')?.value.trim() || '',
                    governorate: document.getElementById('pro-user-governorate')?.value.trim() || 'بني سويف',
                    city: document.getElementById('pro-user-city')?.value.trim() || '',
                    village: document.getElementById('pro-user-village')?.value.trim() || '',
                    balance: Number(document.getElementById('pro-user-balance')?.value || 0),
                    examAllowed: document.getElementById('pro-user-exam-allowed')?.checked,
                    walletEnabled: document.getElementById('pro-user-wallet-enabled')?.checked,
                    withdrawalsEnabled: document.getElementById('pro-user-withdrawals-enabled')?.checked,
                    withdrawalLockMessage: document.getElementById('pro-user-withdrawal-lock-message')?.value.trim() || '',
                    privateNotificationsEnabled: document.getElementById('pro-user-private-notes')?.checked,
                    isLeader: managementRole === 'leader'
                });
                if (!result.ok) {
                    alertToast(result.message);
                    return false;
                }
                logAdminAction({ area: 'users', action: 'create', targetType: 'user', targetId: email, summary: `تم إنشاء المستخدم ${email}.` });
                await syncEverything();
                await refreshEverything(true);
            }
        });
        document.getElementById('pro-user-account-type').value = 'platform';
        document.getElementById('pro-user-management-role').value = 'user';
    };

    window.editUser = (encodedEmail) => {
        if (!canAccessUsers()) return alertToast('هذه الصلاحية غير متاحة لهذا الحساب.');
        const email = decodeValue(encodedEmail);
        const user = authApi.getUserByEmail(email);
        if (!user) return;
        openProModal({
            title: 'تعديل بيانات المستخدم',
            subtitle: user.email,
            bodyHtml: buildUserFormHtml(user),
            confirmLabel: 'حفظ التعديلات',
            onConfirm: async () => {
                const nextEmail = document.getElementById('pro-user-email')?.value.trim() || user.email;
                const managementRole = document.getElementById('pro-user-management-role')?.value || authApi.getManagementRole?.(user) || 'user';
                const result = authApi.updateUserPersistentData(email, {
                    email: nextEmail,
                    name: document.getElementById('pro-user-name')?.value.trim() || user.name,
                    password: document.getElementById('pro-user-password')?.value.trim() || user.password,
                    withdrawalPassword: document.getElementById('pro-user-withdraw')?.value.trim() || user.withdrawalPassword,
                    role: document.getElementById('pro-user-role')?.value.trim() || user.role,
                    accountType: document.getElementById('pro-user-account-type')?.value || user.accountType,
                    managementRole,
                    permissions: parsePermissions(document.getElementById('pro-user-permissions')?.value),
                    leaderCode: document.getElementById('pro-user-leader-code')?.value.trim() || user.leaderCode || '',
                    governorate: document.getElementById('pro-user-governorate')?.value.trim() || user.governorate || 'بني سويف',
                    city: document.getElementById('pro-user-city')?.value.trim() || user.city || '',
                    village: document.getElementById('pro-user-village')?.value.trim() || user.village || '',
                    balance: Number(document.getElementById('pro-user-balance')?.value || user.balance || 0),
                    examAllowed: document.getElementById('pro-user-exam-allowed')?.checked,
                    walletEnabled: document.getElementById('pro-user-wallet-enabled')?.checked,
                    withdrawalsEnabled: document.getElementById('pro-user-withdrawals-enabled')?.checked,
                    withdrawalLockMessage: document.getElementById('pro-user-withdrawal-lock-message')?.value.trim() || '',
                    privateNotificationsEnabled: document.getElementById('pro-user-private-notes')?.checked,
                    isLeader: managementRole === 'leader'
                });
                if (!result.ok) {
                    alertToast(result.message);
                    return false;
                }
                await authApi.pushPrivateNotification?.(nextEmail, {
                    title: 'تحديث بيانات الحساب',
                    body: 'تم تحديث بعض بيانات حسابك من الإدارة. يرجى مراجعة التنبيهات أو بيانات الحساب.',
                    type: 'update',
                    displayMode: 'floating',
                    sticky: false,
                    actionUrl: './notifications.html',
                    actionLabel: 'فتح التنبيهات'
                });
                logAdminAction({ area: 'users', action: 'update', targetType: 'user', targetId: nextEmail, summary: `تم تحديث بيانات المستخدم ${nextEmail}.` });
                await syncEverything();
                await refreshEverything(true);
            }
        });
        document.getElementById('pro-user-account-type').value = user.accountType || 'platform';
        document.getElementById('pro-user-management-role').value = authApi.getManagementRole?.(user) || 'user';
    };

    window.editUserPermissions = (encodedEmail) => {
        const email = decodeValue(encodedEmail);
        const user = authApi.getUserByEmail(email);
        if (!user || !isSuperAdmin()) return;
        openProModal({
            title: 'ضبط الصلاحيات الدقيقة',
            subtitle: user.email,
            bodyHtml: `<div class="admin-pro-form-grid"><div class="admin-pro-form-group"><label>الإدارة الدقيقة</label><select class="form-control" id="pro-permission-role"><option value="super_admin">مدير عام</option><option value="operations_admin">تشغيل</option><option value="finance_admin">ماليات</option><option value="support_admin">دعم</option><option value="exam_admin">امتحانات</option><option value="leader">قائد</option><option value="user">مستخدم عادي</option><option value="exam_student">طالب امتحان</option></select></div><div class="admin-pro-form-group"><label>صلاحيات إضافية</label><input class="form-control" id="pro-permission-extra" type="text" value="${escapeHtml(Array.isArray(user.permissions) ? user.permissions.join(', ') : '')}" placeholder="exports, activity"></div></div>`,
            confirmLabel: 'حفظ الصلاحيات',
            onConfirm: async () => {
                const nextManagementRole = document.getElementById('pro-permission-role')?.value || authApi.getManagementRole?.(user) || 'user';
                const nextPermissions = parsePermissions(document.getElementById('pro-permission-extra')?.value);
                const nextRoleLabel = getManagementRoleDisplay(nextManagementRole);
                const result = authApi.updateUserPersistentData(email, buildPermissionUpdatePayload(user, nextManagementRole, nextPermissions));
                if (!result.ok) {
                    alertToast(result.message);
                    return false;
                }

                await authApi.pushPrivateNotification?.(email, {
                    title: 'تحديث صلاحيات الحساب',
                    body: `تم تحديث صلاحية حسابك إلى ${nextRoleLabel}. تم تطبيق الوصول الجديد مباشرة على حسابك.`,
                    type: 'update',
                    displayMode: 'floating',
                    sticky: true,
                    actionUrl: './notifications.html',
                    actionLabel: 'فتح التنبيهات'
                });

                logAdminAction({ area: 'users', action: 'permissions', targetType: 'user', targetId: email, summary: `تم تحديث صلاحيات المستخدم ${email}.` });
                await syncEverything();
                await refreshEverything(true);
            }
        });
        document.getElementById('pro-permission-role').value = authApi.getManagementRole?.(user) || 'user';
    };

    window.replySupportThread = (encodedEmail) => {
        if (!canAccessSupport()) return alertToast('هذه الصلاحية غير متاحة لهذا الحساب.');
        const email = decodeValue(encodedEmail);
        const thread = store.getSupportThreadByEmail?.(email);
        if (!thread) return;
        openProModal({
            title: `الرد على ${thread.userName || thread.email}`,
            subtitle: 'يمكن استخدام رد سريع أو كتابة رسالة جديدة بالكامل.',
            bodyHtml: `<div class="admin-pro-form-grid"><div class="admin-pro-form-group full"><label>ردود سريعة</label><div class="admin-pro-quick-replies">${SUPPORT_QUICK_REPLIES.map((item) => `<button type="button" data-support-quick="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join('')}</div></div><div class="admin-pro-form-group full"><label>الرسالة</label><textarea class="form-control" id="pro-support-reply-text" rows="8" placeholder="اكتب الرد هنا"></textarea></div></div>`,
            confirmLabel: 'إرسال الرد',
            onConfirm: async () => {
                const text = document.getElementById('pro-support-reply-text')?.value.trim();
                if (!text) {
                    alertToast('اكتب الرد أولًا.');
                    return false;
                }
                store.sendSupportMessage({ email, userName: thread.userName, role: thread.role, sender: 'admin', senderName: session.name, text }, { silent: true });
                store.markSupportThreadRead?.(email, 'admin', { silent: true });
                store.updateSupportThreadStatus?.(email, 'open', { silent: true });
                authApi.pushPrivateNotification?.(email, { title: 'رد جديد من الدعم الإداري', body: text, type: 'support', actionUrl: './notifications.html', actionLabel: 'فتح الإشعارات', displayMode: 'feed', sticky: false });
                logAdminAction({ area: 'support', action: 'reply', targetType: 'support_thread', targetId: email, summary: `تم إرسال رد دعم إلى ${email}.` });
                await syncEverything();
                await refreshEverything(true);
            }
        });
        document.querySelectorAll('[data-support-quick]').forEach((button) => {
            button.addEventListener('click', () => {
                const textarea = document.getElementById('pro-support-reply-text');
                if (textarea) textarea.value = button.dataset.supportQuick || '';
            });
        });
    };

    window.createPlatformNotification = () => {
        if (!canAccessNotifications()) return alertToast('هذه الصلاحية غير متاحة لهذا الحساب.');
        openProModal({
            title: 'إنشاء إشعار عام',
            subtitle: 'يدعم الجدولة ونمط العرض والثبات.',
            bodyHtml: buildNotificationFormHtml({ title: 'إشعار جديد', type: 'update', displayMode: 'feed' }),
            confirmLabel: 'نشر الإشعار',
            onConfirm: async () => {
                const notification = store.addNotification({
                    title: document.getElementById('pro-note-title')?.value.trim() || 'إشعار جديد',
                    body: document.getElementById('pro-note-body')?.value.trim() || '',
                    type: document.getElementById('pro-note-type')?.value || 'update',
                    actionUrl: document.getElementById('pro-note-url')?.value.trim() || '',
                    actionLabel: document.getElementById('pro-note-label')?.value.trim() || '',
                    displayMode: document.getElementById('pro-note-display')?.value || 'feed',
                    sticky: document.getElementById('pro-note-sticky')?.value === 'true',
                    startAt: readDateTimeInput('pro-note-start'),
                    endAt: readDateTimeInput('pro-note-end')
                });
                logAdminAction({ area: 'notifications', action: 'create', targetType: 'notification', targetId: notification.id, summary: `تم نشر إشعار عام بعنوان ${notification.title}.` });
                await syncEverything();
                await refreshEverything(true);
            }
        });
        document.getElementById('pro-note-type').value = 'update';
        document.getElementById('pro-note-display').value = 'feed';
        document.getElementById('pro-note-sticky').value = 'false';
    };

    window.editPlatformNotification = (encodedSourceKey) => {
        if (!canAccessNotifications()) return alertToast('هذه الصلاحية غير متاحة لهذا الحساب.');
        const sourceKey = decodeValue(encodedSourceKey);
        const note = getNotificationRecord(sourceKey);
        if (!note) return;
        openProModal({
            title: note.audience === 'private' ? 'تعديل إشعار خاص' : 'تعديل إشعار عام',
            subtitle: note.title,
            bodyHtml: buildNotificationFormHtml(note),
            confirmLabel: 'حفظ الإشعار',
            onConfirm: async () => {
                const payload = {
                    title: document.getElementById('pro-note-title')?.value.trim() || note.title,
                    body: document.getElementById('pro-note-body')?.value.trim() || note.body,
                    type: document.getElementById('pro-note-type')?.value || note.type || 'update',
                    actionUrl: document.getElementById('pro-note-url')?.value.trim() || '',
                    actionLabel: document.getElementById('pro-note-label')?.value.trim() || '',
                    displayMode: document.getElementById('pro-note-display')?.value || 'feed',
                    sticky: document.getElementById('pro-note-sticky')?.value === 'true',
                    startAt: readDateTimeInput('pro-note-start'),
                    endAt: readDateTimeInput('pro-note-end'),
                    updatedAt: new Date().toISOString()
                };
                if (note.audience === 'private') {
                    authApi.updatePrivateNotification(note.recipientEmail, note.id, payload);
                } else {
                    store.updateNotification(note.id, payload);
                }
                logAdminAction({ area: 'notifications', action: 'update', targetType: note.audience === 'private' ? 'private_notification' : 'notification', targetId: note.id, summary: `تم تعديل الإشعار ${note.title}.` });
                await syncEverything();
                await refreshEverything(true);
            }
        });
        document.getElementById('pro-note-type').value = note.type || 'update';
        document.getElementById('pro-note-display').value = note.displayMode || 'feed';
        document.getElementById('pro-note-sticky').value = String(Boolean(note.sticky));
    };

    window.sendUserNotification = (encodedEmail) => {
        if (!canAccessNotifications()) return alertToast('هذه الصلاحية غير متاحة لهذا الحساب.');
        const email = decodeValue(encodedEmail);
        const user = authApi.getUserByEmail(email);
        if (!user) return;
        openProModal({
            title: 'إشعار خاص للمستخدم',
            subtitle: user.email,
            bodyHtml: buildNotificationFormHtml({ title: 'تنبيه إداري', body: 'تم تحديث بيانات حسابك على المنصة.' }),
            confirmLabel: 'إرسال الإشعار',
            onConfirm: async () => {
                const result = authApi.pushPrivateNotification(email, {
                    title: document.getElementById('pro-note-title')?.value.trim() || 'تنبيه إداري',
                    body: document.getElementById('pro-note-body')?.value.trim() || '',
                    type: document.getElementById('pro-note-type')?.value || 'update',
                    actionUrl: document.getElementById('pro-note-url')?.value.trim() || './notifications.html',
                    actionLabel: document.getElementById('pro-note-label')?.value.trim() || 'فتح الإشعارات',
                    displayMode: document.getElementById('pro-note-display')?.value || 'feed',
                    sticky: document.getElementById('pro-note-sticky')?.value === 'true',
                    startAt: readDateTimeInput('pro-note-start'),
                    endAt: readDateTimeInput('pro-note-end')
                });
                if (!result.ok) {
                    alertToast(result.message);
                    return false;
                }
                logAdminAction({ area: 'notifications', action: 'private', targetType: 'private_notification', targetId: email, summary: `تم إرسال إشعار خاص إلى ${email}.` });
                await syncEverything();
                await refreshEverything(true);
            }
        });
        document.getElementById('pro-note-type').value = 'update';
        document.getElementById('pro-note-display').value = 'feed';
        document.getElementById('pro-note-sticky').value = 'false';
    };

    window.openStudentFilesCenter = (encodedRequestId) => {
        if (!hasPermission('student_files')) return alertToast('هذه الصلاحية غير متاحة لهذا الحساب.');
        const requestId = decodeValue(encodedRequestId).toUpperCase();
        const application = store.getApplicationByRequestId(requestId);
        const files = advancedStore.getStudentFiles(requestId);
        openProModal({
            title: `مركز ملفات ${application?.name || requestId}`,
            subtitle: requestId,
            bodyHtml: `<div class="admin-pro-form-grid"><div class="admin-pro-form-group"><label>نوع الملف</label><select class="form-control" id="pro-student-file-category"><option value="id">بطاقة أو رقم قومي</option><option value="certificate">مستند تعليمي</option><option value="exam">مرفق امتحان</option><option value="other">أخرى</option></select></div><div class="admin-pro-form-group"><label>اختيار الملف</label><input class="form-control" id="pro-student-file-input" type="file" accept="image/*,.pdf,.doc,.docx,.txt"></div><div class="admin-pro-form-group full"><label>ملاحظة الملف</label><textarea class="form-control" id="pro-student-file-note" rows="3" placeholder="ملاحظة اختيارية"></textarea></div><div class="admin-pro-form-group full"><label>الملفات الحالية</label><div class="admin-pro-file-list">${files.length ? files.map((file) => `<div class="admin-pro-file-item"><div class="admin-pro-log-meta"><strong>${escapeHtml(file.fileName)}</strong><span>${escapeHtml(formatDate(file.updatedAt || file.createdAt))}</span></div><div class="admin-pro-kv"><p><span>النوع</span><strong>${escapeHtml(file.category)}</strong></p><p><span>الحجم</span><strong>${escapeHtml(formatBytes(file.size))}</strong></p><p><span>الملاحظة</span><strong>${escapeHtml(file.note || '--')}</strong></p></div><div class="admin-pro-inline-actions"><button type="button" onclick="previewStudentFile('${encodeValue(requestId)}', '${encodeValue(file.id)}')"><i class="fas fa-eye"></i> عرض</button><button type="button" class="danger" onclick="deleteStudentFileFromCenter('${encodeValue(requestId)}', '${encodeValue(file.id)}')"><i class="fas fa-trash"></i> حذف</button></div></div>`).join('') : '<div class="admin-pro-empty">لا توجد ملفات محفوظة لهذا الطالب حتى الآن.</div>'}</div></div></div>`,
            confirmLabel: 'رفع الملف',
            onConfirm: async () => {
                const file = document.getElementById('pro-student-file-input')?.files?.[0];
                if (!file) {
                    alertToast('اختر ملفًا أولًا.');
                    return false;
                }
                const content = await readFileAsDataUrl(file);
                const saved = advancedStore.upsertStudentFile({
                    requestId,
                    fileName: file.name,
                    category: document.getElementById('pro-student-file-category')?.value || 'other',
                    mimeType: file.type || 'application/octet-stream',
                    size: file.size || 0,
                    content,
                    note: document.getElementById('pro-student-file-note')?.value.trim() || '',
                    uploadedBy: session.email,
                    uploadedByName: session.name
                });
                if (!saved) {
                    alertToast('تعذر حفظ الملف.');
                    return false;
                }
                logAdminAction({ area: 'student_files', action: 'upload', targetType: 'student_file', targetId: `${requestId}:${saved.id}`, summary: `تم رفع ملف جديد للطلب ${requestId}.` });
                await syncEverything();
                await refreshEverything(true);
                reopenStudentFilesCenter(requestId);
            }
        });
    };

    window.previewStudentFile = (encodedRequestId, encodedFileId) => {
        const requestId = decodeValue(encodedRequestId).toUpperCase();
        const fileId = decodeValue(encodedFileId);
        const file = advancedStore.getStudentFiles(requestId).find((item) => item.id === fileId);
        if (!file?.content) return;
        const link = document.createElement('a');
        link.href = file.content;
        link.target = '_blank';
        link.download = file.fileName || 'student-file';
        link.click();
    };

    window.deleteStudentFileFromCenter = async (encodedRequestId, encodedFileId) => {
        const requestId = decodeValue(encodedRequestId).toUpperCase();
        const fileId = decodeValue(encodedFileId);
        if (!window.confirm('حذف هذا الملف من مركز الطالب؟')) return;
        advancedStore.deleteStudentFile(requestId, fileId);
        logAdminAction({ area: 'student_files', action: 'delete', targetType: 'student_file', targetId: `${requestId}:${fileId}`, summary: `تم حذف ملف من الطلب ${requestId}.` });
        await syncEverything();
        await refreshEverything(true);
        reopenStudentFilesCenter(requestId);
    };

    window.archiveUserSnapshot = async (encodedEmail) => {
        const email = decodeValue(encodedEmail);
        const user = authApi.getUserByEmail(email);
        const liveSession = getLiveSession();
        if (!user) return;
        if (authApi.normalizeEmail?.(liveSession?.email || '') === authApi.normalizeEmail?.(email || '')) {
            return alertToast('لا يمكن أرشفة الحساب الحالي أثناء الاستخدام.');
        }
        if (!window.confirm(`أرشفة حساب ${email} وإخفاؤه من قاعدة المستخدمين النشطة؟`)) return;

        advancedStore.addArchiveItem({
            type: 'user',
            title: `أرشفة المستخدم ${user.name || email}`,
            description: email,
            actorEmail: liveSession?.email || session.email,
            actorName: liveSession?.name || session.name,
            sourceId: email,
            payload: { user }
        });
        authApi.deleteUserAccount(email);
        logAdminAction({ area: 'archives', action: 'archive', targetType: 'user', targetId: email, summary: `تمت أرشفة المستخدم ${email}.` });
        await syncEverything();
        await refreshEverything(true);
    };

    window.archiveApplicationSnapshot = async (encodedRequestId) => {
        const requestId = decodeValue(encodedRequestId).toUpperCase();
        const application = store.getApplicationByRequestId(requestId);
        if (!application) return;
        advancedStore.addArchiveItem({
            type: 'application',
            title: `أرشفة الطلب ${requestId}`,
            description: application.name || '',
            actorEmail: session.email,
            actorName: session.name,
            sourceId: requestId,
            payload: { application }
        });
        logAdminAction({ area: 'archives', action: 'archive', targetType: 'application', targetId: requestId, summary: `تمت أرشفة نسخة من الطلب ${requestId}.` });
        await syncEverything();
        await refreshEverything(true);
        alertToast('تم حفظ نسخة من الطلب داخل الأرشيف.');
    };

    window.archiveApplicationSnapshot = async (encodedRequestId) => {
        const requestId = decodeValue(encodedRequestId).toUpperCase();
        const application = store.getApplicationByRequestId(requestId);
        if (!application) return;
        if (!window.confirm(`أرشفة الطلب ${requestId} وإخفاؤه من الطلبات النشطة؟`)) return;

        advancedStore.addArchiveItem({
            type: 'application',
            title: `أرشفة الطلب ${requestId}`,
            description: application.name || '',
            actorEmail: session.email,
            actorName: session.name,
            sourceId: requestId,
            payload: { application }
        });
        store.deleteApplication(requestId, { silentNotification: true });
        logAdminAction({ area: 'archives', action: 'archive', targetType: 'application', targetId: requestId, summary: `تمت أرشفة الطلب ${requestId} ونقله إلى الأرشيف.` });
        await syncEverything();
        await refreshEverything(true);
        alertToast('تمت أرشفة الطلب وإخفاؤه من القائمة الحالية.');
    };

    window.archiveSupportThread = async (encodedEmail) => {
        const email = decodeValue(encodedEmail);
        const thread = store.getSupportThreadByEmail?.(email);
        if (!thread) return;
        if (!window.confirm(`أرشفة محادثة ${email} وإخفاؤها من صندوق الدعم الحالي؟`)) return;
        advancedStore.addArchiveItem({
            type: 'support_thread',
            title: `أرشفة محادثة ${thread.userName || email}`,
            description: thread.lastMessagePreview || '',
            actorEmail: session.email,
            actorName: session.name,
            sourceId: email,
            payload: { thread }
        });
        store.deleteSupportThread?.(email);
        logAdminAction({ area: 'archives', action: 'archive', targetType: 'support_thread', targetId: email, summary: `تمت أرشفة محادثة الدعم ${email}.` });
        await syncEverything();
        await refreshEverything(true);
    };

    window.restoreArchiveItem = async (encodedArchiveId) => {
        const archiveId = decodeValue(encodedArchiveId);
        const archive = advancedStore.getArchives().find((item) => item.id === archiveId);
        if (!archive) return;
        if (archive.type === 'application' && archive.payload?.application) {
            store.upsertApplication(archive.payload.application);
        } else if (archive.type === 'support_thread' && archive.payload?.thread) {
            const thread = archive.payload.thread;
            (thread.messages || []).forEach((message) => {
                store.sendSupportMessage({
                    email: thread.email,
                    userName: thread.userName,
                    role: thread.role,
                    sender: message.sender || 'user',
                    senderName: message.senderName,
                    text: message.text,
                    createdAt: message.createdAt
                }, { silent: true });
            });
            store.updateSupportThreadStatus?.(thread.email, thread.status || 'open', { silent: true });
        }
        advancedStore.deleteArchiveItem(archiveId);
        logAdminAction({ area: 'archives', action: 'restore', targetType: archive.type, targetId: archive.sourceId || archive.id, summary: `تمت استعادة عنصر من الأرشيف (${archive.title}).` });
        await syncEverything();
        await refreshEverything(true);
    };

    window.restoreArchiveItem = async (encodedArchiveId) => {
        const archiveId = decodeValue(encodedArchiveId);
        const archive = advancedStore.getArchives().find((item) => item.id === archiveId);
        if (!archive) return;

        if (archive.type === 'application' && archive.payload?.application) {
            store.upsertApplication(archive.payload.application);
        } else if (archive.type === 'user' && archive.payload?.user) {
            authApi.upsertUser(archive.payload.user, { currentEmail: archive.payload.user.email });
        } else if (archive.type === 'support_thread' && archive.payload?.thread) {
            const thread = archive.payload.thread;
            (thread.messages || []).forEach((message) => {
                store.sendSupportMessage({
                    email: thread.email,
                    userName: thread.userName,
                    role: thread.role,
                    sender: message.sender || 'user',
                    senderName: message.senderName,
                    text: message.text,
                    createdAt: message.createdAt
                }, { silent: true });
            });
            store.updateSupportThreadStatus?.(thread.email, thread.status || 'open', { silent: true });
        }

        advancedStore.deleteArchiveItem(archiveId);
        logAdminAction({ area: 'archives', action: 'restore', targetType: archive.type, targetId: archive.sourceId || archive.id, summary: `تمت استعادة عنصر من الأرشيف (${archive.title}).` });
        await syncEverything();
        await refreshEverything(true);
    };

    window.deleteArchiveItemForever = async (encodedArchiveId) => {
        const archiveId = decodeValue(encodedArchiveId);
        if (!window.confirm('حذف هذا العنصر نهائيًا من الأرشيف؟')) return;
        advancedStore.deleteArchiveItem(archiveId);
        logAdminAction({ area: 'archives', action: 'delete', targetType: 'archive', targetId: archiveId, summary: 'تم حذف عنصر من الأرشيف نهائيًا.' });
        await syncEverything();
        await refreshEverything(true);
    };

    window.clearAdminActivityLogs = async () => {
        if (!window.confirm('تفريغ سجل النشاط الحالي؟')) return;
        advancedStore.clearActivityLogs();
        advancedStore.addActivityLog({
            actorEmail: session.email,
            actorName: session.name,
            area: 'activity',
            action: 'clear',
            targetType: 'activity_log',
            summary: 'تم تفريغ سجل النشاط وإعادة بدء دورة جديدة.'
        });
        await syncEverything();
        await refreshEverything(true);
    };

    function wireQuickActions() {
        const exportActive = document.getElementById('admin-export-active');
        const exportJson = document.getElementById('admin-export-json');
        const backupDownload = document.getElementById('admin-backup-download');
        const backupRestore = document.getElementById('admin-backup-restore');

        if (exportActive && exportActive.dataset.bound !== 'true') {
            exportActive.addEventListener('click', () => {
                const rows = getExportRowsForActiveSection();
                if (!rows.length) return alertToast('لا توجد بيانات قابلة للتصدير داخل هذا القسم.');
                downloadFile(`qaryaedu-${(activeProTab || document.querySelector('.admin-tab-content.active')?.id || 'section')}.csv`, buildCsv(rows), 'text/csv;charset=utf-8;');
                logAdminAction({ area: 'exports', action: 'csv', targetType: 'section', targetId: activeProTab || document.querySelector('.admin-tab-content.active')?.id || 'section', summary: 'تم تصدير بيانات القسم الحالي إلى CSV.' });
                void syncEverything();
            });
            exportActive.dataset.bound = 'true';
        }

        if (exportJson && exportJson.dataset.bound !== 'true') {
            exportJson.addEventListener('click', () => {
                downloadFile('qaryaedu-full-export.json', JSON.stringify(buildBackupPayload(), null, 2), 'application/json;charset=utf-8;');
                logAdminAction({ area: 'exports', action: 'json', targetType: 'platform', targetId: 'full-export', summary: 'تم تصدير نسخة JSON كاملة من بيانات المنصة.' });
                void syncEverything();
            });
            exportJson.dataset.bound = 'true';
        }

        if (backupDownload && backupDownload.dataset.bound !== 'true') {
            backupDownload.addEventListener('click', () => {
                downloadFile(`qaryaedu-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(buildBackupPayload(), null, 2), 'application/json;charset=utf-8;');
                logAdminAction({ area: 'backups', action: 'download', targetType: 'backup', targetId: 'full-backup', summary: 'تم إنشاء نسخة احتياطية كاملة للمنصة.' });
                void syncEverything();
            });
            backupDownload.dataset.bound = 'true';
        }

        if (backupRestore && backupRestore.dataset.bound !== 'true') {
            backupRestore.addEventListener('click', () => {
                const input = ensureRestoreInput();
                input.value = '';
                input.onchange = async () => {
                    const file = input.files?.[0];
                    if (!file) return;
                    try {
                        await restoreBackupPayload(JSON.parse(await file.text()));
                        logAdminAction({ area: 'backups', action: 'restore', targetType: 'backup', targetId: file.name, summary: 'تمت استعادة نسخة احتياطية كاملة.' });
                        await syncEverything();
                    } catch (error) {
                        alertToast(error?.message || 'تعذر استعادة النسخة الاحتياطية.');
                    }
                };
                input.click();
            });
            backupRestore.dataset.bound = 'true';
        }
    }

    function wrapWindowAction(name, buildMeta) {
        const original = window[name];
        if (typeof original !== 'function' || original.__proWrapped) return;
        const wrapped = async (...args) => {
            const beforeSignature = JSON.stringify({
                platform: store.getStateSnapshot?.(),
                users: authApi.getAllUsersRaw?.(),
                transactions: authApi.getAllTransactions?.(),
                advanced: advancedStore.getStateSnapshot?.()
            });
            const result = await original(...args);
            const afterSignature = JSON.stringify({
                platform: store.getStateSnapshot?.(),
                users: authApi.getAllUsersRaw?.(),
                transactions: authApi.getAllTransactions?.(),
                advanced: advancedStore.getStateSnapshot?.()
            });
            if (beforeSignature === afterSignature) {
                return result;
            }
            const meta = typeof buildMeta === 'function' ? buildMeta(args, result) : null;
            if (meta) {
                logAdminAction(meta);
                await syncEverything();
            }
            return result;
        };
        wrapped.__proWrapped = true;
        window[name] = wrapped;
    }

    function installActionWrappers() {
        wrapWindowAction('approveApplication', ([encodedRequestId]) => ({ area: 'students', action: 'approve', targetType: 'application', targetId: decodeValue(encodedRequestId), summary: `تمت الموافقة على الطلب ${decodeValue(encodedRequestId)}.` }));
        wrapWindowAction('rejectApplication', ([encodedRequestId]) => ({ area: 'students', action: 'reject', targetType: 'application', targetId: decodeValue(encodedRequestId), summary: `تم رفض الطلب ${decodeValue(encodedRequestId)}.` }));
        wrapWindowAction('setPendingApplication', ([encodedRequestId]) => ({ area: 'students', action: 'pending', targetType: 'application', targetId: decodeValue(encodedRequestId), summary: `تمت إعادة الطلب ${decodeValue(encodedRequestId)} إلى قيد المراجعة.` }));
        wrapWindowAction('allowStudentExam', ([encodedRequestId]) => ({ area: 'exams', action: 'allow', targetType: 'application', targetId: decodeValue(encodedRequestId), summary: `تم منح صلاحية الامتحان للطلب ${decodeValue(encodedRequestId)}.` }));
        wrapWindowAction('blockStudentExam', ([encodedRequestId]) => ({ area: 'exams', action: 'block', targetType: 'application', targetId: decodeValue(encodedRequestId), summary: `تم حظر الامتحان عن الطلب ${decodeValue(encodedRequestId)}.` }));
        wrapWindowAction('resetStudentExam', ([encodedRequestId]) => ({ area: 'exams', action: 'reset', targetType: 'application', targetId: decodeValue(encodedRequestId), summary: `تم تصفير سجل الامتحان للطلب ${decodeValue(encodedRequestId)}.` }));
        wrapWindowAction('removeApplication', ([encodedRequestId]) => ({ area: 'students', action: 'delete', targetType: 'application', targetId: decodeValue(encodedRequestId), summary: `تم حذف الطلب ${decodeValue(encodedRequestId)}.` }));
        wrapWindowAction('toggleUserStatus', ([encodedEmail]) => ({ area: 'users', action: 'status', targetType: 'user', targetId: decodeValue(encodedEmail), summary: `تم تغيير حالة المستخدم ${decodeValue(encodedEmail)}.` }));
        wrapWindowAction('toggleUserExam', ([encodedEmail]) => ({ area: 'users', action: 'exam_access', targetType: 'user', targetId: decodeValue(encodedEmail), summary: `تم تغيير صلاحية الامتحان للمستخدم ${decodeValue(encodedEmail)}.` }));
        wrapWindowAction('toggleUserWithdrawal', ([encodedEmail]) => ({ area: 'users', action: 'withdrawal_access', targetType: 'user', targetId: decodeValue(encodedEmail), summary: `تم تغيير صلاحية السحب للمستخدم ${decodeValue(encodedEmail)}.` }));
        wrapWindowAction('removeUser', ([encodedEmail]) => ({ area: 'users', action: 'delete', targetType: 'user', targetId: decodeValue(encodedEmail), summary: `تم حذف المستخدم ${decodeValue(encodedEmail)}.` }));
        wrapWindowAction('clearAllUsers', () => ({ area: 'users', action: 'clear_all', targetType: 'user_collection', targetId: 'all-users', summary: 'تمت تصفية قاعدة المستخدمين غير الإدارية.' }));
        wrapWindowAction('setWithdrawalStatus', ([encodedEmail, encodedTxId, status]) => ({ area: 'withdrawals', action: status, targetType: 'transaction', targetId: `${decodeValue(encodedEmail)}:${decodeValue(encodedTxId)}`, summary: `تم تحديث حالة عملية السحب ${decodeValue(encodedTxId)} للمستخدم ${decodeValue(encodedEmail)} إلى ${status}.` }));
        wrapWindowAction('removeWithdrawal', ([encodedEmail, encodedTxId]) => ({ area: 'withdrawals', action: 'delete', targetType: 'transaction', targetId: `${decodeValue(encodedEmail)}:${decodeValue(encodedTxId)}`, summary: `تم حذف عملية السحب ${decodeValue(encodedTxId)} للمستخدم ${decodeValue(encodedEmail)}.` }));
        wrapWindowAction('clearAllWithdrawals', () => ({ area: 'withdrawals', action: 'clear_all', targetType: 'transaction_collection', targetId: 'all-transactions', summary: 'تم تفريغ سجل عمليات السحب بالكامل.' }));
        wrapWindowAction('toggleSupportThreadStatus', ([encodedEmail, nextStatus]) => ({ area: 'support', action: nextStatus, targetType: 'support_thread', targetId: decodeValue(encodedEmail), summary: `تم تغيير حالة محادثة الدعم ${decodeValue(encodedEmail)} إلى ${nextStatus}.` }));
        wrapWindowAction('removeSupportThread', ([encodedEmail]) => ({ area: 'support', action: 'delete', targetType: 'support_thread', targetId: decodeValue(encodedEmail), summary: `تم حذف محادثة الدعم ${decodeValue(encodedEmail)}.` }));
        wrapWindowAction('markSupportMessagesRead', ([encodedEmail]) => ({ area: 'support', action: 'read', targetType: 'support_thread', targetId: decodeValue(encodedEmail), summary: `تم تعليم رسائل ${decodeValue(encodedEmail)} كمقروءة.` }));
        wrapWindowAction('removePlatformNotification', ([encodedKey]) => ({ area: 'notifications', action: 'delete', targetType: 'notification', targetId: decodeValue(encodedKey), summary: 'تم حذف إشعار من لوحة الإدارة.' }));
        wrapWindowAction('deleteAllNotifications', () => ({ area: 'notifications', action: 'clear_all', targetType: 'notification_collection', targetId: 'all-notifications', summary: 'تم حذف جميع الإشعارات غير الثابتة.' }));
    }

    function bootstrap() {
        ensureStyles();
        ensureModal();
        ensureAdvancedLayout();
        applyPermissionVisibility();
        wireQuickActions();
        installActionWrappers();
        enhanceRenderedCards();
        observeRenderedLists();
        window.addEventListener(store.storeEventName || 'qarya:store-updated', scheduleEnhancement);
        window.addEventListener(authApi.storeEventName || 'qarya_auth_store_updated', scheduleEnhancement);
        window.addEventListener(advancedStore.storeEventName || 'qarya:admin-advanced-updated', scheduleEnhancement);
        document.getElementById('admin-global-search')?.addEventListener('input', () => {
            if (activeProTab) renderProTab(activeProTab);
        });
    }

    bootstrap();
})();
