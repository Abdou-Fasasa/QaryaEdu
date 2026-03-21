(() => {
    const authApi = window.QaryaAuth;
    const authGuard = window.QaryaAuthGuard;

    if (!authApi) {
        return;
    }

    document.addEventListener('DOMContentLoaded', () => {
        const form = document.getElementById('login-form');
        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');
        const messageBox = document.getElementById('login-message');
        const submitButton = document.getElementById('login-submit');
        const toggleButton = document.getElementById('password-visibility-toggle');
        const nextTargetLabel = document.getElementById('next-target-label');

        if (!form || !emailInput || !passwordInput || !messageBox || !submitButton) {
            return;
        }

        const params = new URLSearchParams(window.location.search);
        const nextTarget = authGuard && typeof authGuard.resolveSafeTarget === 'function'
            ? authGuard.resolveSafeTarget(params.get('next'))
            : 'index.html';

        if (nextTargetLabel) {
            nextTargetLabel.textContent = nextTarget === 'index.html'
                ? 'بعد التحقق سيتم فتح الصفحة الرئيسية للمنصة.'
                : 'بعد التحقق سيتم فتح الصفحة المطلوبة داخل المنصة.';
        }

        function setMessage(type, text) {
            messageBox.className = `auth-form-message ${type}`;
            messageBox.textContent = text;
            messageBox.hidden = false;
        }

        form.addEventListener('submit', (event) => {
            event.preventDefault();

            const email = emailInput.value.trim();
            const password = passwordInput.value;
            const result = authApi.login(email, password);

            if (!result.ok) {
                setMessage('error', result.message);
                passwordInput.focus();
                passwordInput.select();
                return;
            }

            submitButton.disabled = true;
            submitButton.textContent = 'جارٍ فتح المنصة...';
            setMessage('success', `مرحبًا ${result.session.name}، يتم الآن فتح المنصة.`);

            window.setTimeout(() => {
                window.location.replace(nextTarget);
            }, 320);
        });

        if (toggleButton) {
            toggleButton.addEventListener('click', () => {
                const isPassword = passwordInput.type === 'password';
                passwordInput.type = isPassword ? 'text' : 'password';
                toggleButton.setAttribute('aria-pressed', String(isPassword));
                toggleButton.innerHTML = isPassword
                    ? '<i class="fas fa-eye-slash"></i>'
                    : '<i class="fas fa-eye"></i>';
            });
        }

        emailInput.focus();
    });
})();
