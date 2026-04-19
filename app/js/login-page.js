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
        'receipt.html': 'إيصال الطلب',
        'exam-results.html': 'نتائج الامتحان',
        'notifications.html': 'مركز الإشعارات',
        'support.html': 'صفحة الدعم',
        'signup.html': 'إنشاء حساب جديد',
        'leader-admin.html': 'لوحة التحكم'
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

    function setMessage(box, text, type = 'error') {
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

    function setBusy(button, busy, idleHtml, busyHtml) {
        if (!button) return;
        button.disabled = busy;
        button.innerHTML = busy ? busyHtml : idleHtml;
    }

    function mapFirebaseError(error) {
        const code = String(error?.code || '').trim();
        const fallback = String(error?.message || 'تعذر إكمال العملية الآن. حاول مرة أخرى.');

        const known = {
            'auth/invalid-email': 'صيغة البريد الإلكتروني غير صحيحة.',
            'auth/user-disabled': 'هذا الحساب موقوف من جهة المصادقة.',
            'auth/user-not-found': 'هذا الحساب غير موجود في Firebase.',
            'auth/wrong-password': 'كلمة المرور غير صحيحة.',
            'auth/popup-closed-by-user': 'تم إغلاق نافذة Google قبل إتمام العملية.',
            'auth/cancelled-popup-request': 'تم إلغاء طلب نافذة Google الحالي.',
            'auth/popup-blocked': 'المتصفح منع نافذة Google. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.',
            'auth/network-request-failed': 'حدثت مشكلة في الشبكة أثناء الاتصال بخدمة Firebase.',
            'auth/configuration-not-found': 'تسجيل الدخول عبر Google غير مفعّل بالكامل في إعدادات Firebase.',
            'auth/unauthorized-domain': 'الدومين الحالي غير مضاف داخل Authorized domains في Firebase.'
        };

        return known[code] || fallback;
    }

    async function getFirebaseToolkit() {
        await Promise.resolve(window.QaryaFirebaseAuthReady || null);
        const firebase = window.QaryaFirebase;
        if (!firebase?.auth) {
            throw new Error('Firebase Auth غير جاهز في صفحة الدخول.');
        }
        return firebase;
    }

    function emitLoginNotification(session, targetLabel) {
        return Promise.resolve(window.QaryaTelegram?.sendLoginNotification?.({
            userName: session?.name || 'مستخدم المنصة',
            email: session?.email || '',
            role: session?.role || 'مستخدم المنصة',
            targetLabel,
            userAgent: navigator.userAgent,
            loggedAt: new Date().toLocaleString('ar-EG')
        })).catch((error) => {
            console.error('Failed to send login notification:', error);
        });
    }

    async function completeLoginSuccess(result, messageBox, successText = '') {
        if (!result?.ok || !result?.session) {
            throw new Error(result?.message || 'تعذر بدء جلسة الدخول.');
        }

        const target = resolveTarget(result.session);
        const targetLabel = getTargetLabel(target);

        authApi.updateUserPersistentData?.(result.session.email, {
            lastLoginPage: target
        });

        if (successText) {
            setMessage(messageBox, successText, 'success');
        }

        await emitLoginNotification(result.session, targetLabel);
        window.location.replace(target);
    }

    document.addEventListener('DOMContentLoaded', () => {
        const loginForm = document.getElementById('login-form');
        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');
        const googleButton = document.getElementById('google-login-btn');
        const messageBox = document.getElementById('login-message');
        const submitButton = document.getElementById('login-submit');
        const nextLabel = document.getElementById('next-target-label');
        const passwordToggle = document.getElementById('password-visibility-toggle');
        const signupLink = document.querySelector('[data-auth-switch="signup"]');
        const currentSession = authApi.getSession();
        const maintenance = authApi.getMaintenanceState?.() || { active: false, message: '' };
        const params = new URLSearchParams(window.location.search);

        if (signupLink) {
            const basePath = authGuard?.getSignupPath?.() || './signup.html';
            signupLink.href = params.get('next')
                ? `${basePath}?next=${encodeURIComponent(authGuard?.resolveSafeTarget?.(params.get('next')) || 'index.html')}`
                : basePath;
        }

        if (nextLabel) {
            if (params.get('next')) {
                nextLabel.textContent = `بعد التحقق سيتم فتح ${getTargetLabel(resolveTarget(currentSession))} مباشرة.`;
            } else {
                nextLabel.textContent = 'بعد التحقق سيتم فتح الصفحة المناسبة حسب صلاحية الحساب.';
            }
        }

        if (params.get('maintenance') === '1' || maintenance.active) {
            setMessage(messageBox, params.get('message') || maintenance.message || 'جاري الآن صيانة الموقع. يرجى المحاولة لاحقًا.', 'error');
        }

        if (authApi.isAuthenticated()) {
            window.location.replace(resolveTarget(currentSession));
            return;
        }

        emailInput?.focus();

        if (passwordToggle && passwordInput) {
            passwordToggle.addEventListener('click', () => {
                const isHidden = passwordInput.type === 'password';
                passwordInput.type = isHidden ? 'text' : 'password';
                passwordToggle.setAttribute('aria-pressed', String(isHidden));
                passwordToggle.setAttribute('aria-label', isHidden ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
                passwordToggle.innerHTML = `<i class="fas ${isHidden ? 'fa-eye-slash' : 'fa-eye'}"></i>`;
            });
        }

        loginForm?.addEventListener('submit', async (event) => {
            event.preventDefault();
            clearMessage(messageBox);

            setBusy(
                submitButton,
                true,
                '<span>فتح المنصة</span><i class="fas fa-arrow-left-long"></i>',
                '<span>جارٍ التحقق...</span><i class="fas fa-spinner fa-spin"></i>'
            );

            try {
                const result = await authApi.login(emailInput?.value.trim() || '', passwordInput?.value || '');
                if (!result.ok) {
                    setMessage(messageBox, result.message, 'error');
                    return;
                }
                await completeLoginSuccess(result, messageBox);
            } catch (error) {
                setMessage(messageBox, String(error?.message || 'تعذر تنفيذ تسجيل الدخول الآن.'), 'error');
            } finally {
                setBusy(
                    submitButton,
                    false,
                    '<span>فتح المنصة</span><i class="fas fa-arrow-left-long"></i>',
                    '<span>جارٍ التحقق...</span><i class="fas fa-spinner fa-spin"></i>'
                );
            }
        });

        googleButton?.addEventListener('click', async () => {
            clearMessage(messageBox);
            setBusy(
                googleButton,
                true,
                '<i class="fab fa-google"></i><span>تسجيل الدخول عبر Google</span>',
                '<i class="fas fa-spinner fa-spin"></i><span>جارٍ...</span>'
            );

            try {
                const firebase = await getFirebaseToolkit();
                const provider = firebase.googleProvider || new firebase.GoogleAuthProvider();
                const credential = await firebase.signInWithPopup(firebase.auth, provider);
                const googleUser = credential?.user;

                if (!googleUser) {
                    throw new Error('تعذر استلام بيانات حساب Google.');
                }

                const result = authApi.provisionExternalUserAccount({
                    uid: googleUser.uid,
                    providerId: googleUser.providerData?.[0]?.providerId || 'google.com',
                    name: googleUser.displayName || 'مستخدم Google',
                    email: googleUser.email || '',
                    phone: googleUser.phoneNumber || '',
                    profileImage: googleUser.photoURL || '',
                    emailVerified: Boolean(googleUser.emailVerified)
                });

                if (!result.ok) {
                    setMessage(messageBox, result.message || 'تعذر ربط حساب Google بالمنصة.', 'error');
                    return;
                }

                await completeLoginSuccess(result, messageBox, 'تم تسجيل الدخول عبر Google. جارٍ التحويل...');
            } catch (error) {
                setMessage(messageBox, mapFirebaseError(error), 'error');
            } finally {
                setBusy(
                    googleButton,
                    false,
                    '<i class="fab fa-google"></i><span>تسجيل الدخول عبر Google</span>',
                    '<i class="fas fa-spinner fa-spin"></i><span>جارٍ...</span>'
                );
            }
        });
    });
})();
