(() => {
    const authApi = window.QaryaAuth;
    const authSession = authApi?.getSession?.();

    if (!authApi || !authSession) {
        window.location.href = '../login.html?next=pages/settings.html';
        return;
    }

    const previewContainer = document.getElementById('profile-preview');
    const imageInput = document.getElementById('profile-image-input');
    const removeBtn = document.getElementById('remove-image-btn');
    const saveBtn = document.getElementById('settings-save-btn');
    const resetBtn = document.getElementById('settings-reset-btn');
    const saveNote = document.getElementById('settings-save-note');

    const fieldMap = {
        phone: document.getElementById('setting-phone'),
        nationalId: document.getElementById('setting-national-id'),
        governorate: document.getElementById('setting-governorate'),
        city: document.getElementById('setting-city'),
        village: document.getElementById('setting-village'),
        leaderCode: document.getElementById('setting-leader-code'),
        telegramUsername: document.getElementById('setting-telegram-username'),
        profileVisibility: document.getElementById('setting-profile-visibility'),
        bio: document.getElementById('setting-bio'),
        preferredWithdrawalMethod: document.getElementById('setting-preferred-method'),
        payoutHolderName: document.getElementById('setting-payout-holder'),
        payoutIdentifier: document.getElementById('setting-payout-identifier'),
        payoutPhone: document.getElementById('setting-payout-phone'),
        payoutNotes: document.getElementById('setting-payout-notes'),
        notificationsEnabled: document.getElementById('setting-notifications-enabled'),
        compactCards: document.getElementById('setting-compact-cards'),
        showWalletQuickAccess: document.getElementById('setting-show-wallet-access')
    };

    function formatDate(value) {
        if (!value) return 'غير متاح';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'غير متاح';
        return date.toLocaleString('ar-EG');
    }

    function getMethodLabel(method) {
        const labels = {
            instapay: 'InstaPay',
            bank: 'بنك مصري',
            cash: 'خدمات كاش',
            fawry: 'ماي فوري'
        };
        return labels[method] || 'غير محدد';
    }

    function formatBalance(value) {
        return `${Number(value || 0).toLocaleString('en-US')} EGP`;
    }

    function updatePreview(src) {
        if (src) {
            previewContainer.innerHTML = `<img src="${src}" alt="الصورة الشخصية">`;
            removeBtn.style.display = 'inline-flex';
            return;
        }

        previewContainer.innerHTML = '<i class="fas fa-user"></i>';
        removeBtn.style.display = 'none';
    }

    function applySummary(userData) {
        document.getElementById('settings-profile-name').textContent = userData.name || 'مستخدم المنصة';
        document.getElementById('settings-profile-meta').textContent = `${userData.email} - ${userData.role || 'طالب المنصة'}`;
        document.getElementById('user-name-display').textContent = userData.name || '--';
        document.getElementById('user-email-display').textContent = userData.email || '--';
        document.getElementById('user-role-display').textContent = userData.role || 'طالب المنصة';
        document.getElementById('user-balance-display').textContent = formatBalance(userData.balance);
        document.getElementById('user-last-login-display').textContent = formatDate(userData.lastLoginAt);
        document.getElementById('user-last-update-display').textContent = formatDate(userData.lastUpdatedAt);

        document.getElementById('settings-role-chip').textContent = userData.role || 'طالب المنصة';
        document.getElementById('settings-balance-chip').textContent = formatBalance(userData.balance);
        document.getElementById('settings-method-chip').textContent = getMethodLabel(userData.preferredWithdrawalMethod);
        document.getElementById('settings-login-chip').textContent = formatDate(userData.lastLoginAt);

        updatePreview(userData.profileImage);
    }

    function applyFields(userData) {
        Object.entries(fieldMap).forEach(([key, element]) => {
            if (!element) return;

            if (element.type === 'checkbox') {
                element.checked = Boolean(userData[key]);
                return;
            }

            element.value = userData[key] || '';
        });
    }

    function collectFields() {
        const payload = {};
        Object.entries(fieldMap).forEach(([key, element]) => {
            if (!element) return;

            if (element.type === 'checkbox') {
                payload[key] = element.checked;
                return;
            }

            payload[key] = element.value.trim();
        });
        return payload;
    }

    function render() {
        const userData = authApi.getUserByEmail(authSession.email);
        if (!userData) return;
        applySummary(userData);
        applyFields(userData);
    }

    imageInput?.addEventListener('change', (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            saveNote.textContent = 'حجم الصورة كبير. الحد الأقصى 2 ميجابايت.';
            return;
        }

        const reader = new FileReader();
        reader.onload = (loadEvent) => {
            authApi.updateUserPersistentData(authSession.email, { profileImage: loadEvent.target?.result || null });
            render();
            saveNote.textContent = 'تم تحديث الصورة الشخصية.';
        };
        reader.readAsDataURL(file);
    });

    removeBtn?.addEventListener('click', () => {
        authApi.updateUserPersistentData(authSession.email, { profileImage: null });
        render();
        saveNote.textContent = 'تم حذف الصورة الشخصية.';
    });

    saveBtn?.addEventListener('click', () => {
        const payload = collectFields();
        authApi.updateUserPersistentData(authSession.email, payload);
        render();
        saveNote.textContent = 'تم حفظ الإعدادات بنجاح.';
    });

    resetBtn?.addEventListener('click', () => {
        render();
        saveNote.textContent = 'تم استرجاع القيم الحالية.';
    });

    window.addEventListener('qarya_user_data_updated', (event) => {
        const updatedEmail = authApi.normalizeEmail(event.detail?.email || '');
        if (updatedEmail === authApi.normalizeEmail(authSession.email)) {
            render();
        }
    });

    render();
})();
