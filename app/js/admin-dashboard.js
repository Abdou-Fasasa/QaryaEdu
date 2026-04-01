document.addEventListener('DOMContentLoaded', async () => {
    const authApi = window.QaryaAuth;
    const store = window.QaryaPlatformStore;
    if (!authApi || !store) return;

    const session = authApi.getSession();
    const denied = document.getElementById('admin-access-denied');
    const shell = document.getElementById('admin-dashboard-shell');
    const statusFilter = document.getElementById('admin-status-filter');
    const searchInput = document.getElementById('admin-request-search');
    const requestList = document.getElementById('admin-request-list');
    const examList = document.getElementById('admin-exam-list');
    const leaderCodes = window.QaryaTelegram?.LEADER_CODES || ['Abdou200', 'Mohamed333', 'Reda456'];

    if (!authApi.isAdminSession?.(session)) {
        if (denied) denied.style.display = 'grid';
        if (shell) shell.style.display = 'none';
        return;
    }

    await store.refreshFromRemote({ force: true });

    if (denied) denied.style.display = 'none';
    if (shell) shell.style.display = 'block';

    ensureAdminSideControls();

    const settingsForm = document.getElementById('admin-platform-settings-form');
    const notificationForm = document.getElementById('admin-notification-form');
    const settingsNote = document.getElementById('admin-settings-note');
    const notificationNote = document.getElementById('admin-notification-note');

    if (statusFilter) statusFilter.addEventListener('change', render);
    if (searchInput) searchInput.addEventListener('input', render);

    if (settingsForm) {
        settingsForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const mode = document.getElementById('admin-exam-mode')?.value || 'default';
            const message = document.getElementById('admin-exam-mode-message')?.value || '';
            if (store.refreshFromRemote) {
                await store.refreshFromRemote({ force: true });
            }
            store.updatePlatformSettings({ examMode: mode, examModeMessage: message });
            if (store.syncNow) {
                await store.syncNow();
            }
            if (settingsNote) settingsNote.textContent = 'تم حفظ إعدادات المنصة العامة.';
            render();
        });
    }

    if (notificationForm) {
        notificationForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const title = document.getElementById('admin-notification-title')?.value.trim() || '';
            const body = document.getElementById('admin-notification-body')?.value.trim() || '';
            const type = document.getElementById('admin-notification-type')?.value || 'update';
            if (!title || !body) {
                if (notificationNote) notificationNote.textContent = 'اكتب عنوان الإشعار ومحتواه أولًا.';
                return;
            }
            if (store.refreshFromRemote) {
                await store.refreshFromRemote({ force: true });
            }
            store.addNotification({ title, body, type, actionUrl: './notifications.html', actionLabel: 'عرض الإشعارات' });
            if (store.syncNow) {
                await store.syncNow();
            }
            notificationForm.reset();
            if (notificationNote) notificationNote.textContent = 'تم إرسال الإشعار إلى المنصة.';
            render();
        });
    }

    document.addEventListener('click', async (event) => {
        const actionButton = event.target.closest('[data-admin-action]');
        if (!actionButton) return;

        const requestId = actionButton.dataset.requestId;
        const action = actionButton.dataset.adminAction;
        const card = actionButton.closest('.admin-request-card, .dashboard-list-card');
        const snapshot = requestId ? store.getApplicationByRequestId(requestId) : null;
        const updates = card && snapshot ? collectCardUpdates(card, snapshot) : null;
        let hasChanges = false;

        actionButton.disabled = true;

        try {
            if (store.refreshFromRemote) {
                await store.refreshFromRemote({ force: true });
            }

            const application = requestId ? store.getApplicationByRequestId(requestId) : null;

            if (action === 'save' && application && updates) {
                store.updateApplicationDetails(requestId, updates);
                hasChanges = true;
            }

            if (action === 'accepted' && application) {
                store.updateApplicationStatus(requestId, 'accepted', updates?.message || application.message);
                hasChanges = true;
            }

            if (action === 'pending' && application) {
                store.updateApplicationStatus(requestId, 'pending', updates?.message || 'تمت إعادة الطلب إلى حالة المراجعة.');
                hasChanges = true;
            }

            if (action === 'rejected' && application) {
                store.updateApplicationStatus(requestId, 'rejected', updates?.message || application.message);
                hasChanges = true;
            }

            if (action === 'allow-exam' && application) {
                store.setExamAccess(requestId, 'allowed', updates?.examAccessReason || 'تم منح سماح مباشر من الإدارة لدخول الامتحان.');
                hasChanges = true;
            }

            if (action === 'block-exam' && application) {
                store.setExamAccess(requestId, 'blocked', updates?.examAccessReason || 'تم حظر الطالب من دخول الامتحان عبر الإدارة.');
                hasChanges = true;
            }

            if (action === 'default-exam' && application) {
                store.setExamAccess(requestId, 'default', '');
                hasChanges = true;
            }

            if (action === 'clear-attempts' && application) {
                if (window.confirm(`هل تريد حذف جميع محاولات الامتحان للطلب ${requestId}؟`)) {
                    store.clearExamAttempts(requestId);
                    hasChanges = true;
                }
            }

            if (action === 'delete-student' && application) {
                if (window.confirm(`سيتم حذف ${application.name || requestId} من المنصة. هل تريد المتابعة؟`)) {
                    store.deleteApplication(requestId);
                    hasChanges = true;
                }
            }

            if (hasChanges && store.syncNow) {
                await store.syncNow();
            }

            if (store.refreshFromRemote) {
                await store.refreshFromRemote({ force: true });
            }

            render();
        } finally {
            actionButton.disabled = false;
        }
    });

    window.addEventListener(store.storeEventName || 'qarya:store-updated', render);
    render();

    function ensureAdminSideControls() {
        const sideStack = shell ? shell.querySelector('.side-stack') : null;
        if (!sideStack) return;

        if (!document.getElementById('admin-platform-controls')) {
            const controls = document.createElement('section');
            controls.className = 'side-card admin-control-card';
            controls.id = 'admin-platform-controls';
            controls.innerHTML = `
                <div class="card-heading"><span class="mini-badge">تحكم عام</span><h3>إعدادات المنصة</h3></div>
                <form id="admin-platform-settings-form" class="admin-panel-form">
                    <label class="admin-field admin-field-full">
                        <span>وضع الامتحان العام</span>
                        <select id="admin-exam-mode" class="admin-select-input">
                            <option value="default">حسب الجدول الرسمي</option>
                            <option value="open">فتح إجباري</option>
                            <option value="closed">إغلاق إجباري</option>
                        </select>
                    </label>
                    <label class="admin-field admin-field-full">
                        <span>ملاحظة عامة للبوابة</span>
                        <textarea id="admin-exam-mode-message" class="admin-textarea" placeholder="رسالة تظهر مع ضبط الامتحان العام..."></textarea>
                    </label>
                    <button type="submit" class="btn-secondary">حفظ الإعدادات</button>
                    <p class="admin-form-note" id="admin-settings-note"></p>
                </form>
            `;
            sideStack.prepend(controls);
        }

        if (!document.getElementById('admin-platform-notifications')) {
            const notify = document.createElement('section');
            notify.className = 'side-card admin-control-card';
            notify.id = 'admin-platform-notifications';
            notify.innerHTML = `
                <div class="card-heading"><span class="mini-badge">إشعار عام</span><h3>إرسال تنبيه لكل المنصة</h3></div>
                <form id="admin-notification-form" class="admin-panel-form">
                    <label class="admin-field admin-field-full">
                        <span>عنوان الإشعار</span>
                        <input type="text" id="admin-notification-title" class="admin-text-input" placeholder="عنوان مختصر" />
                    </label>
                    <label class="admin-field admin-field-full">
                        <span>نوع الإشعار</span>
                        <select id="admin-notification-type" class="admin-select-input">
                            <option value="update">تحديث عام</option>
                            <option value="application">الطلبات</option>
                            <option value="exam">الامتحانات</option>
                            <option value="finance">الدفعات</option>
                        </select>
                    </label>
                    <label class="admin-field admin-field-full">
                        <span>المحتوى</span>
                        <textarea id="admin-notification-body" class="admin-textarea" placeholder="نص الإشعار الذي سيظهر لكل المستخدمين..."></textarea>
                    </label>
                    <button type="submit" class="btn-secondary">نشر الإشعار</button>
                    <p class="admin-form-note" id="admin-notification-note"></p>
                </form>
            `;
            sideStack.prepend(notify);
        }
    }

    function collectCardUpdates(card, application) {
        const getValue = (name) => {
            const field = card.querySelector(`[data-admin-field="${name}"]`);
            return field ? field.value : '';
        };

        const ageValue = Number(getValue('age'));
        return {
            name: getValue('name').trim(),
            nationalId: getValue('nationalId').trim(),
            governorate: getValue('governorate').trim(),
            city: getValue('city').trim(),
            village: getValue('village').trim(),
            leaderCode: getValue('leaderCode').trim(),
            message: getValue('message').trim(),
            examAccessReason: getValue('examAccessReason').trim(),
            status: getValue('status') || application.status,
            examAccess: getValue('examAccess') || application.examAccess,
            age: Number.isFinite(ageValue) && ageValue > 0 ? ageValue : application.age
        };
    }

    function render() {
        const metrics = store.getDashboardMetrics();
        const settings = store.getPlatformSettings();
        const status = statusFilter ? statusFilter.value : '';
        const query = String(searchInput?.value || '').trim().toLowerCase();
        const applications = store.getAllApplications().filter((application) => {
            const matchStatus = status ? application.status === status : true;
            const haystack = `${application.name || ''} ${application.requestId || ''} ${application.nationalId || ''} ${application.village || ''} ${application.leaderCode || ''}`.toLowerCase();
            const matchQuery = query ? haystack.includes(query) : true;
            return matchStatus && matchQuery;
        });

        setText('admin-total-applications', metrics.totalApplications);
        setText('admin-pending-applications', metrics.pendingApplications);
        setText('admin-accepted-applications', metrics.acceptedApplications);
        setText('admin-rejected-applications', metrics.rejectedApplications);
        setText('admin-total-exams', metrics.totalExamAttempts);
        setText('admin-filter-count', applications.length);

        const examMode = document.getElementById('admin-exam-mode');
        const examModeMessage = document.getElementById('admin-exam-mode-message');
        if (examMode) examMode.value = settings.examMode || 'default';
        if (examModeMessage) examModeMessage.value = settings.examModeMessage || '';

        if (requestList) {
            requestList.innerHTML = applications.length
                ? applications.map(renderApplicationCard).join('')
                : '<div class="empty-state"><i class="fas fa-folder-open"></i><h3>لا توجد طلبات مطابقة</h3><p>جرّب تغيير الفلتر أو عبارة البحث.</p></div>';
        }

        if (examList) {
            const exams = store.getExamHistory().slice(0, 8);
            examList.innerHTML = exams.length
                ? exams.map((attempt) => `
                    <article class="dashboard-list-card" data-reveal>
                        <div class="dashboard-list-head">
                            <div>
                                <strong>${escapeHtml(attempt.name || 'طالب المنصة')}</strong>
                                <span>${escapeHtml(attempt.requestId)}</span>
                            </div>
                            <strong class="score-chip">${attempt.percentage || 0}%</strong>
                        </div>
                        <p>${attempt.examLevel === 'senior' ? 'امتحان الكبار' : 'امتحان المرحلة الابتدائية'} - ${formatDate(attempt.date)}</p>
                        <div class="dashboard-card-actions wrap-actions">
                            <a href="./exam-results.html?requestId=${encodeURIComponent(attempt.requestId)}" class="btn-ghost">تفاصيل النتيجة</a>
                            <button type="button" class="btn-ghost" data-admin-action="clear-attempts" data-request-id="${escapeAttr(attempt.requestId)}">تصفير المحاولات</button>
                            <button type="button" class="btn-ghost danger-ghost" data-admin-action="block-exam" data-request-id="${escapeAttr(attempt.requestId)}">حظر الامتحان</button>
                        </div>
                    </article>
                `).join('')
                : '<div class="empty-state compact"><p>لا توجد محاولات امتحان محفوظة حاليًا.</p></div>';
        }
    }

    function renderApplicationCard(application) {
        const attemptsCount = store.getExamHistoryByRequestId(application.requestId).length;
        return `
            <article class="admin-request-card" data-reveal>
                <div class="dashboard-list-head">
                    <div>
                        <strong>${escapeHtml(application.name || 'بدون اسم')}</strong>
                        <span>${escapeHtml(application.requestId)} - ${escapeHtml(application.nationalId || 'بدون رقم قومي')}</span>
                    </div>
                    <span class="badge ${application.status}">${store.getStatusLabel(application.status)}</span>
                </div>
                <div class="admin-chip-row">
                    <span class="mini-badge">${store.getExamAccessLabel(application.examAccess)}</span>
                    <span class="mini-badge">محاولات الامتحان: ${attemptsCount}</span>
                    <span class="mini-badge">العمر: ${application.age || '---'}</span>
                </div>
                <div class="admin-edit-grid">
                    ${renderField('الاسم', 'name', application.name)}
                    ${renderField('الرقم القومي', 'nationalId', application.nationalId)}
                    ${renderField('السن', 'age', application.age || '', 'number')}
                    ${renderField('المحافظة', 'governorate', application.governorate)}
                    ${renderField('المركز', 'city', application.city)}
                    ${renderField('القرية', 'village', application.village)}
                    ${renderLeaderField(application.leaderCode)}
                    ${renderSelectField('حالة الطلب', 'status', [
                        ['pending', 'قيد المراجعة'],
                        ['accepted', 'مقبول'],
                        ['rejected', 'مرفوض']
                    ], application.status)}
                    ${renderSelectField('صلاحية الامتحان', 'examAccess', [
                        ['default', 'حسب القواعد'],
                        ['allowed', 'سماح خاص'],
                        ['blocked', 'حظر الامتحان']
                    ], application.examAccess)}
                    ${renderTextareaField('رسالة الطلب', 'message', application.message || '', 'admin-field-full')}
                    ${renderTextareaField('سبب ضبط الامتحان', 'examAccessReason', application.examAccessReason || '', 'admin-field-full')}
                </div>
                <div class="admin-request-meta">
                    <span><i class="fas fa-clock"></i> ${formatDate(application.createdAt)}</span>
                    <span><i class="fas fa-rotate"></i> آخر تحديث: ${formatDate(application.updatedAt || application.createdAt)}</span>
                </div>
                <div class="dashboard-card-actions admin-actions-row wrap-actions">
                    <button type="button" class="btn-secondary" data-admin-action="save" data-request-id="${escapeAttr(application.requestId)}">حفظ التعديلات</button>
                    <button type="button" class="btn-ghost" data-admin-action="accepted" data-request-id="${escapeAttr(application.requestId)}">موافقة</button>
                    <button type="button" class="btn-ghost" data-admin-action="pending" data-request-id="${escapeAttr(application.requestId)}">قيد المراجعة</button>
                    <button type="button" class="btn-ghost danger-ghost" data-admin-action="rejected" data-request-id="${escapeAttr(application.requestId)}">رفض</button>
                    <button type="button" class="btn-ghost" data-admin-action="allow-exam" data-request-id="${escapeAttr(application.requestId)}">سماح الامتحان</button>
                    <button type="button" class="btn-ghost danger-ghost" data-admin-action="block-exam" data-request-id="${escapeAttr(application.requestId)}">حظر الامتحان</button>
                    <button type="button" class="btn-ghost" data-admin-action="default-exam" data-request-id="${escapeAttr(application.requestId)}">رجوع للقواعد</button>
                    <button type="button" class="btn-ghost" data-admin-action="clear-attempts" data-request-id="${escapeAttr(application.requestId)}">تصفير المحاولات</button>
                    <button type="button" class="btn-ghost danger-ghost" data-admin-action="delete-student" data-request-id="${escapeAttr(application.requestId)}">حذف الطالب</button>
                </div>
            </article>
        `;
    }

    function renderField(label, name, value, type = 'text') {
        return `
            <label class="admin-field">
                <span>${label}</span>
                <input type="${type}" class="admin-text-input" data-admin-field="${name}" value="${escapeAttr(value || '')}" />
            </label>
        `;
    }

    function renderLeaderField(value) {
        return `
            <label class="admin-field">
                <span>كود القائد</span>
                <select class="admin-select-input" data-admin-field="leaderCode">
                    ${leaderCodes.map((code) => `<option value="${escapeAttr(code)}"${code === value ? ' selected' : ''}>${escapeHtml(code)}</option>`).join('')}
                </select>
            </label>
        `;
    }

    function renderSelectField(label, name, options, currentValue) {
        return `
            <label class="admin-field">
                <span>${label}</span>
                <select class="admin-select-input" data-admin-field="${name}">
                    ${options.map(([value, text]) => `<option value="${escapeAttr(value)}"${value === currentValue ? ' selected' : ''}>${escapeHtml(text)}</option>`).join('')}
                </select>
            </label>
        `;
    }

    function renderTextareaField(label, name, value, extraClass = '') {
        return `
            <label class="admin-field ${extraClass}">
                <span>${label}</span>
                <textarea class="admin-textarea" data-admin-field="${name}" placeholder="اكتب هنا...">${escapeHtml(value || '')}</textarea>
            </label>
        `;
    }

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = Number(value || 0).toLocaleString('ar-EG');
    }

    function formatDate(value) {
        return value ? new Date(value).toLocaleString('ar-EG') : 'غير محدد';
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function escapeAttr(value) {
        return escapeHtml(value).replace(/`/g, '&#96;');
    }
});
