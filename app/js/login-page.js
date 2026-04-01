(() => {
    const authApi = window.QaryaAuth;
    const authGuard = window.QaryaAuthGuard;

    if (!authApi) return;

    const PAGE_LABELS = {
        'index.html': 'الصفحة الرئيسية',
        'register.html': 'صفحة التسجيل',
        'status.html': 'صفحة حالة الطلب',
        'exam-status.html': 'بوابة الامتحان',
        'verification.html': 'صفحة التحقق من الأداء',
        'services.html': 'مركز الخدمات',
        'guide.html': 'دليل الاستخدام',
        'dashboard.html': 'لوحة التحكم',
        'receipt.html': 'إيصال الطلب',
        'exam-results.html': 'نتائج الامتحان',
        'notifications.html': 'مركز الإشعارات',
        'support.html': 'صفحة الدعم',
        'admin-dashboard.html': 'لوحة الأدمن'
    };

    function resolveTarget(session) {
        const params = new URLSearchParams(window.location.search);
        const next = params.get('next');
        if (next) {
            return authGuard?.resolveSafeTarget(next) || 'index.html';
        }
        return authApi.getDefaultTarget?.(session) || 'index.html';
    }

    function getTargetLabel(path) {
        const fileName = String(path || 'index.html').split('/').pop() || 'index.html';
        return PAGE_LABELS[fileName] || 'الصفحة المطلوبة';
    }

    function setMessage(box, text, type) {
        if (!box) return;
        box.textContent = text;
        box.className = `auth-form-message ${type}`;
        box.hidden = false;
    }

    function clearMessage(box) {
        if (!box) return;
        box.hidden = true;
        box.textContent = '';
        box.className = 'auth-form-message';
    }

    document.addEventListener('DOMContentLoaded', () => {
        const loginForm = document.getElementById('login-form');
        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');
        const messageBox = document.getElementById('login-message');
        const submitButton = document.getElementById('login-submit');
        const nextLabel = document.getElementById('next-target-label');
        const passwordToggle = document.getElementById('password-visibility-toggle');
        const currentSession = authApi.getSession();

        if (nextLabel) {
            const params = new URLSearchParams(window.location.search);
            if (params.get('next')) {
                nextLabel.textContent = `بعد التحقق سيتم فتح ${getTargetLabel(resolveTarget(currentSession))} مباشرة.`;
            } else {
                nextLabel.textContent = 'بعد التحقق سيتم فتح الصفحة المناسبة حسب صلاحية الحساب.';
            }
        }

        if (authApi.isAuthenticated()) {
            window.location.replace(resolveTarget(currentSession));
            return;
        }

        if (emailInput) {
            emailInput.focus();
        }

        if (passwordToggle && passwordInput) {
            passwordToggle.addEventListener('click', () => {
                const isHidden = passwordInput.type === 'password';
                passwordInput.type = isHidden ? 'text' : 'password';
                passwordToggle.setAttribute('aria-pressed', String(isHidden));
                passwordToggle.setAttribute('aria-label', isHidden ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
                passwordToggle.innerHTML = `<i class="fas ${isHidden ? 'fa-eye-slash' : 'fa-eye'}"></i>`;
            });
        }

        if (!loginForm) {
            return;
        }

        loginForm.addEventListener('submit', (event) => {
            event.preventDefault();
            clearMessage(messageBox);

            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = 'جارٍ التحقق...';
            }

            const result = authApi.login(emailInput?.value.trim() || '', passwordInput?.value || '');

            if (!result.ok) {
                setMessage(messageBox, result.message, 'error');
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = 'فتح المنصة';
                }
                return;
            }

            window.location.replace(resolveTarget(result.session));
        });
    });
})();