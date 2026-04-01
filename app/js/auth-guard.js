(() => {
    const authApi = window.QaryaAuth;

    if (!authApi) {
        return;
    }

    const SAFE_TARGET_PATTERN = /^(index\.html|pages\/[a-z0-9-]+\.html)(?:[?#].*)?$/i;
    const DEFAULT_TARGET = 'index.html';
    const ADMIN_ONLY_PAGES = new Set(['dashboard.html', 'admin-dashboard.html']);

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

    function getLoginPath() {
        return isPagesPath() ? '../login.html' : './login.html';
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
    const session = authApi.getSession();

    window.QaryaAuthGuard = {
        resolveSafeTarget
    };

    if (isLoginPage()) {
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

    if (ADMIN_ONLY_PAGES.has(currentFile) && !authApi.isAdminSession?.(session)) {
        redirectTo(getHomePath());
    }
})();