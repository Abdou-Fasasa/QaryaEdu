(() => {
    const authApi = window.QaryaAuth;

    if (!authApi) {
        return;
    }

    const SAFE_TARGET_PATTERN = /^(index\.html|pages\/[a-z0-9-]+\.html)(?:[?#].*)?$/i;
    const DEFAULT_TARGET = 'index.html';

    function normalizeCurrentFile() {
        const pathname = window.location.pathname.replace(/\\/g, '/');
        const fileName = pathname.split('/').pop();
        return fileName || 'index.html';
    }

    function isPagesPath() {
        return window.location.pathname.replace(/\\/g, '/').includes('/pages/');
    }

    function isLoginPage() {
        return normalizeCurrentFile().toLowerCase() === 'login.html';
    }

    function isSignupPage() {
        return normalizeCurrentFile().toLowerCase() === 'signup.html';
    }

    function isAuthEntryPage() {
        return isLoginPage() || isSignupPage();
    }

    function getLoginPath() {
        return isPagesPath() ? '../login.html' : './login.html';
    }

    function getSignupPath() {
        return isPagesPath() ? '../signup.html' : './signup.html';
    }

    function getHomePath() {
        return isPagesPath() ? '../index.html' : './index.html';
    }

    function buildCurrentTarget() {
        const fileName = normalizeCurrentFile();
        const suffix = `${window.location.search || ''}${window.location.hash || ''}`;

        if (isPagesPath()) {
            return `pages/${fileName}${suffix}`;
        }

        return `${fileName}${suffix}`;
    }

    function resolveSafeTarget(value) {
        const decodedValue = (() => {
            try {
                return decodeURIComponent(String(value || '').trim());
            } catch (error) {
                return String(value || '').trim();
            }
        })();

        if (!decodedValue) {
            return DEFAULT_TARGET;
        }

        const normalized = decodedValue.replace(/\\/g, '/');
        if (normalized.includes('..') || normalized.startsWith('/') || normalized.startsWith('//') || /^[a-z]+:/i.test(normalized)) {
            return DEFAULT_TARGET;
        }

        return SAFE_TARGET_PATTERN.test(normalized) ? normalized : DEFAULT_TARGET;
    }

    function redirectTo(target) {
        window.location.replace(target);
    }

    const currentFile = normalizeCurrentFile().toLowerCase();
    const params = new URLSearchParams(window.location.search);
    const nextTarget = resolveSafeTarget(params.get('next'));
    const leaderOnlyFiles = new Set(['leader-admin.html', 'students-hub.html', 'student-editor.html']);
    const walletOnlyFiles = new Set(['wallet.html']);

    window.QaryaAuthGuard = {
        resolveSafeTarget,
        getLoginPath,
        getSignupPath
    };

    function enforceGuards() {
        const session = authApi.getSession();
        const maintenance = authApi.getMaintenanceState?.() || { active: false, message: '' };

        if (isAuthEntryPage()) {
            if (authApi.isAuthenticated() && maintenance.active && !authApi.isAdminSession(session)) {
                authApi.logout?.();
            }
            if (authApi.isAuthenticated()) {
                const target = params.get('next') ? nextTarget : (authApi.getDefaultTarget?.(session) || DEFAULT_TARGET);
                redirectTo(target);
            }
            return;
        }

        if (!authApi.isAuthenticated()) {
            const currentTarget = resolveSafeTarget(buildCurrentTarget());
            redirectTo(`${getLoginPath()}?next=${encodeURIComponent(currentTarget)}`);
            return;
        }

        if (maintenance.active && !authApi.isAdminSession(session)) {
            authApi.logout?.();
            redirectTo(`${getLoginPath()}?maintenance=1&message=${encodeURIComponent(maintenance.message || 'جاري الآن صيانة الموقع. يرجى المحاولة لاحقًا.')}`);
            return;
        }

        if (leaderOnlyFiles.has(currentFile) && !authApi.isAdminSession(session) && !authApi.isLeader(session?.email)) {
            redirectTo(authApi.getDefaultTarget?.(session) || getHomePath());
            return;
        }

        if (walletOnlyFiles.has(currentFile) && !authApi.canAccessWallet?.(session?.email || session)) {
            redirectTo(authApi.getDefaultTarget?.(session) || getHomePath());
        }
    }

    window.addEventListener(authApi.storeEventName || 'qarya_auth_store_updated', enforceGuards);
    window.addEventListener('qarya_user_data_updated', enforceGuards);
    window.addEventListener('qarya_platform_store_updated', enforceGuards);

    enforceGuards();
})();
