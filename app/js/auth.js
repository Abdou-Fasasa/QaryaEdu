(() => {
    const AUTH_SESSION_KEY = 'qaryaeduAuthSession';
    const ADMIN_EMAIL = 'abdou@qarya.edu';
    const USERS = [
        {
            email: 'Abdou@qarya.edu',
            password: 'Abdou',
            name: 'عبدالرحمن',
            role: 'ادمن المنصة'
        },
        {
            email: 'mo@qarya.edu',
            password: 'mo',
            name: 'Mostafa',
            role: 'طالب'
        },
    ];

    function normalizeEmail(email) {
        return String(email || '').trim().toLowerCase();
    }

    function isAdminSession(sessionOrEmail) {
        const email = typeof sessionOrEmail === 'string' ? sessionOrEmail : sessionOrEmail?.email;
        return normalizeEmail(email) === ADMIN_EMAIL;
    }

    function getDefaultTarget(session) {
        return isAdminSession(session) ? 'pages/dashboard.html' : 'index.html';
    }

    function parseJson(value, fallback) {
        try {
            return JSON.parse(value || '');
        } catch (error) {
            return fallback;
        }
    }

    function readStoredSession() {
        const sessionFromTab = parseJson(sessionStorage.getItem(AUTH_SESSION_KEY), null);
        if (sessionFromTab) {
            return sessionFromTab;
        }

        const legacySession = parseJson(localStorage.getItem(AUTH_SESSION_KEY), null);
        if (legacySession) {
            sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(legacySession));
            localStorage.removeItem(AUTH_SESSION_KEY);
            return legacySession;
        }

        return null;
    }

    function getSession() {
        return readStoredSession();
    }

    function isAuthenticated() {
        return Boolean(getSession());
    }

    function login(email, password) {
        const normalized = normalizeEmail(email);
        const user = USERS.find((item) => normalizeEmail(item.email) === normalized && item.password === password);
        if (!user) {
            return { ok: false, message: 'بيانات الدخول غير صحيحة.' };
        }

        const session = {
            name: user.name,
            role: user.role,
            email: user.email,
            loginAt: Date.now()
        };

        sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
        localStorage.removeItem(AUTH_SESSION_KEY);
        return { ok: true, session };
    }

    function logout() {
        sessionStorage.removeItem(AUTH_SESSION_KEY);
        localStorage.removeItem(AUTH_SESSION_KEY);
        sessionStorage.removeItem('qarya_verified_student');
        sessionStorage.removeItem('qaryaeduExamGatePass');
    }

    window.QaryaAuth = {
        adminEmail: ADMIN_EMAIL,
        users: USERS.map((user) => ({ email: user.email, name: user.name, role: user.role })),
        normalizeEmail,
        isAdminSession,
        getDefaultTarget,
        getSession,
        isAuthenticated,
        login,
        logout
    };
})();