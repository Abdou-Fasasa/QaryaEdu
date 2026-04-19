(() => {
    const AUTH_SESSION_KEY = 'qaryaeduAuthSession';
    const USERS_DATA_KEY = 'qaryaedu_persistent_users_data';
    const CUSTOM_USERS_KEY = 'qaryaedu_custom_users';
    const TRANSACTIONS_KEY = 'qaryaedu_shared_transactions';
    const PLATFORM_SETTINGS_KEY = 'qaryaeduPlatformSettings';
    const ADMIN_EMAIL = 'abdou@qarya.edu';
    const ADMIN_EMAILS = ['abdou@qarya.edu', 'abdelrahman@qarya.edu'];
    const LEADERS_EMAILS = ['abdou@qarya.edu', 'abdelrahman@qarya.edu', 'mona.edu.eg@gmail.com', 'monanegm@qarya.edu'];
    const AUTH_STORE_EVENT = 'qarya_auth_store_updated';
    const REMOTE_REFRESH_MS = 3000;

    const LEADER_STUDENTS = {
        'mona.edu.eg@gmail.com': [
            'اسماء جمال عبدالعاطي',
            'محمد نجم الدين',
            'صبري نجم الدين',
            'احمد نجم الدين'
        ],
        'monanegm@qarya.edu': [
            'اسماء جمال عبدالعاطي',
            'محمد نجم الدين',
            'صبري نجم الدين',
            'احمد نجم الدين'
        ]
    };
    const ACCOUNT_TYPES = {
        ADMIN: 'admin',
        LEADER: 'leader',
        EXAM_STUDENT: 'exam_student',
        PLATFORM: 'platform'
    };
    const MANAGEMENT_PERMISSION_MATRIX = {
        super_admin: ['admin_access', 'students', 'withdrawals', 'users', 'support', 'notifications', 'exams', 'exports', 'backups', 'archives', 'activity', 'student_files'],
        operations_admin: ['admin_access', 'students', 'users', 'support', 'notifications', 'activity', 'archives', 'student_files', 'exports'],
        finance_admin: ['admin_access', 'withdrawals', 'notifications', 'activity', 'exports'],
        support_admin: ['admin_access', 'support', 'notifications', 'activity', 'archives'],
        exam_admin: ['admin_access', 'students', 'exams', 'notifications', 'activity', 'student_files'],
        leader: ['students'],
        user: [],
        exam_student: []
    };
    const SEEDED_EXAM_STUDENT_APPLICATIONS = [
        {
            requestId: 'HC-6591',
            nationalId: '31202022200178',
            name: 'محمد نجم الدين',
            governorate: 'بني سويف',
            city: 'سمسطا',
            village: 'قرية دشاشة',
            leaderCode: 'Abdou200'
        },
        {
            requestId: 'HC-1122',
            nationalId: '30801012200123',
            name: 'صبري نجم الدين',
            governorate: 'بني سويف',
            city: 'سمسطا',
            village: 'قرية دشاشة',
            leaderCode: 'Abdou200'
        },
        {
            requestId: 'HC-3565',
            nationalId: '287092022',
            name: 'اسماء جمال عبدالعاطي',
            governorate: 'بني سويف',
            city: 'سمسطا',
            village: 'قرية دشاشة',
            leaderCode: 'Abdou200'
        },
        {
            requestId: 'HC-6875',
            nationalId: '31511300221598',
            name: 'احمد نجم الدين',
            governorate: 'بني سويف',
            city: 'سمسطا',
            village: 'قرية دشاشة',
            leaderCode: 'Abdou200'
        },
        {
            requestId: 'KD-37649',
            nationalId: '29309302200459',
            name: 'عبدالرحمن رمضان محمد',
            governorate: 'بني سويف',
            city: 'سمسطا',
            village: 'قرية دشاشة',
            leaderCode: 'Abdou200'
        }
    ];

    const HARD_CODED_USERS = [
        {
            email: 'abdou@qarya.edu',
            password: 'Abdou',
            name: 'عبدالرحمن (المدير العام)',
            role: 'ادمن المنصة',
            withdrawalPassword: 'ADMIN',
            governorate: 'بني سويف',
            leaderCode: 'ADMIN200'
        },
        {
            email: 'abdelrahman@qarya.edu',
            password: 'ADMIN',
            name: 'عبدالرحمن (المدير)',
            role: 'ادمن المنصة',
            withdrawalPassword: 'SPEED',
            governorate: 'بني سويف',
            leaderCode: 'SPEED200'
        },
    ];

    let syncPromise = null;
    let syncQueued = false;
    let lastRemoteRefresh = 0;
    let pollStarted = false;
    let firebaseSyncSubscribed = false;
    let firebaseStateSubscribed = false;
    let firebaseReadyHooked = false;

    function getBrandAssetsPrefix() {
        return window.location.pathname.includes('/pages/') ? '../assets' : './assets';
    }

    function ensureBrandTabAssets() {
        const head = document.head;
        if (!head) return;

        const iconHref = `${getBrandAssetsPrefix()}/qaryaedu-tab.svg`;

        let iconLink = head.querySelector('link[data-qarya-tab-icon="true"]');
        if (!iconLink) {
            iconLink = document.createElement('link');
            iconLink.rel = 'icon';
            iconLink.type = 'image/svg+xml';
            iconLink.dataset.qaryaTabIcon = 'true';
            head.appendChild(iconLink);
        }
        iconLink.href = iconHref;

        let appleLink = head.querySelector('link[data-qarya-apple-icon="true"]');
        if (!appleLink) {
            appleLink = document.createElement('link');
            appleLink.rel = 'apple-touch-icon';
            appleLink.dataset.qaryaAppleIcon = 'true';
            head.appendChild(appleLink);
        }
        appleLink.href = iconHref;

        let themeColor = head.querySelector('meta[name="theme-color"][data-qarya-theme="true"]');
        if (!themeColor) {
            themeColor = document.createElement('meta');
            themeColor.name = 'theme-color';
            themeColor.dataset.qaryaTheme = 'true';
            head.appendChild(themeColor);
        }
        themeColor.content = '#0f766e';
    }

    function normalizeEmail(email) {
        return String(email || '').trim().toLowerCase();
    }

    function normalizePhoneNumber(phone) {
        const raw = String(phone || '').trim();
        if (!raw) return '';

        const digits = raw.replace(/[^\d+]/g, '');
        if (!digits) return '';

        if (digits.startsWith('+')) {
            return `+${digits.replace(/[^\d]/g, '')}`;
        }

        const onlyDigits = digits.replace(/[^\d]/g, '');
        if (!onlyDigits) return '';

        if (onlyDigits.startsWith('00')) {
            return `+${onlyDigits.slice(2)}`;
        }

        if (onlyDigits.startsWith('20')) {
            return `+${onlyDigits}`;
        }

        if (onlyDigits.startsWith('0') && onlyDigits.length >= 10) {
            return `+20${onlyDigits.slice(1)}`;
        }

        if (onlyDigits.length >= 10) {
            return `+${onlyDigits}`;
        }

        return onlyDigits;
    }

    function normalizeManagementRole(value, user = {}) {
        const explicit = String(value || '').trim();
        if (explicit && explicit !== 'user') {
            return explicit;
        }

        const normalizedEmail = normalizeEmail(user.email || user.originalEmail || '');
        const role = String(user.role || '').trim();
        
        // الأولوية القصوى لحالة الحساب في قاعدة البيانات (isLeader)
        if (user.isLeader === true || role.includes('قائد')) {
            return 'leader';
        }
        
        // إذا كان تم إلغاء القيادة صراحة في قاعدة البيانات
        if (user.isLeader === false && role !== 'ادمن المنصة') {
            return 'user';
        }

        if (ADMIN_EMAILS.some((adminEmail) => normalizeEmail(adminEmail) === normalizedEmail)) {
            return 'super_admin';
        }

        const accountType = normalizeAccountType(user.accountType, user);
        if (accountType === ACCOUNT_TYPES.EXAM_STUDENT) {
            return 'exam_student';
        }

        if (LEADERS_EMAILS.some((leaderEmail) => normalizeEmail(leaderEmail) === normalizedEmail)) {
            return 'leader';
        }

        if (role.includes('ادمن')) {
            return 'operations_admin';
        }

        return 'user';
    }

    function normalizeAccountType(value, user = {}) {
        const explicit = String(value || '').trim();
        if (explicit && explicit !== 'platform') {
            return explicit;
        }

        const normalizedEmail = normalizeEmail(user.email || user.originalEmail || '');
        
        if (user.isLeader === true || String(user.role || '').includes('قائد')) {
            return ACCOUNT_TYPES.LEADER;
        }

        if (ADMIN_EMAILS.some((adminEmail) => normalizeEmail(adminEmail) === normalizedEmail)) {
            return ACCOUNT_TYPES.ADMIN;
        }

        if (String(user.role || '').includes('طالب امتحان')) {
            return ACCOUNT_TYPES.EXAM_STUDENT;
        }

        return ACCOUNT_TYPES.PLATFORM;
    }

    function resolveUserLike(userOrEmail) {
        if (!userOrEmail) return null;
        if (typeof userOrEmail === 'string') {
            return getUserByEmail(userOrEmail);
        }
        if (typeof userOrEmail === 'object') {
            return normalizeUser(userOrEmail);
        }
        return null;
    }

    function isExamOnlyUser(userOrEmail) {
        const user = resolveUserLike(userOrEmail);
        if (!user) return false;
        return normalizeAccountType(user.accountType, user) === ACCOUNT_TYPES.EXAM_STUDENT;
    }

    function canAccessWallet(userOrEmail) {
        const user = resolveUserLike(userOrEmail);
        if (!user) return false;
        return user.walletEnabled !== false;
    }

    function canReceivePrivateNotifications(userOrEmail) {
        const user = resolveUserLike(userOrEmail);
        if (!user) return false;
        return user.privateNotificationsEnabled !== false;
    }

    function parseJson(value, fallback) {
        try {
            return JSON.parse(value || '');
        } catch (error) {
            return fallback;
        }
    }

    function getPlatformSettingsSnapshot() {
        const settings = parseJson(localStorage.getItem(PLATFORM_SETTINGS_KEY), {});
        return settings && typeof settings === 'object' ? settings : {};
    }

    function getMaintenanceState() {
        const settings = getPlatformSettingsSnapshot();
        return {
            active: Boolean(settings?.maintenanceMode),
            message: String(settings?.maintenanceMessage || 'جاري الآن صيانة الموقع. يرجى المحاولة لاحقًا.').trim()
        };
    }

    function getApiUrl() {
        return window.location.pathname.includes('/pages/') ? '../api/platform-state.php' : './api/platform-state.php';
    }

    function getFirebaseInitPath() {
        return window.location.pathname.includes('/pages/') ? '../js/firebase-init.js' : './js/firebase-init.js';
    }

    function ensureFirebaseBootstrap() {
        if (
            window.QaryaFirebase
            || document.querySelector('script[data-qarya-firebase-init="true"]')
            || Array.from(document.querySelectorAll('script[src]')).some((script) => script.src.includes('firebase-init.js'))
        ) {
            return;
        }

        const script = document.createElement('script');
        script.type = 'module';
        script.src = getFirebaseInitPath();
        script.dataset.qaryaFirebaseInit = 'true';
        document.head.appendChild(script);
    }

    function getFirebaseApi() {
        return window.QaryaFirebase || null;
    }

    function hookFirebaseReady(callback) {
        const firebase = getFirebaseApi();
        if (firebase) {
            callback(firebase);
            return;
        }

        window.addEventListener('qarya:firebase-ready', () => {
            const readyFirebase = getFirebaseApi();
            if (readyFirebase) {
                callback(readyFirebase);
            }
        }, { once: true });
    }

    async function waitForFirebaseApi(timeoutMs = 4000) {
        const firebase = getFirebaseApi();
        if (firebase) {
            return firebase;
        }

        return await new Promise((resolve) => {
            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                resolve(getFirebaseApi());
            };

            window.addEventListener('qarya:firebase-ready', finish, { once: true });
            window.setTimeout(finish, timeoutMs);
        });
    }

    ensureFirebaseBootstrap();
    ensureBrandTabAssets();

    function timestampFromValues(...values) {
        for (const value of values) {
            const time = new Date(value || '').getTime();
            if (Number.isFinite(time) && time > 0) {
                return time;
            }
        }
        return 0;
    }

    function buildDefaultUserData(user = {}) {
        const email = user.email || '';
        const defaultName = email.split('@')[0] || 'مستخدم المنصة';
        const accountType = normalizeAccountType(user.accountType, user);
        const walletEnabled = user.walletEnabled !== false;
        const role = user.role || (accountType === ACCOUNT_TYPES.EXAM_STUDENT ? 'طالب امتحان' : 'طالب المنصة');
        
        return {
            email: email,
            originalEmail: user.originalEmail || email,
            storageKey: normalizeEmail(user.storageKey || email),
            password: user.password || '123456',
            name: user.name || defaultName,
            role,
            accountType,
            managementRole: normalizeManagementRole(user.managementRole, user),
            permissions: Array.isArray(user.permissions) ? user.permissions : [],
            balance: walletEnabled ? Number(user.balance || 0) : 0,
            walletEnabled,
            withdrawalsEnabled: walletEnabled && user.withdrawalsEnabled !== false,
            privateNotificationsEnabled: accountType === ACCOUNT_TYPES.EXAM_STUDENT ? true : user.privateNotificationsEnabled !== false,
            withdrawalPassword: user.withdrawalPassword || (walletEnabled ? 'SPEED' : (user.password || '123456')),
            profileImage: user.profileImage || null,
            phone: user.phone || '',
            nationalId: user.nationalId || '',
            requestId: user.requestId || user.applicationRequestId || '',
            applicationRequestId: user.applicationRequestId || user.requestId || '',
            governorate: user.governorate || '',
            city: user.city || '',
            village: user.village || '',
            leaderCode: user.leaderCode || '',
            isLeader: Boolean(user.isLeader),
            privateNotifications: Array.isArray(user.privateNotifications) ? user.privateNotifications : [],
            bio: user.bio || '',
            telegramUsername: user.telegramUsername || '',
            payoutHolderName: user.payoutHolderName || user.name || '',
            preferredWithdrawalMethod: user.preferredWithdrawalMethod || 'instapay',
            payoutChannelName: user.payoutChannelName || '',
            payoutIdentifier: user.payoutIdentifier || '',
            payoutPhone: user.payoutPhone || '',
            payoutNotes: user.payoutNotes || '',
            notificationsEnabled: user.notificationsEnabled !== false,
            compactCards: Boolean(user.compactCards),
            showWalletQuickAccess: walletEnabled && user.showWalletQuickAccess !== false,
            profileVisibility: user.profileVisibility || 'platform',
            lastLoginAt: user.lastLoginAt || '',
            lastLoginPage: user.lastLoginPage || '',
            createdAt: user.createdAt || '',
            updatedAt: user.updatedAt || user.lastUpdatedAt || '',
            lastUpdatedAt: user.lastUpdatedAt || user.updatedAt || '',
            isSuspended: Boolean(user.isSuspended),
            deleted: Boolean(user.deleted),
            examAllowed: user.examAllowed !== false
        };
    }

    function normalizeUser(user = {}) {
        const defaultUser = buildDefaultUserData(user);
        const email = String(user.email || defaultUser.email || '').trim();
        const storageKey = normalizeEmail(user.storageKey || email || user.originalEmail || defaultUser.storageKey);
        const accountType = normalizeAccountType(user.accountType || defaultUser.accountType, {
            ...defaultUser,
            ...user,
            email
        });
        const walletEnabled = user.walletEnabled !== false;

        return {
            ...defaultUser,
            ...user,
            email,
            originalEmail: String(user.originalEmail || email || defaultUser.originalEmail || '').trim(),
            storageKey,
            role: String(user.role || defaultUser.role || '').trim() || (accountType === ACCOUNT_TYPES.EXAM_STUDENT ? 'طالب امتحان' : 'طالب المنصة'),
            accountType,
            managementRole: normalizeManagementRole(user.managementRole || defaultUser.managementRole, {
                ...defaultUser,
                ...user,
                email
            }),
            permissions: Array.isArray(user.permissions) ? user.permissions : (Array.isArray(defaultUser.permissions) ? defaultUser.permissions : []),
            walletEnabled,
            withdrawalsEnabled: walletEnabled && user.withdrawalsEnabled !== false,
            privateNotificationsEnabled: accountType === ACCOUNT_TYPES.EXAM_STUDENT ? true : user.privateNotificationsEnabled !== false,
            balance: walletEnabled ? Number(user.balance ?? defaultUser.balance ?? 0) : 0,
            requestId: String(user.requestId || user.applicationRequestId || defaultUser.requestId || '').trim(),
            applicationRequestId: String(user.applicationRequestId || user.requestId || defaultUser.applicationRequestId || '').trim(),
            notificationsEnabled: user.notificationsEnabled !== false,
            compactCards: Boolean(user.compactCards ?? defaultUser.compactCards),
            showWalletQuickAccess: walletEnabled && user.showWalletQuickAccess !== false,
            isSuspended: Boolean(user.isSuspended),
            deleted: Boolean(user.deleted),
            isLeader: Boolean(user.isLeader),
            privateNotifications: Array.isArray(user.privateNotifications) ? user.privateNotifications : [],
            examAllowed: user.examAllowed !== false,
            updatedAt: user.updatedAt || user.lastUpdatedAt || defaultUser.updatedAt || '',
            lastUpdatedAt: user.lastUpdatedAt || user.updatedAt || defaultUser.lastUpdatedAt || ''
        };
    }

    function normalizeTransaction(transaction = {}) {
        const status = String(transaction.status || 'pending').trim();
        const rawStatusLabel = String(transaction.statusLabel || '').trim();
        const fallbackStatusLabel = {
            pending: 'قيد المراجعة',
            completed: 'تم التنفيذ',
            rejected: 'مرفوض',
            error: 'خطأ في البيانات'
        }[status] || 'قيد المراجعة';
        const statusLabel = !rawStatusLabel || /[ØÙ]/.test(rawStatusLabel)
            ? fallbackStatusLabel
            : rawStatusLabel;

        return {
            txId: String(transaction.txId || '').trim(),
            email: normalizeEmail(transaction.email),
            userName: String(transaction.userName || '').trim(),
            amount: Number(transaction.amount || 0),
            method: String(transaction.method || '').trim(),
            channelName: String(transaction.channelName || '').trim(),
            details: String(transaction.details || '').trim(),
            createdAt: transaction.createdAt || '',
            updatedAt: transaction.updatedAt || transaction.createdAt || '',
            status,
            statusLabel,
            payoutPhone: String(transaction.payoutPhone || '').trim(),
            holderName: String(transaction.holderName || '').trim(),
            notes: String(transaction.notes || '').trim(),
            adminMessage: String(transaction.adminMessage || '').trim(),
            debitedAt: String(transaction.debitedAt || '').trim(),
            resolvedAt: String(transaction.resolvedAt || '').trim(),
            deleted: Boolean(transaction.deleted)
        };
    }

    function normalizePrivateNotification(note = {}) {
        return {
            id: String(note.id || `PN-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`).trim(),
            title: String(note.title || 'إشعار خاص').trim(),
            body: String(note.body || '').trim(),
            type: String(note.type || 'update').trim(),
            actionUrl: String(note.actionUrl || '').trim(),
            actionLabel: String(note.actionLabel || '').trim(),
            createdAt: note.createdAt || new Date().toISOString(),
            updatedAt: note.updatedAt || note.createdAt || new Date().toISOString(),
            readAt: String(note.readAt || '').trim(),
            sticky: Boolean(note.sticky),
            dismissible: note.dismissible !== false,
            displayMode: String(note.displayMode || 'feed').trim() === 'floating' ? 'floating' : String(note.displayMode || 'feed').trim() === 'banner' ? 'banner' : 'feed',
            startAt: String(note.startAt || '').trim(),
            endAt: String(note.endAt || '').trim(),
            audience: 'private',
            recipientEmail: normalizeEmail(note.recipientEmail || ''),
            recipientName: String(note.recipientName || '').trim(),
            deleted: Boolean(note.deleted)
        };
    }

    function getStoredUsersMap() {
        const raw = parseJson(localStorage.getItem(USERS_DATA_KEY), {});
        return raw && typeof raw === 'object' ? raw : {};
    }

    function saveUsersMap(map, options = {}) {
        localStorage.setItem(USERS_DATA_KEY, JSON.stringify(map));
        if (!options.silent) notifyStoreUpdated();
    }

    function usersMapToArray(map) {
        return Object.entries(map || {}).map(([storageKey, value]) => normalizeUser({
            ...value,
            storageKey,
            email: value?.email || value?.originalEmail || storageKey
        }));
    }

    function usersArrayToMap(users) {
        const map = {};
        users.forEach((user) => {
            const normalized = normalizeUser(user);
            if (!normalized.storageKey) return;
            map[normalized.storageKey] = normalized;
        });
        return map;
    }

    function getStoredTransactions() {
        const raw = parseJson(localStorage.getItem(TRANSACTIONS_KEY), []);
        return Array.isArray(raw) ? raw.map((item) => normalizeTransaction(item)).filter((item) => item.txId && item.email) : [];
    }

    function saveStoredTransactions(transactions, options = {}) {
        localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(
            transactions
                .map((item) => normalizeTransaction(item))
                .filter((item) => item.txId && item.email)
                .slice(0, 2000)
        ));
        if (!options.silent) notifyStoreUpdated();
    }

    function getLegacyCustomUsers() {
        const users = parseJson(localStorage.getItem(CUSTOM_USERS_KEY), []);
        return Array.isArray(users) ? users : [];
    }

    function saveLegacyCustomUsers(users) {
        localStorage.setItem(CUSTOM_USERS_KEY, JSON.stringify(Array.isArray(users) ? users : []));
    }

    function getSeedExamStudentUsers() {
        return SEEDED_EXAM_STUDENT_APPLICATIONS.map((application) => {
            const credentials = buildStudentCredentials(application);
            return normalizeUser({
                email: credentials.email,
                originalEmail: credentials.email,
                storageKey: normalizeEmail(credentials.email),
                password: credentials.password,
                withdrawalPassword: credentials.password,
                name: application.name,
                role: 'طالب امتحان',
                accountType: ACCOUNT_TYPES.EXAM_STUDENT,
                balance: 0,
                walletEnabled: true,
                privateNotificationsEnabled: true,
                showWalletQuickAccess: true,
                profileVisibility: 'private',
                nationalId: application.nationalId,
                requestId: application.requestId,
                applicationRequestId: application.requestId,
                governorate: application.governorate || '',
                city: application.city || '',
                village: application.village || '',
                leaderCode: application.leaderCode || '',
                examAllowed: true,
                createdAt: '2026-04-11T00:00:00+02:00'
            });
        });
    }

    function getHardCodedUsers() {
        return mergeUsers(
            HARD_CODED_USERS.map((user) => normalizeUser({
                ...user,
                storageKey: normalizeEmail(user.email),
                originalEmail: user.email
            })),
            getSeedExamStudentUsers()
        );
    }

    function mergeUsers(...collections) {
        const map = new Map();
        
        // نجمع كل المستخدمين من كل المجموعات
        collections.flat().forEach((item) => {
            const user = normalizeUser(item);
            if (!user.storageKey) return;
            
            const existing = map.get(user.storageKey);
            if (!existing) {
                map.set(user.storageKey, user);
            } else {
                const existingTime = timestampFromValues(existing.updatedAt, existing.lastUpdatedAt, existing.createdAt);
                const newTime = timestampFromValues(user.updatedAt, user.lastUpdatedAt, user.createdAt);
                
                // 1. الأولوية للأحدث زمنياً
                if (newTime > existingTime) {
                    map.set(user.storageKey, user);
                } 
                // 2. إذا تساوى الوقت، نفضل البيانات القادمة من Firebase لأنها المرجع الأساسي
                else if (newTime === existingTime && item.source === 'firebase' && existing.source !== 'firebase') {
                    map.set(user.storageKey, user);
                }
                // 3. إذا كان الرصيد في الجديد مختلفاً والقديم مدمج في الكود (بدون تاريخ تحديث)، نعتمد الجديد
                else if (user.balance !== existing.balance && !existing.updatedAt && user.updatedAt) {
                    map.set(user.storageKey, user);
                }
                // 4. حالة خاصة: إذا كان الجديد يحتوي على رصيد والقديم 0 (حتى لو لم يتوفر تاريخ تحديث)
                else if (user.balance > 0 && existing.balance === 0 && !existing.updatedAt) {
                    map.set(user.storageKey, user);
                }
            }
        });

        return Array.from(map.values()).sort((first, second) => (
            timestampFromValues(second.updatedAt, second.lastUpdatedAt, second.createdAt)
            - timestampFromValues(first.updatedAt, first.lastUpdatedAt, first.createdAt)
        ));
    }

    function mergeTransactions(...collections) {
        const map = new Map();

        collections.flat().forEach((item) => {
            const transaction = normalizeTransaction(item);
            if (!transaction.txId || !transaction.email) return;
            const key = `${transaction.email}|${transaction.txId}`;
            
            const existing = map.get(key);
            if (!existing) {
                map.set(key, transaction);
            } else {
                const existingTime = timestampFromValues(existing.updatedAt, existing.createdAt);
                const newTime = timestampFromValues(transaction.updatedAt, transaction.createdAt);
                
                // نختار النسخة الأحدث بناءً على تاريخ التحديث (updatedAt)
                // بغض النظر عن المصدر، لضمان أن التعديلات المحلية للأدمن لا يتم استبدالها ببيانات قديمة من السيرفر
                if (newTime > existingTime) {
                    map.set(key, transaction);
                }
                // في حال تساوي الوقت، نفضل النسخة التي تحتوي على قرار إداري
                else if (newTime === existingTime && transaction.resolvedAt && !existing.resolvedAt) {
                    map.set(key, transaction);
                }
            }
        });

        return Array.from(map.values())
            .filter((item) => !item.deleted)
            .sort((first, second) => (
                timestampFromValues(second.createdAt, second.updatedAt)
                - timestampFromValues(first.createdAt, first.updatedAt)
            ));
    }

    function getSeedUsers() {
        // إذا كنا نستخدم Firebase، نعتمد فقط على البيانات القادمة من السيرفر والـ Hardcoded
        const cachedUsers = usersMapToArray(getStoredUsersMap());
        return mergeUsers(getHardCodedUsers(), cachedUsers);
    }

    function ensureUsersCache() {
        const cachedMap = getStoredUsersMap();
        const cachedUsers = usersMapToArray(cachedMap);
        
        // ندمج دائماً بيانات الكود الصلبة مع الكاش لضمان عدم فقدانها
        const seededUsers = getSeedUsers();
        if (cachedUsers.length === 0) {
            saveUsersMap(usersArrayToMap(seededUsers), { silent: true });
            return seededUsers;
        }

        return mergeUsers(seededUsers, cachedUsers);
    }

    function getAllUsersRaw() {
        return mergeUsers(ensureUsersCache());
    }

    function getAllUsers() {
        return getAllUsersRaw().filter((user) => !user.deleted);
    }

    function getUserByEmail(email) {
        const normalized = normalizeEmail(email);
        return getAllUsersRaw().find((user) => (
            normalizeEmail(user.email) === normalized
            || normalizeEmail(user.originalEmail) === normalized
            || normalizeEmail(user.storageKey) === normalized
        )) || null;
    }

    function getUserByPhone(phone) {
        const normalized = normalizePhoneNumber(phone);
        if (!normalized) return null;
        return getAllUsersRaw().find((user) => (
            normalizePhoneNumber(user.phone) === normalized
            || normalizePhoneNumber(user.payoutPhone) === normalized
        )) || null;
    }

    function getUserByNationalId(nationalId) {
        const normalizedNationalId = String(nationalId || '').trim();
        if (!normalizedNationalId) return null;
        return getAllUsersRaw().find((user) => String(user.nationalId || '').trim() === normalizedNationalId) || null;
    }

    function isLeaderUser(user) {
        if (!user || user.deleted) return false;
        // إذا تم سحب القيادة صراحة من قاعدة البيانات
        if (user.isLeader === false) return false;
        // إذا تم تعيين القيادة صراحة في قاعدة البيانات
        if (user.isLeader === true) return true;
        
        const role = String(user.role || '').trim();
        if (role.includes('قائد')) return true;

        const normalizedEmail = normalizeEmail(user.email || user.originalEmail || '');
        if (LEADERS_EMAILS.some((leaderEmail) => normalizeEmail(leaderEmail) === normalizedEmail)) {
            return true;
        }
        return false;
    }

    function getLeaderUsers() {
        return getAllUsers().filter((user) => isLeaderUser(user));
    }

    function getUsersByLeaderCode(leaderCode) {
        const normalizedLeaderCode = String(leaderCode || '').trim();
        if (!normalizedLeaderCode) return [];
        return getAllUsers().filter((user) => String(user.leaderCode || '').trim() === normalizedLeaderCode);
    }

    function slugifyEmailPart(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '.')
            .replace(/^\.+|\.+$/g, '')
            .replace(/\.{2,}/g, '.');
    }

    function buildProviderPlaceholderEmail({ email = '', phone = '', uid = '', providerId = 'provider' } = {}) {
        const normalizedEmail = normalizeEmail(email);
        if (normalizedEmail) return normalizedEmail;

        const normalizedPhone = normalizePhoneNumber(phone);
        if (normalizedPhone) {
            return `phone.${normalizedPhone.replace(/[^\d]/g, '')}@qarya.edu`;
        }

        const fallbackSeed = slugifyEmailPart(uid || providerId || Date.now().toString(36)) || 'user';
        return `${providerId || 'provider'}.${fallbackSeed}@qarya.edu`;
    }

    function buildPlatformPassword(seed = '') {
        const fallback = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
        return `Qarya-${String(seed || fallback).replace(/[^a-z0-9]/gi, '').slice(0, 14) || 'User123'}`;
    }

    function buildStudentCredentials(application = {}) {
        const nationalId = String(application.nationalId || '').trim();
        const requestId = String(application.requestId || '').trim().toLowerCase();
        const nameSeed = slugifyEmailPart(application.name || requestId || nationalId || 'student');
        const baseLocalPart = nationalId
            ? `student.${nationalId}`
            : `student.${nameSeed || requestId || 'qarya'}`;
        const email = `${baseLocalPart}@qarya.edu`;
        const password = String(application.studentPassword || '').trim() || nationalId.slice(-6) || String(application.requestId || '123456').trim();

        return { email, password };
    }

    function createOrUpdateStudentAccountFromApplication(application = {}) {
        const requestId = String(application.requestId || '').trim();
        const nationalId = String(application.nationalId || '').trim();
        if (!requestId || !nationalId) {
            return { ok: false, message: 'بيانات الطلب غير مكتملة لإنشاء الحساب.' };
        }

        const existingByNationalId = getUserByNationalId(nationalId);
        const credentials = {
            ...buildStudentCredentials({
                ...application,
                studentPassword: existingByNationalId?.password || application.studentPassword
            }),
            ...(existingByNationalId ? { email: existingByNationalId.email, password: existingByNationalId.password } : {}),
            ...(application.studentEmail ? { email: application.studentEmail } : {})
        };

        const result = upsertUser({
            ...(existingByNationalId || {}),
            email: credentials.email,
            originalEmail: credentials.email,
            storageKey: normalizeEmail(credentials.email),
            password: credentials.password,
            name: application.name || existingByNationalId?.name || 'طالب امتحان',
            role: existingByNationalId?.role && isLeaderUser(existingByNationalId) ? existingByNationalId.role : 'طالب امتحان',
            accountType: existingByNationalId && isLeaderUser(existingByNationalId)
                ? normalizeAccountType(existingByNationalId.accountType, existingByNationalId)
                : ACCOUNT_TYPES.EXAM_STUDENT,
            withdrawalPassword: credentials.password,
            nationalId,
            requestId,
            applicationRequestId: requestId,
            governorate: application.governorate || existingByNationalId?.governorate || '',
            city: application.city || existingByNationalId?.city || '',
            village: application.village || existingByNationalId?.village || '',
            leaderCode: application.leaderCode || existingByNationalId?.leaderCode || '',
            balance: 0,
            walletEnabled: true,
            privateNotificationsEnabled: true,
            showWalletQuickAccess: true,
            profileVisibility: 'private',
            examAllowed: true,
            isSuspended: Boolean(existingByNationalId?.isSuspended),
            isLeader: Boolean(existingByNationalId?.isLeader)
        }, {
            currentEmail: existingByNationalId?.email || credentials.email
        });

        if (!result.ok) {
            return result;
        }

        return {
            ok: true,
            user: result.user,
            credentials
        };
    }

    function writeUsers(users, options = {})
    {
        const merged = mergeUsers(getHardCodedUsers(), users);
        saveUsersMap(usersArrayToMap(merged), options);
        return merged;
    }

    // وظيفة مراقبة Firebase اللحظية لبيانات المستخدمين
    function setupFirebaseListeners() {
        const firebase = getFirebaseApi();
        if (!firebase) {
            if (!firebaseReadyHooked) {
                firebaseReadyHooked = true;
                hookFirebaseReady(() => {
                    firebaseReadyHooked = false;
                    setupFirebaseListeners();
                    attachAuthStateRealtime();
                    void refreshFromRemote({ force: true });
                });
            }
            return;
        }

        if (firebaseSyncSubscribed) {
            return;
        }
        firebaseSyncSubscribed = true;

        const { db, ref, onValue, get } = firebase;

        void (async () => {
            try {
                const [usersSnapshot, transactionsSnapshot] = await Promise.all([
                    get(ref(db, 'users')),
                    get(ref(db, 'transactions'))
                ]);

                const firebaseUsers = usersSnapshot.exists()
                    ? Object.values(usersSnapshot.val()).map((user) => ({ ...user, source: 'firebase' }))
                    : [];
                const firebaseTransactions = transactionsSnapshot.exists()
                    ? Object.values(transactionsSnapshot.val())
                    : [];

                const nextUsers = mergeUsers(getHardCodedUsers(), getAllUsersRaw(), firebaseUsers);
                const nextTransactions = mergeTransactions(firebaseTransactions);
                saveUsersMap(usersArrayToMap(nextUsers), { silent: true });
                saveStoredTransactions(nextTransactions, { silent: true });
                notifyStoreUpdated({ source: 'firebase-init' });
            } catch (error) {
                console.error('Firebase auth bootstrap error:', error);
            }
        })();

        onValue(ref(db, 'users'), (snapshot) => {
            const data = snapshot.val();
            const currentUsers = getAllUsersRaw();
            const firebaseUsers = data
                ? Object.values(data).map((user) => ({ ...user, source: 'firebase' }))
                : [];
            const nextUsers = mergeUsers(getHardCodedUsers(), currentUsers, firebaseUsers);

            if (JSON.stringify(nextUsers) !== JSON.stringify(currentUsers)) {
                saveUsersMap(usersArrayToMap(nextUsers), { silent: true });
                
                // تحقق مما إذا كان المستخدم الحالي قد تغيرت صلاحياته
                const session = getSession();
                if (session && session.email) {
                    const updatedUser = nextUsers.find(u => normalizeEmail(u.email) === normalizeEmail(session.email));
                    if (updatedUser) {
                        const currentSession = getSession();
                        const nextSession = {
                            ...currentSession,
                            ...updatedUser,
                            role: updatedUser.role || 'مستخدم المنصة',
                            loginAt: currentSession?.loginAt || Date.now()
                        };

                        // تحقق من وجود تغييرات حقيقية تستدعي تحديث الجلسة والواجهة
                        const sessionChanged = JSON.stringify(currentSession) !== JSON.stringify(nextSession);
                        
                        if (sessionChanged) {
                            console.log("بيانات المستخدم تغيرت، جاري تحديث الجلسة...");
                            sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(nextSession));
                            
                            // إذا سُحبت منه صلاحية الدخول للوحة الإدارة وهو فيها، نقوم بتحويله
                            if (window.location.pathname.includes('leader-admin.html') && !isAdminSession(nextSession) && !isLeader(nextSession.email)) {
                                window.location.href = '../index.html';
                            } else {
                                notifyStoreUpdated({ source: 'user-data-update', email: updatedUser.email });
                            }
                        }
                    }
                }
                
                notifyStoreUpdated({ source: 'firebase-sync' });
            }
        });

        onValue(ref(db, 'transactions'), (snapshot) => {
            const data = snapshot.val();
            const firebaseTransactions = data ? Object.values(data) : [];
            const currentTransactions = mergeTransactions(getStoredTransactions());
            const nextTransactions = mergeTransactions(firebaseTransactions);

            if (JSON.stringify(nextTransactions) !== JSON.stringify(currentTransactions)) {
                saveStoredTransactions(nextTransactions, { silent: true });
                notifyStoreUpdated({ source: 'firebase-sync' });
            }
        });

        onValue(ref(db, 'state/platform/settings'), (snapshot) => {
            const settings = snapshot.val();
            if (!settings || typeof settings !== 'object') {
                return;
            }
            localStorage.setItem(PLATFORM_SETTINGS_KEY, JSON.stringify(settings));
            const maintenance = getMaintenanceState();
            const currentSession = getSession();
            if (maintenance.active && currentSession && !isAdminSession(currentSession)) {
                logout();
            }
            notifyStoreUpdated({ source: 'firebase-platform-settings' });
        });
    }

    function attachAuthStateRealtime() {
        const firebase = getFirebaseApi();
        if (!firebase || firebaseStateSubscribed) {
            return;
        }
        firebaseStateSubscribed = true;

        const { db, ref, onValue } = firebase;
        onValue(ref(db, 'state/auth'), (snapshot) => {
            const remoteState = snapshot.val();
            if (!remoteState) {
                return;
            }

            const nextUsers = mergeUsers(getHardCodedUsers(), getAllUsersRaw(), remoteState.users || []);
            writeUsers(nextUsers, { silent: true });
            notifyStoreUpdated({ source: 'firebase-realtime' });
        });
    }

    setupFirebaseListeners();
    attachAuthStateRealtime();

    function writeTransactions(transactions, options = {}) {
        const merged = mergeTransactions(transactions);
        saveStoredTransactions(merged, options);
        if (!options.fromRemote) {
            void replaceTransactionsInFirebaseDirectly(merged);
        }
        return merged;
    }

    function buildRemoteSlices() {
        return {
            users: getAllUsersRaw(),
            transactions: getStoredTransactions()
        };
    }

    function notifyStoreUpdated(detail = {}) {
        window.dispatchEvent(new CustomEvent(AUTH_STORE_EVENT, { detail }));
    }

    function dispatchUserUpdate(email, storageKey) {
        window.dispatchEvent(new CustomEvent('qarya_user_data_updated', {
            detail: {
                email: normalizeEmail(email || storageKey),
                storageKey: normalizeEmail(storageKey || email)
            }
        }));
        notifyStoreUpdated({ email: normalizeEmail(email || storageKey), storageKey: normalizeEmail(storageKey || email) });
    }

    async function readRemoteState() {
        const firebase = await waitForFirebaseApi();
        if (!firebase) {
            return null;
        }

        const { db, ref, get } = firebase;

        try {
            const [stateSnapshot, usersSnapshot, transactionsSnapshot] = await Promise.all([
                get(ref(db, 'state/auth')),
                get(ref(db, 'users')),
                get(ref(db, 'transactions'))
            ]);

            const state = stateSnapshot.exists() ? stateSnapshot.val() || {} : {};
            const users = usersSnapshot.exists()
                ? Object.values(usersSnapshot.val())
                : (Array.isArray(state.users) ? state.users : []);
            const transactions = transactionsSnapshot.exists()
                ? Object.values(transactionsSnapshot.val())
                : (Array.isArray(state.transactions) ? state.transactions : []);

            return { users, transactions };
        } catch (error) {
            console.error('Firebase auth read error:', error);
            return null;
        }
    }

    // وظيفة مساعدة للكتابة المباشرة في Firebase لضمان عدم ضياع البيانات
    async function replaceTransactionsInFirebaseDirectly(transactions) {
        if (!window.QaryaFirebase) return;
        const { db, ref, set } = window.QaryaFirebase;

        try {
            if (window.QaryaFirebaseAuthReady) {
                await window.QaryaFirebaseAuthReady;
            }

            const payload = Array.isArray(transactions)
                ? transactions.reduce((accumulator, transaction) => {
                    const normalized = normalizeTransaction(transaction);
                    if (!normalized.txId || !normalized.email || normalized.deleted) {
                        return accumulator;
                    }

                    const safeEmail = normalizeEmail(normalized.email).replace(/\./g, '_');
                    const safeTxId = String(normalized.txId).trim().replace(/[.#$[\]/]/g, '_');
                    accumulator[`${safeEmail}__${safeTxId}`] = normalized;
                    return accumulator;
                }, {})
                : {};

            await set(ref(db, 'transactions'), Object.keys(payload).length ? payload : null);
        } catch (error) {
            console.error('Firebase Transactions Sync Error:', error);
        }
    }

    async function syncToFirebaseDirectly(state) {
        if (!window.QaryaFirebase) return;
        const { db, ref, set, update } = window.QaryaFirebase;
        
        try {
            if (window.QaryaFirebaseAuthReady) {
                await window.QaryaFirebaseAuthReady;
            }

            const usersPayload = Array.isArray(state.users)
                ? state.users.reduce((accumulator, user) => {
                    const safeEmail = normalizeEmail(user.email).replace(/\./g, '_');
                    if (!safeEmail) return accumulator;
                    accumulator[safeEmail] = user;
                    return accumulator;
                }, {})
                : {};

            const transactionsPayload = Array.isArray(state.transactions)
                ? state.transactions.reduce((accumulator, transaction) => {
                    if (!transaction?.txId) return accumulator;
                    const safeEmail = normalizeEmail(transaction.email).replace(/\./g, '_');
                    const safeTxId = String(transaction.txId).trim().replace(/[.#$[\]/]/g, '_');
                    if (!safeEmail || !safeTxId) return accumulator;
                    accumulator[`${safeEmail}__${safeTxId}`] = transaction;
                    return accumulator;
                }, {})
                : {};

            // نقوم بتحديث البيانات الأساسية فقط بدلاً من استبدال العقدة بالكامل
            // هذا يمنع حذف المستخدمين الآخرين إذا كانت النسخة المحلية ناقصة
            const updates = {};
            updates['state/auth'] = state;
            
            // تحديث المستخدمين والعمليات بشكل فردي ضمن العملية الواحدة
            for (const [key, value] of Object.entries(usersPayload)) {
                updates[`users/${key}`] = value;
            }
            for (const [key, value] of Object.entries(transactionsPayload)) {
                updates[`transactions/${key}`] = value;
            }

            await update(ref(db), updates);
        } catch (e) {
            console.error("Firebase Auth Sync Error:", e);
        }
    }

    // وظيفة لحذف مستخدم من Firebase نهائياً
    async function deleteFromFirebaseDirectly(email) {
        if (!window.QaryaFirebase) return;
        const { db, ref, set } = window.QaryaFirebase;
        try {
            if (window.QaryaFirebaseAuthReady) {
                await window.QaryaFirebaseAuthReady;
            }
            const safeEmail = normalizeEmail(email).replace(/\./g, '_');
            await set(ref(db, `users/${safeEmail}`), null);
        } catch (e) {
            console.error("Firebase Delete User Error:", e);
        }
    }

    async function pushRemoteState(state) {
        // نقوم بالمزامنة مع Firebase فقط لضمان السرعة والتوافق بين الأجهزة
        await syncToFirebaseDirectly(state);
        return true;
    }

    async function refreshFromRemote(options = {}) {
        if (!options.force && Date.now() - lastRemoteRefresh < 1500) {
            return true;
        }

        const remoteState = await readRemoteState();
        if (!remoteState) return false;

        const nextUsers = mergeUsers(getSeedUsers(), remoteState.users);
        const nextTransactions = mergeTransactions(remoteState.transactions);
        writeUsers(nextUsers, { silent: true });
        writeTransactions(nextTransactions, { silent: true, fromRemote: true });
        lastRemoteRefresh = Date.now();
        notifyStoreUpdated({ source: 'remote-refresh' });

        if (options.pushSeeds) {
            await pushRemoteState({
                users: nextUsers,
                transactions: nextTransactions
            });
        }

        return true;
    }

    async function runSyncCycles() {
        let pushed = false;
        do {
            syncQueued = false;
            pushed = await pushRemoteState(buildRemoteSlices());
            if (pushed) {
                await refreshFromRemote({ force: true });
            }
        } while (syncQueued);
        return pushed;
    }

    async function syncNow(options = {}) {
        if (syncPromise) {
            syncQueued = true;
            return syncPromise;
        }

        syncPromise = (async () => {
            try {
                return await runSyncCycles();
            } finally {
                syncPromise = null;
            }
        })();

        return await syncPromise;
    }

    function ensurePolling() {
        if (pollStarted) return;
        pollStarted = true;

        if (!getFirebaseApi()) {
            hookFirebaseReady(() => {
                setupFirebaseListeners();
                attachAuthStateRealtime();
                void refreshFromRemote({ force: true });
            });
        }

        void refreshFromRemote({ force: true, pushSeeds: true });
        window.setInterval(() => {
            void refreshFromRemote();
        }, REMOTE_REFRESH_MS);

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                void refreshFromRemote({ force: true });
            }
        });
    }

    function saveCustomUserShadow(user) {
        const normalized = normalizeUser(user);
        const hardCodedKeys = new Set(getHardCodedUsers().map((item) => item.storageKey));
        if (hardCodedKeys.has(normalized.storageKey)) {
            return;
        }

        const all = getLegacyCustomUsers().filter((item) => normalizeEmail(item.storageKey || item.email) !== normalized.storageKey);
        if (!normalized.deleted) {
            all.unshift({
                ...normalized,
                email: normalized.email,
                originalEmail: normalized.originalEmail,
                storageKey: normalized.storageKey,
                password: normalized.password,
                name: normalized.name,
                role: normalized.role,
                balance: normalized.balance,
                withdrawalPassword: normalized.withdrawalPassword,
                governorate: normalized.governorate,
                city: normalized.city,
                village: normalized.village,
                leaderCode: normalized.leaderCode
            });
        }
        saveLegacyCustomUsers(all);
    }

    function upsertUser(userInput, options = {}) {
        const currentUsers = getAllUsersRaw();
        const nextUser = normalizeUser({
            ...userInput,
            storageKey: normalizeEmail(userInput.storageKey || userInput.email),
            updatedAt: new Date().toISOString(),
            lastUpdatedAt: new Date().toISOString(),
            createdAt: userInput.createdAt || new Date().toISOString()
        });

        if (!nextUser.storageKey || !nextUser.email) {
            return { ok: false, message: 'بيانات المستخدم غير مكتملة.' };
        }

        const duplicate = currentUsers.find((user) => user.storageKey === nextUser.storageKey && normalizeEmail(user.email) !== normalizeEmail(options.currentEmail || nextUser.email));
        if (duplicate && normalizeEmail(options.currentEmail || '') !== duplicate.storageKey) {
            return { ok: false, message: 'البريد الإلكتروني مستخدم بالفعل.' };
        }

        const filteredUsers = currentUsers.filter((user) => {
            const currentKey = normalizeEmail(options.currentEmail || '');
            if (!currentKey) return user.storageKey !== nextUser.storageKey;
            return user.storageKey !== currentKey && user.storageKey !== nextUser.storageKey;
        });
        filteredUsers.unshift(nextUser);
        writeUsers(filteredUsers);
        saveCustomUserShadow(nextUser);
        dispatchUserUpdate(nextUser.email, nextUser.storageKey);
        
        // تحديث Firebase بشكل مباشر وفوري باستخدام update بدلاً من set لضمان عدم حذف الحقول الأخرى
        const firebase = getFirebaseApi();
        if (firebase) {
            const { db, ref, update } = firebase;
            const safeEmail = normalizeEmail(nextUser.email).replace(/\./g, '_');
            void update(ref(db, `users/${safeEmail}`), nextUser);
        }

        void syncNow();
        return { ok: true, user: nextUser };
    }

    function updateUserPersistentData(email, data) {
        const currentUser = getUserByEmail(email);
        if (!currentUser) {
            return { ok: false, message: 'المستخدم غير موجود.' };
        }

        const nextEmail = String(data?.email || currentUser.email || '').trim();
        const currentEmail = currentUser.email;
        const result = upsertUser({
            ...currentUser,
            ...data,
            email: nextEmail,
            originalEmail: nextEmail,
            storageKey: normalizeEmail(nextEmail)
        }, { currentEmail });

        if (result.ok) {
            // تحديث Firebase بشكل فوري ومباشر لضمان انعكاس الصلاحيات عند المستخدم
            const firebase = getFirebaseApi();
            if (firebase) {
                const { db, ref, update } = firebase;
                const safeEmail = normalizeEmail(nextEmail).replace(/\./g, '_');
                void update(ref(db, `users/${safeEmail}`), result.user);
            }
        }
        return result;
    }

    function addUser(userData) {
        const email = normalizeEmail(userData.email);
        if (!email) return { ok: false, message: 'البريد الإلكتروني مطلوب.' };

        const existing = getUserByEmail(email);
        if (existing) return { ok: false, message: 'هذا البريد مسجل مسبقاً.' };

        const accountType = normalizeAccountType(userData.accountType, userData);
        const isExamStudent = accountType === ACCOUNT_TYPES.EXAM_STUDENT;

        return upsertUser({
            ...buildDefaultUserData(userData),
            email,
            originalEmail: email,
            storageKey: email,
            accountType,
            role: userData.role || (isExamStudent ? 'طالب امتحان' : 'طالب المنصة'),
            balance: isExamStudent ? 0 : Number(userData.balance || 0),
            walletEnabled: true,
            privateNotificationsEnabled: true,
            showWalletQuickAccess: true,
            withdrawalPassword: isExamStudent ? (userData.password || '123456') : (userData.withdrawalPassword || 'SPEED')
        });
    }

    function deleteUserAccount(email) {
        const nextUsers = getAllUsersRaw().filter(u => normalizeEmail(u.email) !== normalizeEmail(email));
        writeUsers(nextUsers);
        deleteFromFirebaseDirectly(email); // حذف مباشر من Firebase
        pushRemoteState({ users: nextUsers, transactions: getAllTransactions() });
    }

    function getAllTransactions() {
        return mergeTransactions(getStoredTransactions());
    }

    function getTransactionsByEmail(email) {
        const normalized = normalizeEmail(email);
        return getAllTransactions().filter((transaction) => transaction.email === normalized);
    }

    function getTransaction(email, txId) {
        const normalizedEmail = normalizeEmail(email);
        const normalizedTxId = String(txId || '').trim();
        return getAllTransactions().find((transaction) => transaction.email === normalizedEmail && transaction.txId === normalizedTxId) || null;
    }

    function upsertTransaction(transaction) {
        const normalized = normalizeTransaction({
            ...transaction,
            updatedAt: new Date().toISOString(),
            createdAt: transaction.createdAt || new Date().toISOString()
        });

        if (!normalized.email || !normalized.txId) {
            return { ok: false, message: 'بيانات العملية غير مكتملة.' };
        }

        const all = getAllTransactions().filter((item) => !(item.email === normalized.email && item.txId === normalized.txId));
        all.unshift(normalized);
        writeTransactions(all);
        notifyStoreUpdated({ email: normalized.email, txId: normalized.txId });
        void syncNow();
        return { ok: true, transaction: normalized };
    }

    function updateTransaction(email, txId, updates) {
        const current = getTransaction(email, txId);
        if (!current) {
            return { ok: false, message: 'عملية السحب غير موجودة.' };
        }
        return upsertTransaction({
            ...current,
            ...updates,
            email: current.email,
            txId: current.txId
        });
    }

    function deleteTransaction(email, txId) {
        return updateTransaction(email, txId, { deleted: true }).ok;
    }

    function getPrivateNotifications(email) {
        const user = getUserByEmail(email);
        return Array.isArray(user?.privateNotifications)
            ? user.privateNotifications
                .map((item) => normalizePrivateNotification(item))
                .filter((item) => !item.deleted)
                .sort((first, second) => new Date(second.createdAt || 0).getTime() - new Date(first.createdAt || 0).getTime())
            : [];
    }

    function writePrivateNotificationsForUser(email, notifications) {
        const normalizedEmail = normalizeEmail(email);
        const currentUser = getUserByEmail(normalizedEmail);
        if (!currentUser) {
            return { ok: false, message: 'المستخدم غير موجود.' };
        }

        const now = new Date().toISOString();
        const nextUsers = getAllUsersRaw().map((candidate) => (
            normalizeEmail(candidate.email) === normalizedEmail
                ? {
                    ...candidate,
                    privateNotifications: notifications,
                    updatedAt: now,
                    lastUpdatedAt: now
                }
                : candidate
        ));

        writeUsers(nextUsers);
        dispatchUserUpdate(currentUser.email, currentUser.storageKey || currentUser.email);
        void syncNow();
        return { ok: true, user: getUserByEmail(normalizedEmail) };
    }

    function pushPrivateNotification(email, note) {
        const user = getUserByEmail(email);
        if (!user) {
            return { ok: false, message: 'المستخدم غير موجود.' };
        }

        if (!canReceivePrivateNotifications(user)) {
            return { ok: false, message: 'هذا الحساب يستقبل الإشعارات العامة فقط.' };
        }

        const notification = normalizePrivateNotification({
            ...note,
            recipientEmail: user.email,
            recipientName: user.name
        });

        const nextNotifications = [
            notification,
            ...getPrivateNotifications(email).filter((item) => item.id !== notification.id)
        ].slice(0, 120);
        return writePrivateNotificationsForUser(email, nextNotifications);
    }

    function updatePrivateNotification(email, notificationId, updates = {}) {
        const user = getUserByEmail(email);
        if (!user) {
            return { ok: false, message: 'المستخدم غير موجود.' };
        }

        const current = getPrivateNotifications(email).find((item) => item.id === notificationId);
        if (!current) {
            return { ok: false, message: 'الإشعار الخاص غير موجود.' };
        }

        const nextNotifications = getPrivateNotifications(email).map((item) => (
            item.id === notificationId
                ? normalizePrivateNotification({
                    ...item,
                    ...updates,
                    id: item.id,
                    createdAt: item.createdAt,
                    updatedAt: new Date().toISOString(),
                    recipientEmail: user.email,
                    recipientName: user.name
                })
                : item
        ));

        return writePrivateNotificationsForUser(email, nextNotifications);
    }

    function deletePrivateNotification(email, notificationId) {
        const user = getUserByEmail(email);
        if (!user) {
            return { ok: false, message: 'المستخدم غير موجود.' };
        }

        const nextNotifications = getPrivateNotifications(email)
            .filter((item) => item.id !== notificationId);

        return writePrivateNotificationsForUser(email, nextNotifications);
    }

    function markPrivateNotificationRead(email, notificationId) {
        const user = getUserByEmail(email);
        if (!user) {
            return { ok: false, message: 'المستخدم غير موجود.' };
        }

        const nextNotifications = getPrivateNotifications(email).map((item) => (
            item.id === notificationId && !item.readAt
                ? normalizePrivateNotification({
                    ...item,
                    readAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    recipientEmail: user.email,
                    recipientName: user.name
                })
                : item
        ));

        return writePrivateNotificationsForUser(email, nextNotifications);
    }

    function getManagementRole(userOrEmail) {
        const user = resolveUserLike(userOrEmail);
        if (!user) {
            const normalized = normalizeEmail(typeof userOrEmail === 'string' ? userOrEmail : userOrEmail?.email);
            if (!normalized) return 'user';
            if (ADMIN_EMAILS.some((adminEmail) => normalizeEmail(adminEmail) === normalized)) return 'super_admin';
            if (LEADERS_EMAILS.some((leaderEmail) => normalizeEmail(leaderEmail) === normalized)) return 'leader';
            return 'user';
        }
        return normalizeManagementRole(user.managementRole, user);
    }

    function getManagementRoleLabel(userOrRole) {
        const role = typeof userOrRole === 'string' && !userOrRole.includes('@')
            ? String(userOrRole || '').trim()
            : getManagementRole(userOrRole);

        return {
            super_admin: 'المدير العام',
            operations_admin: 'إدارة التشغيل',
            finance_admin: 'إدارة الماليات',
            support_admin: 'إدارة الدعم',
            exam_admin: 'إدارة الامتحانات',
            leader: 'قائد الطلاب',
            user: 'مستخدم المنصة',
            exam_student: 'طالب امتحان'
        }[role] || 'مستخدم المنصة';
    }

    function getPermissions(userOrEmail) {
        const user = resolveUserLike(userOrEmail);
        const role = getManagementRole(user || userOrEmail);
        const base = MANAGEMENT_PERMISSION_MATRIX[role] || [];
        const extras = Array.isArray(user?.permissions) ? user.permissions : [];
        return Array.from(new Set([
            ...base,
            ...extras.map((item) => String(item || '').trim()).filter(Boolean)
        ]));
    }

    function hasPermission(userOrEmail, permission) {
        const normalizedPermission = String(permission || '').trim();
        if (!normalizedPermission) return false;
        return getPermissions(userOrEmail).includes(normalizedPermission);
    }

    function isAdminSession(sessionOrEmail) {
        return hasPermission(sessionOrEmail, 'admin_access');
    }

    function isLeader(email) {
        const normalized = normalizeEmail(email);
        if (!normalized) return false;
        
        const user = getUserByEmail(normalized);
        if (user) {
            return isLeaderUser(user);
        }

        if (LEADERS_EMAILS.some((leaderEmail) => normalizeEmail(leaderEmail) === normalized)) {
            return true;
        }
        return false;
    }

    function getManagedStudents(email) {
        const normalized = normalizeEmail(email);
        const user = getUserByEmail(normalized);
        const explicitStudents = LEADER_STUDENTS[normalized] || [];
        if (explicitStudents.length) {
            return explicitStudents.slice();
        }
        const leaderCode = String(user?.leaderCode || '').trim();
        if (!leaderCode) {
            return LEADER_STUDENTS[normalized] || [];
        }

        return getAllUsers()
            .filter((student) => !isLeaderUser(student) && String(student.leaderCode || '').trim() === leaderCode)
            .map((student) => student.name)
            .filter(Boolean);
    }

    function readStoredSession() {
        const tabSession = parseJson(sessionStorage.getItem(AUTH_SESSION_KEY), null);
        if (tabSession) return tabSession;

        const legacySession = parseJson(localStorage.getItem(AUTH_SESSION_KEY), null);
        if (legacySession) {
            sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(legacySession));
            localStorage.removeItem(AUTH_SESSION_KEY);
            return legacySession;
        }

        return null;
    }

    function getSession() {
        const session = readStoredSession();
        if (session && session.email) {
            // تحديث بيانات الجلسة من قاعدة البيانات المحلية (المزامنة مع Firebase)
            const user = getUserByEmail(session.email);
            if (user) {
                const merged = { ...session, ...user };
                // حفظ النسخة المحدثة في الـ SessionStorage إذا كانت مختلفة
                if (JSON.stringify(merged) !== JSON.stringify(session)) {
                    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(merged));
                }
                return merged;
            }
        }
        return session;
    }

    function getCurrentSession() {
        return getSession();
    }

    function isAuthenticated() {
        return Boolean(getSession());
    }

    function getDefaultTarget(session) {
        if (isExamOnlyUser(session?.email || session)) {
            return 'pages/exam-status.html';
        }
        if (isAdminSession(session) || isLeader(session?.email)) {
            return 'pages/leader-admin.html';
        }
        return 'index.html';
    }

    function startSessionForUser(userLike) {
        const user = resolveUserLike(userLike);
        if (!user) {
            return { ok: false, message: 'المستخدم غير موجود.' };
        }

        if (user.deleted) {
            return { ok: false, message: 'هذا الحساب محذوف من المنصة.' };
        }

        if (user.isSuspended) {
            return { ok: false, message: 'هذا الحساب موقوف حاليًا من الإدارة.' };
        }

        const maintenance = getMaintenanceState();
        if (maintenance.active && !isAdminSession(user.email)) {
            return { ok: false, message: maintenance.message || 'جاري الآن صيانة الموقع. يرجى المحاولة لاحقًا.' };
        }

        const session = {
            name: user.name,
            email: user.email,
            role: user.role || 'مستخدم المنصة',
            loginAt: Date.now()
        };

        sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
        localStorage.removeItem(AUTH_SESSION_KEY);
        updateUserPersistentData(user.email, { lastLoginAt: new Date().toISOString() });

        return {
            ok: true,
            session,
            user: getUserByEmail(user.email) || user
        };
    }

    function provisionExternalUserAccount(profileInput = {}) {
        const normalizedEmail = normalizeEmail(profileInput.email);
        const normalizedPhone = normalizePhoneNumber(profileInput.phone || profileInput.phoneNumber);
        const normalizedProvider = String(profileInput.providerId || profileInput.authProvider || 'provider').trim() || 'provider';

        const existingUser = (
            (normalizedEmail ? getUserByEmail(normalizedEmail) : null)
            || (normalizedPhone ? getUserByPhone(normalizedPhone) : null)
        );

        const accountEmail = existingUser?.email || buildProviderPlaceholderEmail({
            email: normalizedEmail,
            phone: normalizedPhone,
            uid: profileInput.uid,
            providerId: normalizedProvider
        });

        const accountPayload = {
            ...(existingUser || {}),
            email: accountEmail,
            originalEmail: normalizedEmail || existingUser?.originalEmail || accountEmail,
            storageKey: normalizeEmail(accountEmail),
            password: existingUser?.password || String(profileInput.password || buildPlatformPassword(profileInput.uid || normalizedPhone || accountEmail)).trim(),
            name: String(profileInput.name || existingUser?.name || 'مستخدم المنصة').trim(),
            role: existingUser?.role || 'مستخدم المنصة',
            accountType: existingUser?.accountType || ACCOUNT_TYPES.PLATFORM,
            managementRole: existingUser?.managementRole || 'user',
            balance: Number(existingUser?.balance || 0),
            walletEnabled: existingUser ? existingUser.walletEnabled !== false : true,
            withdrawalsEnabled: existingUser ? existingUser.withdrawalsEnabled !== false : true,
            privateNotificationsEnabled: true,
            showWalletQuickAccess: existingUser ? existingUser.showWalletQuickAccess !== false : true,
            examAllowed: existingUser ? existingUser.examAllowed !== false : true,
            withdrawalPassword: existingUser?.withdrawalPassword || 'SPEED',
            profileImage: profileInput.profileImage || profileInput.photoURL || existingUser?.profileImage || null,
            phone: normalizedPhone || existingUser?.phone || '',
            authProvider: normalizedProvider,
            firebaseUid: String(profileInput.uid || existingUser?.firebaseUid || '').trim(),
            emailVerified: Boolean(profileInput.emailVerified) || Boolean(existingUser?.emailVerified),
            phoneVerified: Boolean(normalizedPhone) || Boolean(existingUser?.phoneVerified),
            isLeader: Boolean(existingUser?.isLeader),
            isSuspended: Boolean(existingUser?.isSuspended),
            deleted: false
        };

        const result = existingUser
            ? updateUserPersistentData(existingUser.email, accountPayload)
            : addUser(accountPayload);

        if (!result.ok) {
            return result;
        }

        const sessionResult = startSessionForUser(result.user || accountEmail);
        if (!sessionResult.ok) {
            return sessionResult;
        }

        return {
            ok: true,
            isNew: !existingUser,
            user: sessionResult.user,
            session: sessionResult.session
        };
    }

    // تهيئة Firebase Auth أصبحت مركزية داخل firebase-init.js لضمان الجاهزية قبل أي قراءة أو كتابة.

    async function login(email, password) {
        await refreshFromRemote({ force: true, pushSeeds: true });

        const normalized = normalizeEmail(email);
        const user = getAllUsersRaw().find((item) => normalizeEmail(item.email) === normalized && item.password === password);

        if (!user) {
            return { ok: false, message: 'بيانات الدخول غير صحيحة.' };
        }

        if (user.deleted) {
            return { ok: false, message: 'هذا الحساب محذوف من المنصة.' };
        }

        if (user.isSuspended) {
            return { ok: false, message: 'هذا الحساب موقوف حاليًا من الإدارة.' };
        }

        const maintenance = getMaintenanceState();
        if (maintenance.active && !isAdminSession(user.email)) {
            return { ok: false, message: maintenance.message || 'جاري الآن صيانة الموقع. يرجى المحاولة لاحقًا.' };
        }

        const session = {
            name: user.name,
            email: user.email,
            role: user.role || 'مستخدم المنصة',
            loginAt: Date.now()
        };

        sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
        localStorage.removeItem(AUTH_SESSION_KEY);
        updateUserPersistentData(user.email, { lastLoginAt: new Date().toISOString() });
        return { ok: true, session };
    }

    function logout() {
        sessionStorage.removeItem(AUTH_SESSION_KEY);
        localStorage.removeItem(AUTH_SESSION_KEY);
        sessionStorage.removeItem('qarya_verified_student');
        sessionStorage.removeItem('qaryaeduExamGatePass');
    }

    async function login(email, password) {
        await refreshFromRemote({ force: true, pushSeeds: true });

        const normalized = normalizeEmail(email);
        const user = getAllUsersRaw().find((item) => normalizeEmail(item.email) === normalized && item.password === password);

        if (!user) {
            return { ok: false, message: 'بيانات الدخول غير صحيحة.' };
        }

        const sessionResult = startSessionForUser(user);
        if (!sessionResult.ok) {
            return sessionResult;
        }

        return { ok: true, session: sessionResult.session, user: sessionResult.user };
    }

    function logout() {
        sessionStorage.removeItem(AUTH_SESSION_KEY);
        localStorage.removeItem(AUTH_SESSION_KEY);
        sessionStorage.removeItem('qarya_verified_student');
        sessionStorage.removeItem('qaryaeduExamGatePass');
        const firebase = getFirebaseApi();
        if (firebase?.auth && typeof firebase.signOut === 'function') {
            Promise.resolve(firebase.signOut(firebase.auth)).catch(() => {});
        }
    }

    function checkAndApplyHolidayGift() {
        return false;
    }

    ensureUsersCache();
    ensurePolling();

    window.QaryaAuth = {
        adminEmail: ADMIN_EMAIL,
        leadersEmails: LEADERS_EMAILS,
        normalizeEmail,
        normalizePhoneNumber,
        getAllUsers,
        getAllUsersRaw,
        getUserByEmail,
        getUserByPhone,
        getUserByNationalId,
        getLeaderUsers,
        getUsersByLeaderCode,
        isLeaderUser,
        isExamOnlyUser,
        canAccessWallet,
        canReceivePrivateNotifications,
        updateUserPersistentData,
        addUser,
        upsertUser,
        writeUsers,
        deleteUserAccount,
        getAllTransactions,
        getTransactionsByEmail,
        getTransaction,
        upsertTransaction,
        updateTransaction,
        deleteTransaction,
        getPrivateNotifications,
        pushPrivateNotification,
        updatePrivateNotification,
        deletePrivateNotification,
        markPrivateNotificationRead,
        writeTransactions,
        buildStudentCredentials,
        createOrUpdateStudentAccountFromApplication,
        startSessionForUser,
        provisionExternalUserAccount,
        refreshFromRemote,
        syncNow,
        isAdminSession,
        isLeader,
        getManagementRole,
        getManagementRoleLabel,
        getPermissions,
        hasPermission,
        getManagedStudents,
        getMaintenanceState,
        getDefaultTarget,
        getSession,
        isAuthenticated,
        login,
        logout,
        checkAndApplyHolidayGift,
        storeEventName: AUTH_STORE_EVENT,
        users: getAllUsers().map((user) => ({ email: user.email, name: user.name, role: user.role }))
    };
})();
