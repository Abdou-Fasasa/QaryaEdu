(() => {
    const authApi = window.QaryaAuth;

    if (!authApi) {
        return;
    }

    const SAFE_TARGET_PATTERN = /^(index\.html|pages\/[a-z0-9-]+\.html)(?:[?#].*)?$/i;

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
            return 'index.html';
        }

        const normalized = decodedValue.replace(/\\/g, '/');
        if (normalized.includes('..') || normalized.startsWith('/') || normalized.startsWith('//') || /^[a-z]+:/i.test(normalized)) {
            return 'index.html';
        }

        return SAFE_TARGET_PATTERN.test(normalized) ? normalized : 'index.html';
    }

    function redirectTo(target) {
        window.location.replace(target);
    }

    const params = new URLSearchParams(window.location.search);
    const nextTarget = resolveSafeTarget(params.get('next'));

    window.QaryaAuthGuard = {
        resolveSafeTarget
    };

    if (isLoginPage()) {
        if (authApi.isAuthenticated()) {
            redirectTo(nextTarget);
        }
        return;
    }

    if (!authApi.isAuthenticated()) {
        const currentTarget = resolveSafeTarget(buildCurrentTarget());
        redirectTo(`${getLoginPath()}?next=${encodeURIComponent(currentTarget)}`);
    }
})();
