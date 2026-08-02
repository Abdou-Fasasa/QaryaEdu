(() => {
    const authApi = window.QaryaAuth;
    const store = window.QaryaPlatformStore;
    const session = authApi?.getSession?.();

    if (!authApi || !store || !session || (!authApi.isLeader(session.email) && !authApi.isAdminSession(session))) {
        window.location.href = '../login.html?next=pages/students-hub.html';
        return;
    }

    const isAdmin = authApi.isAdminSession(session);
    const summaryEl = document.getElementById('students-hub-summary');
    const listEl = document.getElementById('students-hub-list');
    const searchInput = document.getElementById('student-search');
    const statusFilter = document.getElementById('student-status-filter');
    const leaderFilter = document.getElementById('student-leader-filter');

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

    function getManagedApplications() {
        const applications = store.getAllApplications();
        if (isAdmin) {
            return applications;
        }

        const currentUser = authApi.getUserByEmail(session.email);
        const managedNames = new Set(authApi.getManagedStudents(session.email));
        const leaderCode = String(currentUser?.leaderCode || '').trim();
        if (managedNames.size > 0) {
            return applications.filter((application) => managedNames.has(application.name));
        }
        return applications.filter((application) => String(application.leaderCode || '').trim() === leaderCode);
    }

    function buildSummaryCard(label, value) {
        return `
            <div class="admin-card">
                <div class="user-info">
                    <span>${escapeHtml(label)}</span>
                    <h4>${escapeHtml(String(value))}</h4>
                </div>
            </div>
        `;
    }

    function populateLeaderFilter(applications) {
        const selectedValue = leaderFilter.value;
        const leaderCodes = [...new Set(applications.map((application) => String(application.leaderCode || '').trim()).filter(Boolean))];
        leaderFilter.innerHTML = '<option value="">كل الأكواد</option>' + leaderCodes.map((code) => `<option value="${escapeHtml(code)}">${escapeHtml(code)}</option>`).join('');
        leaderFilter.value = leaderCodes.includes(selectedValue) ? selectedValue : '';
    }

    function render() {
        const applications = getManagedApplications();
        const query = String(searchInput?.value || '').trim().toLowerCase();
        const selectedStatus = String(statusFilter?.value || '').trim();
        const selectedLeaderCode = String(leaderFilter?.value || '').trim();

        populateLeaderFilter(applications);

        const filtered = applications.filter((application) => {
            const name = String(application.name || '').toLowerCase();
            const requestId = String(application.requestId || '').toLowerCase();
            const matchesQuery = !query || name.includes(query) || requestId.includes(query);
            const matchesStatus = !selectedStatus || application.status === selectedStatus;
            const matchesLeader = !selectedLeaderCode || String(application.leaderCode || '').trim() === selectedLeaderCode;
            return matchesQuery && matchesStatus && matchesLeader;
        });

        summaryEl.innerHTML = [
            buildSummaryCard(isAdmin ? 'كل الطلبات' : 'طلباتك', applications.length),
            buildSummaryCard('المعروض الآن', filtered.length),
            buildSummaryCard('الحسابات المرتبطة', filtered.filter((application) => application.studentEmail).length),
            buildSummaryCard('الممنوعون من الامتحان', filtered.filter((application) => application.examAccess === 'blocked').length)
        ].join('');

        if (!filtered.length) {
            listEl.innerHTML = '<div class="admin-card" style="grid-column: 1 / -1;"><h4>لا توجد نتائج مطابقة.</h4><span>غيّر البحث أو الفلاتر لإظهار الطلاب.</span></div>';
            return;
        }

        listEl.innerHTML = filtered.map((application) => {
            const linkedUser = application.studentEmail
                ? authApi.getUserByEmail(application.studentEmail)
                : authApi.getUserByNationalId(application.nationalId);
            const loginEmail = linkedUser?.email || application.studentEmail || '--';
            const loginPassword = linkedUser?.password || application.studentPassword || '--';
            const latestAttempt = store.getLatestExamAttempt(application.requestId);

            return `
                <article class="admin-card student-card">
                    <div class="card-header">
                        <div class="user-info">
                            <h4>${escapeHtml(application.name || application.requestId)}</h4>
                            <span>${escapeHtml(application.requestId)} - ${escapeHtml(application.nationalId || '--')}</span>
                        </div>
                        <span class="status-pill ${application.status === 'accepted' ? 'pill-active' : application.status === 'rejected' ? 'pill-suspended' : ''}">
                            ${escapeHtml(store.getStatusLabel(application.status))}
                        </span>
                    </div>
                    <div class="card-body">
                        <p><span>كود القائد</span><strong>${escapeHtml(application.leaderCode || '--')}</strong></p>
                        <p><span>البريد</span><strong>${escapeHtml(loginEmail)}</strong></p>
                        <p><span>كلمة المرور</span><strong>${escapeHtml(loginPassword)}</strong></p>
                        <p><span>الامتحان</span><strong>${escapeHtml(store.getExamAccessLabel(application.examAccess))}</strong></p>
                        <p><span>آخر نتيجة</span><strong>${latestAttempt ? `${latestAttempt.percentage || 0}%` : 'لا يوجد'}</strong></p>
                        <p><span>آخر تحديث</span><strong>${escapeHtml(formatDate(application.updatedAt || application.createdAt))}</strong></p>
                    </div>
                    <div class="card-actions">
                        <a class="btn-action" href="./student-editor.html?requestId=${encodeURIComponent(application.requestId)}"><i class="fas fa-pen"></i> شاشة التعديل</a>
                        <a class="btn-action" href="./status.html?requestId=${encodeURIComponent(application.requestId)}&nationalId=${encodeURIComponent(application.nationalId || '')}"><i class="fas fa-eye"></i> حالة الطلب</a>
                    </div>
                </article>
            `;
        }).join('');
    }

    async function init() {
        if (store.refreshFromRemote) {
            await store.refreshFromRemote({ force: true });
        }
        if (authApi.refreshFromRemote) {
            await authApi.refreshFromRemote({ force: true });
        }

        render();
    }

    [searchInput, statusFilter, leaderFilter].forEach((element) => {
        element?.addEventListener('input', render);
        element?.addEventListener('change', render);
    });

    window.addEventListener(store.storeEventName || 'qarya:store-updated', render);
    window.addEventListener(authApi.storeEventName || 'qarya_auth_store_updated', render);

    void init();
})();
