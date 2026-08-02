(() => {
    const authApi = window.QaryaAuth;
    const store = window.QaryaPlatformStore;
    const session = authApi?.getSession?.();

    if (!authApi || !store || !session) {
        return;
    }

    const isAdmin = authApi.isAdminSession(session);
    const isLeader = authApi.isLeader(session.email);
    const messageBox = document.getElementById('student-editor-message');
    const applicationForm = document.getElementById('application-editor-form');
    const accountForm = document.getElementById('account-editor-form');

    const appFields = {
        requestId: document.getElementById('app-request-id'),
        name: document.getElementById('app-name'),
        age: document.getElementById('app-age'),
        governorate: document.getElementById('app-governorate'),
        city: document.getElementById('app-city'),
        village: document.getElementById('app-village'),
        leaderCode: document.getElementById('app-leader-code'),
        status: document.getElementById('app-status'),
        examAccess: document.getElementById('app-exam-access'),
        message: document.getElementById('app-message')
    };

    const accountFields = {
        email: document.getElementById('account-email'),
        password: document.getElementById('account-password'),
        role: document.getElementById('account-role'),
        balance: document.getElementById('account-balance'),
        leaderCode: document.getElementById('account-leader-code'),
        nationalId: document.getElementById('account-national-id'),
        accountStatus: document.getElementById('account-status'),
        examAllowed: document.getElementById('account-exam-allowed'),
        walletEnabled: document.getElementById('account-wallet-enabled'),
        withdrawalsEnabled: document.getElementById('account-withdrawals-enabled'),
        showWalletQuick: document.getElementById('account-show-wallet-quick'),
        notes: document.getElementById('account-notes')
    };

    let currentApplication = null;
    let currentUser = null;

    function showMessage(type, text) {
        if (!messageBox) return;
        messageBox.style.display = 'block';
        messageBox.className = `result ${type}`;
        messageBox.innerHTML = `<strong>${type === 'pass' ? 'تم الحفظ' : 'تنبيه'}</strong><p>${text}</p>`;
    }

    function getRequestIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return String(params.get('requestId') || '').trim().toUpperCase();
    }

    function canManageApplication(application) {
        if (!application) return false;
        if (isAdmin) return true;
        if (isLeader) {
            const currentUserRecord = authApi.getUserByEmail(session.email);
            return String(currentUserRecord?.leaderCode || '').trim() === String(application.leaderCode || '').trim();
        }

        const sessionUser = authApi.getUserByEmail(session.email);
        return authApi.normalizeEmail(session.email) === authApi.normalizeEmail(application.studentEmail)
            || String(sessionUser?.nationalId || '') === String(application.nationalId || '');
    }

    function fillForms() {
        if (!currentApplication) return;

        currentUser = currentApplication.studentEmail
            ? authApi.getUserByEmail(currentApplication.studentEmail)
            : authApi.getUserByNationalId(currentApplication.nationalId);

        appFields.requestId.value = currentApplication.requestId || '';
        appFields.name.value = currentApplication.name || '';
        appFields.age.value = currentApplication.age || '';
        appFields.governorate.value = currentApplication.governorate || '';
        appFields.city.value = currentApplication.city || '';
        appFields.village.value = currentApplication.village || '';
        appFields.leaderCode.value = currentApplication.leaderCode || '';
        appFields.status.value = currentApplication.status || 'pending';
        appFields.examAccess.value = currentApplication.examAccess || 'default';
        appFields.message.value = currentApplication.message || '';

        const accountEmail = currentUser?.email || currentApplication.studentEmail || '';
        const accountPassword = currentUser?.password || currentApplication.studentPassword || '';
        accountFields.email.value = accountEmail;
        accountFields.password.value = accountPassword;
        accountFields.role.value = currentUser?.role || 'طالب المنصة';
        accountFields.balance.value = Number(currentUser?.balance || 0);
        accountFields.leaderCode.value = currentUser?.leaderCode || currentApplication.leaderCode || '';
        accountFields.nationalId.value = currentApplication.nationalId || '';
        accountFields.accountStatus.value = currentUser?.isSuspended ? 'suspended' : 'active';
        accountFields.examAllowed.value = currentUser?.examAllowed === false ? 'blocked' : 'allowed';
        accountFields.walletEnabled.value = (currentUser?.walletEnabled !== false).toString();
        accountFields.withdrawalsEnabled.value = (currentUser?.withdrawalsEnabled !== false).toString();
        accountFields.showWalletQuick.value = (currentUser?.showWalletQuickAccess !== false).toString();
        accountFields.notes.value = [
            `اسم الطالب: ${currentApplication.name || '--'}`,
            `رقم الطلب: ${currentApplication.requestId || '--'}`,
            `الحالة: ${store.getStatusLabel(currentApplication.status)}`,
            `صلاحية الامتحان: ${store.getExamAccessLabel(currentApplication.examAccess)}`,
            `آخر دخول للحساب: ${currentUser?.lastLoginAt ? new Date(currentUser.lastLoginAt).toLocaleString('ar-EG') : 'لا يوجد'}`
        ].join('\n');
    }

    async function loadRecord() {
        if (store.refreshFromRemote) {
            await store.refreshFromRemote({ force: true });
        }
        if (authApi.refreshFromRemote) {
            await authApi.refreshFromRemote({ force: true });
        }

        const requestId = getRequestIdFromUrl() || authApi.getUserByEmail(session.email)?.requestId || '';
        currentApplication = store.getApplicationByRequestId(requestId);

        if (!canManageApplication(currentApplication)) {
            showMessage('fail', 'ليس لديك صلاحية فتح شاشة التعديل لهذا الطلب.');
            applicationForm?.querySelectorAll('input, select, textarea, button').forEach((element) => { element.disabled = true; });
            accountForm?.querySelectorAll('input, select, textarea, button').forEach((element) => { element.disabled = true; });
            return;
        }

        if (!currentApplication) {
            showMessage('fail', 'لم يتم العثور على الطلب المطلوب.');
            return;
        }

        fillForms();
    }

    applicationForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!currentApplication || !canManageApplication(currentApplication)) return;

        store.updateApplicationDetails(currentApplication.requestId, {
            name: appFields.name.value.trim(),
            age: Number(appFields.age.value || currentApplication.age || 0),
            governorate: appFields.governorate.value.trim(),
            city: appFields.city.value.trim(),
            village: appFields.village.value.trim(),
            leaderCode: appFields.leaderCode.value.trim(),
            status: appFields.status.value,
            examAccess: appFields.examAccess.value,
            message: appFields.message.value.trim(),
            studentEmail: accountFields.email.value.trim(),
            studentPassword: accountFields.password.value.trim()
        });

        await store.syncNow?.();
        await loadRecord();
        showMessage('pass', 'تم حفظ بيانات الطلب بنجاح.');
    });

    accountForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!currentApplication || !canManageApplication(currentApplication)) return;

        const payload = {
            requestId: currentApplication.requestId,
            nationalId: currentApplication.nationalId,
            name: currentApplication.name,
            governorate: currentApplication.governorate,
            city: currentApplication.city,
            village: currentApplication.village,
            leaderCode: accountFields.leaderCode.value.trim() || currentApplication.leaderCode || '',
            studentEmail: accountFields.email.value.trim(),
            studentPassword: accountFields.password.value.trim()
        };

        const result = await authApi.createOrUpdateStudentAccountFromApplication({
            ...payload,
            studentEmail: payload.studentEmail,
            studentPassword: payload.studentPassword
        });

        if (!result.ok) {
            showMessage('fail', result.message || 'تعذر حفظ بيانات الحساب.');
            return;
        }

        await authApi.updateUserPersistentData(result.user.email, {
            password: accountFields.password.value.trim(),
            role: accountFields.role.value.trim() || 'طالب المنصة',
            balance: Number(accountFields.balance.value || 0),
            leaderCode: accountFields.leaderCode.value.trim() || '',
            isSuspended: accountFields.accountStatus.value === 'suspended',
            examAllowed: accountFields.examAllowed.value !== 'blocked',
            walletEnabled: accountFields.walletEnabled.value === 'true',
            withdrawalsEnabled: accountFields.withdrawalsEnabled.value === 'true',
            showWalletQuickAccess: accountFields.showWalletQuick.value === 'true'
        });

        store.updateApplicationDetails(currentApplication.requestId, {
            leaderCode: accountFields.leaderCode.value.trim() || '',
            studentEmail: accountFields.email.value.trim(),
            studentPassword: accountFields.password.value.trim()
        });

        await Promise.all([
            authApi.syncNow?.(),
            store.syncNow?.()
        ]);

        // Real-time broadcast for other tabs (wallet, dashboards)
        if (typeof BroadcastChannel === 'function') {
            const channel = new BroadcastChannel('qaryaedu-admin-update');
            channel.postMessage({ type: 'user-updated', email: result.user.email });
        }

        await loadRecord();
        showMessage('pass', 'تم حفظ بيانات الحساب بنجاح.');
    });

    void loadRecord();
})();
