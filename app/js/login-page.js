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

    function withTimeout(promise, timeoutMs = 2500) {
        return Promise.race([
            promise,
            new Promise((resolve) => window.setTimeout(() => resolve(null), timeoutMs))
        ]);
    }

    function getDeviceType() {
        const ua = navigator.userAgent || '';
        if (/tablet|ipad|playbook|silk/i.test(ua)) return 'تابلت';
        if (/mobi|android|iphone|ipod/i.test(ua)) return 'موبايل';
        return 'كمبيوتر';
    }

    function getOperatingSystem() {
        const ua = navigator.userAgent || '';
        if (/android/i.test(ua)) return 'Android';
        if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
        if (/windows/i.test(ua)) return 'Windows';
        if (/mac os/i.test(ua)) return 'macOS';
        if (/linux/i.test(ua)) return 'Linux';
        return 'غير متاح';
    }

    function inferEgyptMobileCarrier(phone) {
        const digits = String(phone || '').replace(/\D/g, '');
        const local = digits.startsWith('20') ? `0${digits.slice(2)}` : digits;
        const prefix = local.slice(0, 3);
        if (prefix === '010') return 'Vodafone';
        if (prefix === '011') return 'Etisalat';
        if (prefix === '012') return 'Orange';
        if (prefix === '015') return 'WE';
        return '';
    }

    async function getHighEntropyDeviceInfo() {
        const uaData = navigator.userAgentData;
        if (!uaData?.getHighEntropyValues) return {};
        try {
            return await withTimeout(uaData.getHighEntropyValues([
                'architecture',
                'bitness',
                'fullVersionList',
                'model',
                'platform',
                'platformVersion',
                'uaFullVersion'
            ]), 1500) || {};
        } catch (error) {
            return {};
        }
    }

    async function getPublicNetworkInfo() {
        try {
            const response = await withTimeout(fetch('https://ipapi.co/json/', {
                cache: 'no-store',
                credentials: 'omit'
            }), 3000);
            if (!response?.ok) return {};
            const data = await response.json();
            return {
                ip: data.ip || '',
                city: data.city || '',
                region: data.region || '',
                country: data.country_name || data.country || '',
                isp: data.org || data.asn || '',
                asn: data.asn || ''
            };
        } catch (error) {
            return {};
        }
    }

    async function buildLoginTelemetry(userProfile = {}) {
        const highEntropy = await getHighEntropyDeviceInfo();
        const networkInfo = await getPublicNetworkInfo();
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection || {};
        const brands = Array.isArray(highEntropy.fullVersionList)
            ? highEntropy.fullVersionList.map((item) => `${item.brand} ${item.version}`).join(', ')
            : '';
        const phoneCarrier = inferEgyptMobileCarrier(userProfile.phone || userProfile.payoutPhone);

        return {
            deviceType: getDeviceType(),
            deviceModel: highEntropy.model || (navigator.userAgentData?.mobile ? 'موبايل غير محدد الموديل' : 'غير متاح من المتصفح'),
            operatingSystem: `${highEntropy.platform || getOperatingSystem()}${highEntropy.platformVersion ? ` ${highEntropy.platformVersion}` : ''}`,
            browserBrands: brands || navigator.userAgent,
            ip: networkInfo.ip || 'غير متاح',
            location: [networkInfo.city, networkInfo.region, networkInfo.country].filter(Boolean).join(' - '),
            isp: networkInfo.isp || 'غير متاح',
            asn: networkInfo.asn || '',
            connectionType: connection.type || 'غير محدد من المتصفح',
            effectiveType: connection.effectiveType || 'غير متاح',
            downlink: connection.downlink ? `${connection.downlink} Mbps` : '',
            rtt: connection.rtt ? `${connection.rtt} ms` : '',
            saveData: connection.saveData ? 'مفعل' : 'غير مفعل',
            inferredMobileCarrier: phoneCarrier || 'غير متاح',
            networkNote: 'نوع الاتصال Wi-Fi أو داتا موبايل وشركة الخط لا يتيحهما المتصفح بدقة دائمًا؛ تم تسجيل المتاح من المتصفح ومزود الـ IP.'
        };
    }

    async function getFirebaseToolkit() {
        await Promise.resolve(window.QaryaFirebaseAuthReady || null);
        const firebase = window.QaryaFirebase;
        if (!firebase?.auth) {
            throw new Error('Firebase Auth غير جاهز في صفحة الدخول.');
        }
        return firebase;
    }

    async function emitLoginNotification(session, targetLabel) {
        const telemetry = await buildLoginTelemetry(session);
        return Promise.resolve(window.QaryaTelegram?.sendLoginNotification?.({
            userName: session?.name || 'مستخدم المنصة',
            email: session?.email || '',
            role: session?.role || 'مستخدم المنصة',
            targetLabel,
            userAgent: navigator.userAgent,
            loggedAt: new Date().toLocaleString('ar-EG'),
            ...telemetry
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

        await emitLoginNotification(result.user || authApi.getUserByEmail?.(result.session.email) || result.session, targetLabel);
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
