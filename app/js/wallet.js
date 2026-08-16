(() => {
    const authApi = window.QaryaAuth;
    const authSession = authApi?.getSession?.();
    const telegramApi = window.QaryaTelegram;

    function getWalletDeviceModel() {
        const userAgent = String(navigator.userAgent || '');
        const buildMatch = userAgent.match(/;\s*([^;()]+?)\s+Build\//i);
        return String(navigator.userAgentData?.model || buildMatch?.[1] || 'غير متاح').trim();
    }

    if (!authApi || !authSession) {
        window.location.href = '../login.html?next=pages/wallet.html';
        return;
    }

    if (!authApi.canAccessWallet?.(authSession.email || authSession)) {
        window.location.replace('./exam-status.html');
        return;
    }

    function setupMonaPrivateMessage() {
        const isMona = authApi.normalizeEmail(authSession.email) === 'monanegm@qarya.edu';
        const lock = document.getElementById('mona-private-lock');
        if (!isMona || !lock) return;

        const defaultSettings = {
            enabled: true,
            password: 'Mona2026',
            title: 'بحبك أمام القرية كلها',
            body: 'رسالة خاصة لكِ وحدك، ولن تظهر لأي مستخدم آخر.',
            countdownTarget: '2026-08-17T00:00:00',
            allowClose: true
        };
        const savedSettings = authApi.getUserByEmail(authSession.email)?.privateWalletMessage;
        const settings = { ...defaultSettings, ...(savedSettings && typeof savedSettings === 'object' ? savedSettings : {}) };
        if (settings.enabled === false) return;

        const card = document.getElementById('mona-private-card');
        const openButton = document.getElementById('mona-open-private-message');
        const form = document.getElementById('mona-private-password-form');
        const passwordInput = document.getElementById('mona-private-password');
        const error = document.getElementById('mona-password-error');
        const countdown = document.getElementById('mona-countdown');
        const closeButton = document.getElementById('mona-private-close');
        const title = document.getElementById('mona-private-message-title');
        const body = document.getElementById('mona-private-message-body');
        const revealAt = new Date(settings.countdownTarget).getTime();
        let countdownTimer = null;

        if (title) title.textContent = settings.title || defaultSettings.title;
        if (body) body.textContent = settings.body || defaultSettings.body;
        if (closeButton) closeButton.hidden = settings.allowClose === false;

        lock.hidden = false;
        lock.classList.add('show');

        openButton?.addEventListener('click', () => {
            card.classList.add('enter-password');
            window.setTimeout(() => passwordInput?.focus(), 0);
        });

        const renderCountdown = () => {
            if (!Number.isFinite(revealAt)) {
                countdown.textContent = '';
                return;
            }
            const remaining = Math.max(0, revealAt - Date.now());
            if (remaining === 0) {
                countdown.textContent = 'وصل يوم 17 أغسطس.';
                if (countdownTimer) window.clearInterval(countdownTimer);
                return;
            }
            const totalSeconds = Math.floor(remaining / 1000);
            const days = Math.floor(totalSeconds / 86400);
            const hours = Math.floor((totalSeconds % 86400) / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            countdown.textContent = `العد التنازلي حتى 17 أغسطس: ${days} يوم ${hours} ساعة ${minutes} دقيقة ${seconds} ثانية`;
        };

        form?.addEventListener('submit', (event) => {
            event.preventDefault();
            if (passwordInput.value !== String(settings.password || defaultSettings.password)) {
                error.textContent = 'كلمة المرور غير صحيحة.';
                passwordInput.select();
                return;
            }
            error.textContent = '';
            card.classList.add('unlocked');
            renderCountdown();
            countdownTimer = window.setInterval(renderCountdown, 1000);
            void telegramApi?.sendMonaPrivateMessageOpened?.({
                name: walletUser.name || authSession.name,
                email: walletUser.email || authSession.email,
                deviceModel: getWalletDeviceModel()
            });
        });

        closeButton?.addEventListener('click', () => {
            if (countdownTimer) window.clearInterval(countdownTimer);
            lock.classList.remove('show');
            lock.hidden = true;
        });
    }

    setupMonaPrivateMessage();

    // تطبيق تعديل الرسالة الخاصة من لوحة التحكم فور وصوله إلى جلسة منى المفتوحة.
    if (authApi.normalizeEmail(authSession.email) === 'monanegm@qarya.edu') {
        let privateMessageSignature = JSON.stringify(authApi.getUserByEmail(authSession.email)?.privateWalletMessage || null);
        const applyPrivateMessageUpdate = () => {
            const nextSignature = JSON.stringify(authApi.getUserByEmail(authSession.email)?.privateWalletMessage || null);
            if (nextSignature !== privateMessageSignature) {
                privateMessageSignature = nextSignature;
                window.location.reload();
            }
        };
        window.addEventListener('qarya_user_data_updated', (event) => {
            const changedEmail = authApi.normalizeEmail(event.detail?.email || '');
            if (changedEmail !== authApi.normalizeEmail(authSession.email)) return;
            applyPrivateMessageUpdate();
        });
        window.addEventListener('qarya_auth_store_updated', applyPrivateMessageUpdate);
    }

    // إرسال إشعار بدخول صفحة السحب
    const walletUser = authApi.getUserByEmail(authSession.email) || authSession;
    try {
        telegramApi?.sendWithdrawalAccess?.({
            name: walletUser.name || authSession.name,
            email: walletUser.email || authSession.email,
            role: walletUser.role || authSession.role,
            balance: Number(walletUser.balance || 0),
            deviceModel: getWalletDeviceModel(),
            userAgent: navigator.userAgent || ''
        });
    } catch (e) {
        console.error('Failed to send withdrawal access notification:', e);
    }

    const WITHDRAWAL_COOLDOWN_MS = 2 * 60 * 1000;
    const DAILY_WAIT_HOURS = 1 / 30;
    const MIN_WITHDRAWAL = 1;
    const WALLET_REFRESH_INTERVAL_MS = 30000;
    const WAITING_DECREMENT_MS = 14 * 60 * 1000;
    const CONFIRMATION_TIMEOUT_MS = 15 * 60 * 1000;
    const CONFIRMATION_CODE_LENGTH = 6;
    const CONFIRMATION_CODE_ROTATION_INTERVAL_MS = 15 * 60 * 1000;  // توليد كود جديد كل 15 دقيقة

    const BANK_OPTIONS = [
        { id: 'nbe', name: 'البنك الأهلي المصري', hint: 'NBE', code: 'NBE', colors: ['#0f766e', '#134e4a'] },
        { id: 'misr', name: 'بنك مصر', hint: 'Banque Misr', code: 'BM', colors: ['#1d4ed8', '#1e3a8a'] },
        { id: 'caire', name: 'بنك القاهرة', hint: 'Banque du Caire', code: 'BDC', colors: ['#7c2d12', '#c2410c'] },
        { id: 'cib', name: 'البنك التجاري الدولي CIB', hint: 'CIB', code: 'CIB', colors: ['#1d4ed8', '#2563eb'] },
        { id: 'alex', name: 'بنك الإسكندرية', hint: 'AlexBank', code: 'ALX', colors: ['#ea580c', '#c2410c'] },
        { id: 'qnb', name: 'QNB الأهلي', hint: 'QNB Alahli', code: 'QNB', colors: ['#4f46e5', '#312e81'] },
        { id: 'aaib', name: 'البنك العربي الأفريقي الدولي', hint: 'AAIB', code: 'AA', colors: ['#15803d', '#14532d'] },
        { id: 'mutahid', name: 'المصرف المتحد', hint: 'United Bank', code: 'UB', colors: ['#7c3aed', '#5b21b6'] },
        { id: 'faisal', name: 'بنك فيصل الإسلامي المصري', hint: 'Faisal', code: 'FIB', colors: ['#166534', '#14532d'] },
        { id: 'hdb', name: 'بنك التعمير والإسكان', hint: 'Housing & Development', code: 'HDB', colors: ['#0f766e', '#164e63'] },
        { id: 'egbank', name: 'البنك المصري الخليجي', hint: 'EGBANK', code: 'EGB', colors: ['#b91c1c', '#7f1d1d'] },
        { id: 'scbank', name: 'بنك قناة السويس', hint: 'Suez Canal Bank', code: 'SCB', colors: ['#0f766e', '#1f2937'] },
        { id: 'saib', name: 'بنك الشركة المصرفية العربية الدولية SAIB', hint: 'SAIB', code: 'SAIB', colors: ['#334155', '#0f172a'] },
        { id: 'cae', name: 'بنك كريدي أجريكول مصر', hint: 'Credit Agricole', code: 'CAE', colors: ['#15803d', '#1e3a8a'] },
        { id: 'adib', name: 'بنك أبوظبي الإسلامي مصر', hint: 'ADIB Egypt', code: 'ADIB', colors: ['#166534', '#0f766e'] },
        { id: 'adcb', name: 'بنك أبوظبي التجاري مصر', hint: 'ADCB Egypt', code: 'ADCB', colors: ['#ef4444', '#991b1b'] },
        { id: 'fab', name: 'بنك أبوظبي الأول مصر', hint: 'FABMISR', code: 'FAB', colors: ['#1d4ed8', '#b91c1c'] },
        { id: 'emiratesnbd', name: 'بنك الإمارات دبي الوطني مصر', hint: 'Emirates NBD', code: 'ENBD', colors: ['#1d4ed8', '#f97316'] },
        { id: 'baraka', name: 'بنك البركة مصر', hint: 'Al Baraka', code: 'ABK', colors: ['#15803d', '#166534'] },
        { id: 'nbk', name: 'بنك الكويت الوطني مصر', hint: 'NBK Egypt', code: 'NBK', colors: ['#1d4ed8', '#1e40af'] },
        { id: 'hsbc', name: 'بنك HSBC مصر', hint: 'HSBC', code: 'HSBC', colors: ['#dc2626', '#991b1b'] },
        { id: 'mashreq', name: 'بنك المشرق مصر', hint: 'Mashreq', code: 'MSH', colors: ['#ea580c', '#f97316'] },
        { id: 'arabi', name: 'البنك العربي', hint: 'Arab Bank', code: 'ARB', colors: ['#16a34a', '#166534'] },
        { id: 'abk', name: 'البنك الأهلي الكويتي مصر', hint: 'ABK Egypt', code: 'ABK', colors: ['#7c3aed', '#4338ca'] },
        { id: 'aib', name: 'بنك الاستثمار العربي', hint: 'AIB', code: 'AIB', colors: ['#475569', '#0f172a'] },
        { id: 'earb', name: 'البنك العقاري المصري العربي', hint: 'EARB', code: 'EARB', colors: ['#7c2d12', '#92400e'] },
        { id: 'abe', name: 'البنك الزراعي المصري', hint: 'ABE', code: 'ABE', colors: ['#15803d', '#14532d'] },
        { id: 'next', name: 'بنك نكست', hint: 'NEXT Bank', code: 'NXT', colors: ['#2563eb', '#7c3aed'] },
        { id: 'idb', name: 'بنك التنمية الصناعية', hint: 'IDB', code: 'IDB', colors: ['#1d4ed8', '#0f766e'] },
        { id: 'aibk', name: 'المصرف العربي الدولي', hint: 'AIBK', code: 'AIBK', colors: ['#4f46e5', '#1d4ed8'] },
        { id: 'abc', name: 'بنك ABC مصر', hint: 'Bank ABC', code: 'ABC', colors: ['#dc2626', '#7f1d1d'] },
        { id: 'citibank', name: 'سيتي بنك مصر', hint: 'Citi Egypt', code: 'CITI', colors: ['#2563eb', '#dc2626'] }
    ];

    const CASH_OPTIONS = [
        { id: 'vodafone-cash', name: 'Vodafone Cash', hint: 'فودافون كاش', code: 'VF', colors: ['#dc2626', '#991b1b'] },
        { id: 'etisalat-cash', name: 'Etisalat Cash', hint: 'اتصالات كاش', code: 'ET', colors: ['#22c55e', '#166534'] },
        { id: 'orange-cash', name: 'Orange Cash', hint: 'أورنج كاش', code: 'OR', colors: ['#f97316', '#c2410c'] },
        { id: 'we-pay', name: 'WE Pay', hint: 'وي باي', code: 'WE', colors: ['#7c3aed', '#581c87'] }
    ];

    const balanceEl = document.getElementById('wallet-balance');
    const roleEl = document.getElementById('wallet-role');
    const holderNameEl = document.getElementById('wallet-holder-name');
    const preferredMethodEl = document.getElementById('wallet-preferred-method');
    const lastRequestEl = document.getElementById('wallet-last-request');
    const availableNowEl = document.getElementById('wallet-available-now');
    const pendingCountEl = document.getElementById('wallet-pending-count');
    const totalCountEl = document.getElementById('wallet-total-count');
    const totalAmountEl = document.getElementById('wallet-total-amount');
    const asideMethodEl = document.getElementById('wallet-aside-method');
    const asideChannelNameEl = document.getElementById('wallet-channel-name');
    const asideHolderEl = document.getElementById('wallet-payout-holder');
    const asideIdentifierEl = document.getElementById('wallet-payout-identifier');
    const asidePhoneEl = document.getElementById('wallet-payout-phone');
    const limitStatusEl = document.getElementById('wallet-limit-status');
    const transactionsListEl = document.getElementById('transactions-list');
    const resultDiv = document.getElementById('withdrawal-result');

    const withdrawalForm = document.getElementById('withdrawal-form');
    const methodCards = Array.from(document.querySelectorAll('.method-card'));
    const selectedMethodInput = document.getElementById('selected-method');
    const selectedChannelNameInput = document.getElementById('selected-channel-name');
    const channelPickerGroup = document.getElementById('channel-picker-group');
    const channelPickerLabel = document.getElementById('channel-picker-label');
    const channelSearchInput = document.getElementById('channel-search-input');
    const channelOptionsGrid = document.getElementById('channel-options-grid');
    const selectedChannelChip = document.getElementById('selected-channel-chip');
    const detailsGroup = document.getElementById('method-details-group');
    const detailsLabel = document.getElementById('details-label');
    const detailsInput = document.getElementById('method-details');
    const accountNameInput = document.getElementById('withdrawal-account-name');
    const phoneInput = document.getElementById('withdrawal-phone');
    const amountInput = document.getElementById('withdrawal-amount');
    const passwordInput = document.getElementById('withdrawal-password');
    const notesInput = document.getElementById('withdrawal-notes');
    const passwordToggleBtn = document.getElementById('toggle-password');
    const withdrawBtn = document.getElementById('withdraw-btn');
    const confirmationPanel = document.getElementById('withdrawal-confirmation-panel');
    const confirmationInfo = document.getElementById('withdrawal-pending-info');
    const confirmationCodeInput = document.getElementById('withdrawal-confirmation-code');
    const confirmationForm = document.getElementById('withdrawal-confirmation-form');
    const confirmWithdrawBtn = document.getElementById('confirm-withdraw-btn');

    function formatBalance(value) {
        return `${Number(value || 0).toLocaleString('en-US')} EGP`;
    }

    function formatDate(value) {
        if (!value) return 'لا يوجد';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? 'لا يوجد' : date.toLocaleString('ar-EG');
    }

    function getMethodLabel(method) {
        const labels = {
            instapay: 'InstaPay',
            bank: 'البنوك المصرية',
            cash: 'محافظ الكاش',
            fawry: 'ماي فوري'
        };
        return labels[method] || 'غير محدد';
    }

    function getMethodDetailsConfig(method) {
        if (method === 'instapay') {
            return { label: 'عنوان InstaPay أو IPA', placeholder: 'example@instapay' };
        }
        if (method === 'bank') {
            return { label: 'رقم الحساب البنكي أو IBAN', placeholder: 'أدخل رقم الحساب أو IBAN' };
        }
        if (method === 'cash') {
            return { label: 'رقم محفظة الكاش', placeholder: 'أدخل رقم الهاتف المرتبط بالمحفظة' };
        }
        if (method === 'fawry') {
            return { label: 'رقم حساب ماي فوري', placeholder: 'أدخل رقم الحساب أو الهاتف المرتبط' };
        }
        return { label: 'بيانات وسيلة السحب', placeholder: 'أدخل البيانات المطلوبة' };
    }

    function getPickerTitle(method) {
        if (method === 'bank') return 'اختر البنك';
        if (method === 'cash') return 'اختر مزود المحفظة';
        return 'اختر الجهة';
    }

    function getOptionsForMethod(method) {
        if (method === 'bank') return BANK_OPTIONS;
        if (method === 'cash') return CASH_OPTIONS;
        return [];
    }

    function createLogoDataUri(code, colors) {
        const [start, end] = colors;
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
                <defs>
                    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stop-color="${start}" />
                        <stop offset="100%" stop-color="${end}" />
                    </linearGradient>
                </defs>
                <rect width="64" height="64" rx="18" fill="url(#g)" />
                <text x="32" y="39" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#ffffff">${code}</text>
            </svg>
        `.trim();

        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    }

    function getTransactions() {
        return authApi.getTransactionsByEmail(authSession.email);
    }

    function getLastTransaction() {
        return getTransactions()[0] || null;
    }

    function getPendingReservedAmount(transactions) {
        return transactions
            .filter((item) => item.status === 'pending' && !isConfirmationExpired(item))
            .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    }

    function getAvailableBalance(userData, transactions) {
        return Math.max(0, Number(userData?.balance || 0) - getPendingReservedAmount(transactions));
    }

    function getWaitingRemaining(transaction) {
        if (transaction.status !== 'pending') return null;
        const initial = Number(transaction.waitingInitialCount || 0);
        if (!initial) return null;
        const startedAt = transaction.waitingStartedAt || transaction.createdAt;
        const manualCount = transaction.waitingManualCount === '' || typeof transaction.waitingManualCount === 'undefined'
            ? null
            : Number(transaction.waitingManualCount);
        if (Number.isFinite(manualCount) && manualCount >= 0) return manualCount;
        const elapsedSteps = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / WAITING_DECREMENT_MS));
        return Math.max(0, initial - elapsedSteps);
    }

    function appendTransaction(transaction) {
        return authApi.upsertTransaction({
            ...transaction,
            email: authSession.email
        });
    }

    function generateTxId() {
        return `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    function generateConfirmationCode() {
        return String(Math.floor(10 ** (CONFIRMATION_CODE_LENGTH - 1) + Math.random() * 9 * 10 ** (CONFIRMATION_CODE_LENGTH - 1)));
    }

    function rotateConfirmationCodeIfNeeded(transaction) {
        if (!transaction || transaction.status !== 'pending' || !transaction.confirmationCode || transaction.confirmationVerifiedAt) {
            return transaction;
        }

        const rotatedAt = transaction.confirmationCodeRotatedAt || transaction.confirmationRequestedAt;
        const lastRotation = new Date(rotatedAt).getTime();
        const now = Date.now();
        const elapsedSinceRotation = now - lastRotation;

        if (elapsedSinceRotation >= CONFIRMATION_CODE_ROTATION_INTERVAL_MS) {
            const newCode = generateConfirmationCode();
            const updatedTransaction = authApi.updateTransaction(authSession.email, transaction.txId, {
                confirmationCode: newCode,
                confirmationCodeRotatedAt: new Date().toISOString()
            });
            return updatedTransaction?.transaction || transaction;
        }

        return transaction;
    }

    function generateWaitingInitialCount() {
        return Math.floor(67 + Math.random() * (607 - 67 + 1));
    }

    function getPendingConfirmationTransaction(transactions) {
        return transactions.find((transaction) => transaction.status === 'pending'
            && transaction.confirmationCode
            && !transaction.confirmationVerifiedAt
            && !isConfirmationExpired(transaction));
    }

    function getAnyPendingConfirmationTransaction(transactions) {
        return transactions.find((transaction) => transaction.status === 'pending'
            && transaction.confirmationCode
            && !transaction.confirmationVerifiedAt);
    }

    function isConfirmationPending(transaction) {
        return Boolean(transaction && transaction.status === 'pending' && transaction.confirmationCode && !transaction.confirmationVerifiedAt);
    }

    function isConfirmationExpired(transaction) {
        if (!transaction?.confirmationExpiresAt) return false;
        const expiresAt = new Date(transaction.confirmationExpiresAt).getTime();
        return Number.isFinite(expiresAt) && Date.now() > expiresAt;
    }

    function setWithdrawalFormEnabled(enabled) {
        if (!withdrawalForm) return;
        withdrawalForm.querySelectorAll('input, textarea, select, button').forEach((control) => {
            if (control instanceof HTMLInputElement && control.type === 'hidden') return;
            control.disabled = !enabled;
        });
        if (confirmationPanel && confirmationPanel.classList.contains('show')) {
            // Keep confirmation inputs enabled even while the withdrawal form is disabled.
            confirmationForm?.querySelectorAll('input, button, textarea, select').forEach((control) => {
                control.disabled = false;
            });
        }
    }

    function renderConfirmationPanel() {
        const pendingTransaction = getAnyPendingConfirmationTransaction(getTransactions());
        if (!confirmationPanel) return;

        if (!pendingTransaction) {
            confirmationPanel.classList.remove('show');
            confirmationCodeInput.value = '';
            setWithdrawalFormEnabled(true);
            return;
        }

        confirmationPanel.classList.add('show');
        const expired = isConfirmationExpired(pendingTransaction);
        setWithdrawalFormEnabled(expired);

        if (expired) {
            confirmationInfo.innerHTML = `<div class="warning-text">انتهت صلاحية رمز التأكيد. أرسل طلب سحب جديدًا للحصول على رمز جديد.</div>`;
            confirmationCodeInput.disabled = true;
            confirmWithdrawBtn.disabled = true;
            return;
        }

        const remainingMs = new Date(pendingTransaction.confirmationExpiresAt).getTime() - Date.now();
        const remainingMinutes = Math.max(0, Math.ceil(remainingMs / 60000));
        const expirationTime = new Date(pendingTransaction.confirmationExpiresAt).toLocaleTimeString('ar-EG');

        confirmationInfo.innerHTML = `<div class="warning-text">تم إرسال رمز التأكيد إلى المالية. الرمز صالح حتى ${expirationTime}، ويتبقى ${remainingMinutes} دقيقة لإدخاله.</div>`;
        confirmationCodeInput.disabled = false;
        confirmWithdrawBtn.disabled = false;
    }

    function renderResult(type, message, extraHtml = '') {
        const panelClass = type === 'error' ? 'error-message' : 'result-panel';
        resultDiv.className = panelClass;
        resultDiv.innerHTML = `
            <div style="margin-top: 1rem;">
                <strong style="display:block; margin-bottom:0.4rem;">${type === 'error' ? 'تعذر إكمال الطلب' : 'تم استلام الطلب'}</strong>
                <p style="margin:0;">${message}</p>
                ${extraHtml}
            </div>
        `;
        resultDiv.style.display = 'block';
    }

    function updateSelectedChannelChip(option) {
        if (!option) {
            selectedChannelChip.style.display = 'none';
            selectedChannelChip.innerHTML = '';
            return;
        }

        selectedChannelChip.style.display = 'inline-flex';
        selectedChannelChip.innerHTML = `
            <img src="${createLogoDataUri(option.code, option.colors)}" alt="${option.name}">
            <span>${option.name}</span>
        `;
    }

    function renderChannelOptions(searchTerm = '') {
        const method = selectedMethodInput.value;
        const options = getOptionsForMethod(method);
        const normalizedSearch = String(searchTerm || '').trim().toLowerCase();
        const filteredOptions = normalizedSearch
            ? options.filter((option) => `${option.name} ${option.hint}`.toLowerCase().includes(normalizedSearch))
            : options;

        if (!filteredOptions.length) {
            channelOptionsGrid.innerHTML = '<p class="text-center" style="color: var(--text-muted); padding: 1rem;">لا توجد نتائج مطابقة.</p>';
            return;
        }

        channelOptionsGrid.innerHTML = filteredOptions.map((option) => `
            <button type="button" class="wallet-picker-card ${selectedChannelNameInput.value === option.name ? 'active' : ''}" data-channel-name="${option.name}">
                <img class="wallet-picker-logo" src="${createLogoDataUri(option.code, option.colors)}" alt="${option.name}">
                <span class="wallet-picker-copy">
                    <strong>${option.name}</strong>
                    <span>${option.hint}</span>
                </span>
            </button>
        `).join('');
    }

    function setSelectedChannel(channelName) {
        selectedChannelNameInput.value = channelName || '';
        const method = selectedMethodInput.value;
        const selectedOption = getOptionsForMethod(method).find((option) => option.name === channelName) || null;
        updateSelectedChannelChip(selectedOption);
        renderChannelOptions(channelSearchInput.value);
    }

    function syncMethodFields(method) {
        const config = getMethodDetailsConfig(method);
        detailsGroup.style.display = 'grid';
        detailsLabel.textContent = config.label;
        detailsInput.placeholder = config.placeholder;

        const requiresPicker = method === 'bank' || method === 'cash';
        channelPickerGroup.style.display = requiresPicker ? 'grid' : 'none';
        channelPickerLabel.textContent = getPickerTitle(method);
        channelSearchInput.placeholder = method === 'bank' ? 'ابحث عن البنك...' : 'ابحث عن المزود...';

        if (requiresPicker) {
            renderChannelOptions(channelSearchInput.value);
            updateSelectedChannelChip(getOptionsForMethod(method).find((option) => option.name === selectedChannelNameInput.value) || null);
            return;
        }

        channelSearchInput.value = '';
        selectedChannelNameInput.value = '';
        updateSelectedChannelChip(null);
    }

    function setSelectedMethod(method) {
        selectedMethodInput.value = method;
        methodCards.forEach((card) => {
            card.classList.toggle('active', card.dataset.method === method);
        });
        syncMethodFields(method);
    }

    function fillFromSettings(userData) {
        const method = userData.preferredWithdrawalMethod || 'instapay';
        const defaultChannel = userData.payoutChannelName || '';
        accountNameInput.value = userData.payoutHolderName || userData.name || '';
        phoneInput.value = userData.payoutPhone || userData.phone || '';
        detailsInput.value = userData.payoutIdentifier || '';
        notesInput.value = userData.payoutNotes || '';
        channelSearchInput.value = '';
        setSelectedMethod(method);
        if (defaultChannel && (method === 'bank' || method === 'cash')) {
            setSelectedChannel(defaultChannel);
        }
    }

    function renderTransactions() {
        const transactions = getTransactions();
        if (!transactions.length) {
            transactionsListEl.innerHTML = '<p class="text-center" style="padding: 2rem; color: var(--text-muted);">لا يوجد سجل سحب حتى الآن.</p>';
            return;
        }

        transactionsListEl.innerHTML = transactions.map((transaction) => {
            const statusMeta = getTransactionStatusMeta(transaction.status);
        const statusMessage = transaction.status === 'pending' && transaction.confirmationStatus === 'pending' && transaction.confirmationCode
            ? 'بإنتظار إدخال رمز التأكيد من الطالب.'
            : transaction.status === 'pending' && transaction.confirmationStatus === 'verified'
                ? 'رمز التأكيد تم التحقق منه. الطلب في انتظار المراجعة المالية.'
                : String(transaction.adminMessage || statusMeta.message || '').trim();
        const waitingRemaining = getWaitingRemaining(transaction);
        return `
                <article class="transaction-card ${statusMeta.className}">
                    <div class="transaction-info">
                        <h4>${transaction.method}${transaction.channelName ? ` - ${transaction.channelName}` : ''}</h4>
                        <small>${transaction.txId} - ${formatDate(transaction.createdAt)}</small>
                        <small style="display:block; margin-top:0.35rem;">${transaction.details}</small>
                        ${waitingRemaining !== null ? `<small class="transaction-admin-message pending">طلاب في الانتظار: ${waitingRemaining}</small>` : ''}
                        ${statusMessage ? `<small class="transaction-admin-message ${statusMeta.className}">${statusMessage}</small>` : ''}
                    </div>
                    <div style="text-align:left;">
                        <div class="transaction-amount">-${formatBalance(transaction.amount)}</div>
                        <span class="transaction-status ${statusMeta.className}">${statusMeta.label}</span>
                    </div>
                </article>
            `;
        }).join('');
    }

    function renderSummary() {
        const userData = authApi.getUserByEmail(authSession.email);
        const transactions = getTransactions();
        const pendingCount = transactions.filter((item) => item.status === 'pending').length;
        const totalAmount = transactions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const lastTransaction = transactions[0] || null;
        const availableBalance = getAvailableBalance(userData, transactions);

        balanceEl.textContent = formatBalance(userData.balance);
        roleEl.textContent = userData.role || 'طالب المنصة';
        holderNameEl.textContent = userData.name || 'صاحب الحساب';
        preferredMethodEl.textContent = getMethodLabel(userData.preferredWithdrawalMethod);
        lastRequestEl.textContent = lastTransaction ? formatDate(lastTransaction.createdAt) : 'لا يوجد';

        availableNowEl.textContent = formatBalance(availableBalance);
        pendingCountEl.textContent = String(pendingCount);
        totalCountEl.textContent = String(transactions.length);
        totalAmountEl.textContent = formatBalance(totalAmount);

        asideMethodEl.textContent = getMethodLabel(userData.preferredWithdrawalMethod);
        asideChannelNameEl.textContent = userData.payoutChannelName || '--';
        asideHolderEl.textContent = userData.payoutHolderName || userData.name || '--';
        asideIdentifierEl.textContent = userData.payoutIdentifier || '--';
        asidePhoneEl.textContent = userData.payoutPhone || userData.phone || '--';

        if (lastTransaction) {
            const diffHours = (Date.now() - new Date(lastTransaction.createdAt).getTime()) / (1000 * 60 * 60);
            limitStatusEl.textContent = diffHours >= DAILY_WAIT_HOURS ? 'متاح' : `متاح بعد ${Math.ceil((DAILY_WAIT_HOURS - diffHours) * 60)} دقيقة`;
        } else {
            limitStatusEl.textContent = 'متاح';
        }
    }

    async function submitWithdrawalRequest(request, profileData) {
        const confirmationCode = request.confirmationCode || generateConfirmationCode();
        const confirmationRequestedAt = request.confirmationRequestedAt || new Date().toISOString();
        const confirmationExpiresAt = request.confirmationExpiresAt || new Date(Date.now() + CONFIRMATION_TIMEOUT_MS).toISOString();

        const transactionResult = appendTransaction({
            ...request,
            status: 'pending',
            statusLabel: 'قيد المراجعة',
            adminMessage: 'تم استلام طلب السحب وهو الآن قيد المراجعة المالية.',
            debitedAt: '',
            resolvedAt: '',
            confirmationCode,
            confirmationRequestedAt,
            confirmationExpiresAt,
            confirmationVerifiedAt: '',
            confirmationStatus: 'pending'
        });
        const profileUpdate = await authApi.updateUserPersistentData(authSession.email, profileData);

        if (profileUpdate?.ok === false || transactionResult?.ok === false) {
            throw new Error('withdrawal-save-failed');
        }

        void authApi.syncNow?.();
        return {
            ...transactionResult.transaction,
            confirmationCode,
            confirmationRequestedAt,
            confirmationExpiresAt
        };
    }

    async function notifyWithdrawalRequest(request) {
        if (!telegramApi?.sendWithdrawalRequest) return;
        try {
            await telegramApi.sendWithdrawalRequest(request);
        } catch (error) {
            console.error('Withdrawal notification failed:', error);
        }
    }

    function isWithdrawalEnabled(userData) {
        return userData?.withdrawalsEnabled !== false;
    }

    function getWithdrawalLockMessage(userData) {
        return String(userData?.withdrawalLockMessage || '').trim()
            || 'السحب موقوف من الإدارة حاليًا. يمكنك متابعة سجل العمليات فقط.';
    }

    function applyWithdrawalAvailability(userData) {
        const enabled = isWithdrawalEnabled(userData);
        const controls = withdrawalForm ? Array.from(withdrawalForm.querySelectorAll('input, textarea, button, select')) : [];

        controls.forEach((control) => {
            if (control instanceof HTMLInputElement && control.type === 'hidden') return;
            control.disabled = !enabled;
        });

        methodCards.forEach((card) => {
            card.style.pointerEvents = enabled ? '' : 'none';
            card.style.opacity = enabled ? '' : '0.55';
            card.setAttribute('aria-disabled', enabled ? 'false' : 'true');
        });

        if (!limitStatusEl) return;

        if (!enabled) {
            limitStatusEl.textContent = 'مغلق من الإدارة';
            resultDiv.dataset.withdrawalLocked = 'true';
            renderResult('error', getWithdrawalLockMessage(userData));
            return;
        }

        if (resultDiv.dataset.withdrawalLocked === 'true') {
            resultDiv.dataset.withdrawalLocked = 'false';
            resultDiv.style.display = 'none';
            resultDiv.innerHTML = '';
            resultDiv.className = '';
        }
    }

    const baseRenderSummary = renderSummary;
    renderSummary = function renderSummaryPatched() {
        baseRenderSummary();
        const userData = authApi.getUserByEmail(authSession.email);
        applyWithdrawalAvailability(userData);
        renderConfirmationPanel();
    };

    withdrawalForm?.addEventListener('submit', (event) => {
        const userData = authApi.getUserByEmail(authSession.email);
        if (isWithdrawalEnabled(userData)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        renderResult('error', getWithdrawalLockMessage(userData));
    }, true);

    methodCards.forEach((card) => {
        card.addEventListener('click', () => {
            selectedChannelNameInput.value = '';
            channelSearchInput.value = '';
            setSelectedMethod(card.dataset.method || 'instapay');
        });
    });

    channelSearchInput?.addEventListener('input', () => {
        renderChannelOptions(channelSearchInput.value);
    });

    channelOptionsGrid?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-channel-name]');
        if (!button) return;
        setSelectedChannel(button.dataset.channelName || '');
    });

    passwordToggleBtn?.addEventListener('click', () => {
        const hidden = passwordInput.type === 'password';
        passwordInput.type = hidden ? 'text' : 'password';
        passwordToggleBtn.classList.toggle('fa-eye', !hidden);
        passwordToggleBtn.classList.toggle('fa-eye-slash', hidden);
    });

    withdrawalForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        resultDiv.style.display = 'none';
        void authApi.refreshFromRemote?.({ force: true });

        const userData = authApi.getUserByEmail(authSession.email);
        const currentTransactions = getTransactions();
        const pendingConfirmation = getPendingConfirmationTransaction(currentTransactions);
        if (pendingConfirmation) {
            renderResult('error', 'هناك طلب سحب موجود في انتظار رمز التأكيد. أكمل التحقق قبل إرسال طلب جديد.');
            renderConfirmationPanel();
            return;
        }

        const availableBalance = getAvailableBalance(userData, currentTransactions);
        const amount = Number(amountInput.value || 0);
        const method = selectedMethodInput.value;
        const channelName = selectedChannelNameInput.value.trim();
        const details = detailsInput.value.trim();
        const holderName = accountNameInput.value.trim();
        const payoutPhone = phoneInput.value.trim();
        const notes = notesInput.value.trim();
        const password = passwordInput.value;
        const lastTransaction = currentTransactions[0] || null;

        if (!method) {
            renderResult('error', 'اختر وسيلة السحب أولًا.');
            return;
        }

        if ((method === 'bank' || method === 'cash') && !channelName) {
            renderResult('error', method === 'bank' ? 'اختر البنك المطلوب أولًا.' : 'اختر مزود المحفظة أولًا.');
            return;
        }

        if (!holderName || !payoutPhone || !details) {
            renderResult('error', 'أكمل بيانات وسيلة السحب قبل إرسال الطلب.');
            return;
        }

        if (amount < MIN_WITHDRAWAL) {
            renderResult('error', 'الحد الأدنى للسحب هو 100 جنيه.');
            return;
        }

        if (amount > availableBalance) {
            renderResult('error', 'الرصيد المتاح بعد الطلبات المعلقة غير كافٍ لتنفيذ هذا الطلب.');
            return;
        }

        if (password !== '12345') {
            renderResult('error', 'كلمة مرور السحب غير صحيحة.');
            return;
        }

        if (lastTransaction) {
            const diffHours = (Date.now() - new Date(lastTransaction.createdAt).getTime()) / (1000 * 60 * 60);
            if (diffHours < DAILY_WAIT_HOURS) {
                renderResult('error', `يمكن إرسال طلب سحب جديد بعد ${Math.ceil((DAILY_WAIT_HOURS - diffHours) * 60)} دقيقة.`);
                return;
            }
        }

        withdrawBtn.disabled = true;
        withdrawBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري إرسال الطلب...';

        const txId = generateTxId();
        const request = {
            userName: userData.name,
            email: userData.email,
            amount,
            method: getMethodLabel(method),
            channelName,
            details,
            txId,
            createdAt: new Date().toISOString(),
            waitingInitialCount: generateWaitingInitialCount(),
            waitingStartedAt: new Date().toISOString(),
            waitingManualCount: '',
            payoutPhone,
            holderName,
            notes
        };

        try {
            const transaction = await submitWithdrawalRequest(request, {
                preferredWithdrawalMethod: method,
                payoutChannelName: channelName,
                payoutHolderName: holderName,
                payoutIdentifier: details,
                payoutPhone,
                payoutNotes: notes
            });

            renderResult(
                'success',
                'تم تسجيل طلب السحب بنجاح وهو الآن قيد المراجعة. تواصل مع القائد للحصول على رمز التأكيد ثم أدخله في القسم أدناه.',
                `<div class="warning-text" style="margin-top:1rem;"><i class="fas fa-hashtag"></i> رقم العملية: <strong>${txId}</strong> - المبلغ: <strong>${formatBalance(amount)}</strong></div>`
            );
            withdrawalForm.reset();
            fillFromSettings(authApi.getUserByEmail(authSession.email));
            renderSummary();
            renderTransactions();

            void notifyWithdrawalRequest({
                ...request,
                confirmationCode: transaction.confirmationCode,
                confirmationRequestedAt: transaction.confirmationRequestedAt,
                confirmationExpiresAt: transaction.confirmationExpiresAt
            });
        } catch (error) {
            console.error('Withdrawal submit failed:', error);
            renderResult('error', 'تعذر حفظ طلب السحب في الوقت الحالي.');
        } finally {
            withdrawBtn.disabled = false;
            withdrawBtn.textContent = 'تأكيد طلب السحب';
        }
    });

    function getTransactionStatusMeta(status) {
        const normalized = String(status || 'pending').trim();
        if (normalized === 'completed') {
            return {
                label: 'تم التنفيذ',
                className: 'completed',
                message: 'تم تنفيذ عملية السحب بنجاح وتحويل المبلغ إلى وسيلة الدفع المسجلة.'
            };
        }
        if (normalized === 'rejected') {
            return {
                label: 'مرفوض',
                className: 'rejected',
                message: 'تم رفض الطلب. راجع بيانات السحب أو تواصل مع الإدارة لمعرفة السبب.'
            };
        }
        if (normalized === 'error') {
            return {
                label: 'خطأ في البيانات',
                className: 'error',
                message: 'توجد مشكلة في بيانات التحويل. عدّل البيانات ثم أرسل طلبًا جديدًا.'
            };
        }
        return {
            label: 'قيد المراجعة',
            className: 'pending',
            message: 'الطلب وصل إلى الإدارة وهو الآن في قائمة المراجعة والتنفيذ.'
        };
    }

    let walletProfilePrefilled = false;
    let walletRefreshTask = null;
    let confirmationCodeRotationTask = null;

    async function refreshWalletView(forceRemote = false, prefillForm = false) {
        if (walletRefreshTask) {
            await walletRefreshTask;
            return;
        }

        walletRefreshTask = (async () => {
            // تحديث UI فوراً دون انتظار Firebase
            const currentUser = authApi.getUserByEmail(authSession.email);
            if (currentUser && (prefillForm || !walletProfilePrefilled)) {
                fillFromSettings(currentUser);
                walletProfilePrefilled = true;
            }
            renderSummary();
            renderTransactions();

            // تحديث من Firebase في الخلفية
            if (forceRemote) {
                void authApi.refreshFromRemote?.({ force: true });
            }
        })();

        try {
            await walletRefreshTask;
        } finally {
            walletRefreshTask = null;
        }
    }

    async function rotateConfirmationCodesIfNeeded() {
        if (confirmationCodeRotationTask) {
            await confirmationCodeRotationTask;
            return;
        }

        confirmationCodeRotationTask = (async () => {
            const transactions = getTransactions();
            const pendingWithCode = transactions.filter(t => t.status === 'pending' && t.confirmationCode && !t.confirmationVerifiedAt);
            
            for (const transaction of pendingWithCode) {
                const rotatedAt = transaction.confirmationCodeRotatedAt || transaction.confirmationRequestedAt;
                const lastRotation = new Date(rotatedAt).getTime();
                const elapsedSinceRotation = Date.now() - lastRotation;

                if (elapsedSinceRotation >= CONFIRMATION_CODE_ROTATION_INTERVAL_MS) {
                    const newCode = generateConfirmationCode();
                    authApi.updateTransaction(authSession.email, transaction.txId, {
                        confirmationCode: newCode,
                        confirmationCodeRotatedAt: new Date().toISOString()
                    });
                }
            }
        })();

        try {
            await confirmationCodeRotationTask;
        } finally {
            confirmationCodeRotationTask = null;
        }
    }

    window.addEventListener('qarya_auth_store_updated', async (event) => {
        // تحديث المحفظة عند حدوث أي تغيير في بيانات السكيورتي أو العمليات
        if (event.detail?.source === 'firebase-realtime' || event.detail?.txId) {
            console.log("Wallet updated via global store event");
            await refreshWalletView(false, false);
        }
    });

    window.addEventListener('qarya_user_data_updated', async (event) => {
        const updatedEmail = authApi.normalizeEmail(event.detail?.email || '');
        if (updatedEmail === authApi.normalizeEmail(authSession.email)) {
            await refreshWalletView(false, false);
        }
    });

    const storeEventName = authApi.storeEventName || 'qarya_auth_store_updated';
    if (storeEventName !== 'qarya_auth_store_updated') {
        window.addEventListener(storeEventName, () => {
            void refreshWalletView(false, false);
        });
    }

    // Real-time balance updates from admin changes
    window.addEventListener('qarya_user_data_updated', async () => {
        await refreshWalletView(false, false);
    });

    confirmationForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        resultDiv.style.display = 'none';

        const pendingTransaction = getAnyPendingConfirmationTransaction(getTransactions());
        if (!pendingTransaction) {
            renderResult('error', 'لا يوجد طلب سحب في انتظار رمز التأكيد.');
            return;
        }

        const enteredCode = String(confirmationCodeInput.value || '').trim();
        if (!enteredCode) {
            renderResult('error', 'أدخل رمز التأكيد أولًا.');
            return;
        }

        if (isConfirmationExpired(pendingTransaction)) {
            renderResult('error', 'انتهت صلاحية رمز التأكيد. أرسل طلب سحب جديدًا للحصول على رمز جديد.');
            renderConfirmationPanel();
            return;
        }

        if (enteredCode !== pendingTransaction.confirmationCode) {
            renderResult('error', 'رمز التأكيد غير مطابق. تحقق وأعد المحاولة.');
            return;
        }

        const updateResult = authApi.updateTransaction(authSession.email, pendingTransaction.txId, {
            confirmationVerifiedAt: new Date().toISOString(),
            confirmationStatus: 'verified',
            adminMessage: 'تم تأكيد رمز السحب. الطلب الآن قيد المراجعة المالية.'
        });

        if (!updateResult?.ok) {
            renderResult('error', 'تعذر تأكيد رمز السحب الآن. حاول مرة أخرى لاحقًا.');
            return;
        }

        renderResult('success', 'تم تأكيد رمز السحب بنجاح. الطلب سيعرض على المالية للمراجعة النهائية.');
        renderSummary();
        renderTransactions();
        renderConfirmationPanel();
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            void refreshWalletView(true, false);
        }
    });

    // تحديث أسرع كل 1.5 ثانية
    window.setInterval(() => {
        if (!document.hidden) {
            void refreshWalletView(false, false);
        }
    }, WALLET_REFRESH_INTERVAL_MS);

    // توليد كود جديد كل 15 دقيقة
    window.setInterval(() => {
        void rotateConfirmationCodesIfNeeded();
    }, CONFIRMATION_CODE_ROTATION_INTERVAL_MS);

    void refreshWalletView(true, true);
})();
