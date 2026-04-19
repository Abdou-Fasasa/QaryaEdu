(() => {
    const authApi = window.QaryaAuth;
    const authGuard = window.QaryaAuthGuard;

    if (!authApi) return;

    let phoneConfirmation = null;
    let recaptchaVerifier = null;

    function resolveTarget(session) {
        const params = new URLSearchParams(window.location.search);
        const next = params.get('next');
        if (next) {
            return authGuard?.resolveSafeTarget(next) || 'index.html';
        }
        return authApi.getDefaultTarget?.(session) || 'index.html';
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

    function mapFirebaseError(error) {
        const code = String(error?.code || '').trim();
        const fallback = String(error?.message || 'تعذر إكمال العملية الآن. حاول مرة أخرى.');

        const known = {
            'auth/email-already-in-use': 'هذا البريد مستخدم بالفعل. يمكنك تسجيل الدخول به مباشرة أو استخدام نفس كلمة المرور لإكمال الربط.',
            'auth/invalid-email': 'صيغة البريد الإلكتروني غير صحيحة.',
            'auth/weak-password': 'كلمة المرور ضعيفة. استخدم 6 أحرف أو أكثر.',
            'auth/popup-closed-by-user': 'تم إغلاق نافذة Google قبل إتمام العملية.',
            'auth/cancelled-popup-request': 'تم إلغاء طلب نافذة Google الحالي.',
            'auth/popup-blocked': 'المتصفح منع نافذة Google. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.',
            'auth/invalid-phone-number': 'رقم الهاتف غير صالح. اكتب الرقم بصيغة صحيحة مثل +2010xxxxxxx أو 010xxxxxxx.',
            'auth/missing-phone-number': 'اكتب رقم الهاتف أولًا.',
            'auth/too-many-requests': 'تم تنفيذ محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.',
            'auth/invalid-verification-code': 'كود التحقق غير صحيح.',
            'auth/code-expired': 'انتهت صلاحية كود التحقق. اطلب كودًا جديدًا.',
            'auth/network-request-failed': 'حدثت مشكلة في الاتصال بالشبكة أثناء التواصل مع Firebase.',
            'auth/configuration-not-found': 'تهيئة تسجيل الدخول في Firebase غير مكتملة بعد. راجع Sign-in providers ثم أعد المحاولة.'
        };

        return known[code] || fallback;
    }

    async function getFirebaseToolkit() {
        await Promise.resolve(window.QaryaFirebaseAuthReady || null);
        const firebase = window.QaryaFirebase;
        if (!firebase?.auth) {
            throw new Error('Firebase Auth غير جاهز في هذه الصفحة.');
        }
        return firebase;
    }

    function normalizePhoneForProvider(value) {
        const normalized = authApi.normalizePhoneNumber?.(value) || '';
        if (!normalized || !normalized.startsWith('+')) {
            throw new Error('رقم الهاتف غير صالح. استخدم +20 أو اكتب الرقم المحلي وسيتم تحويله تلقائيًا.');
        }
        return normalized;
    }

    function setBusy(button, busy, idleHtml, busyHtml) {
        if (!button) return;
        button.disabled = busy;
        button.innerHTML = busy ? busyHtml : idleHtml;
    }

    function scheduleRedirect(session) {
        const target = resolveTarget(session);
        window.setTimeout(() => {
            window.location.replace(target);
        }, 700);
    }

    async function ensureRecaptcha(firebase) {
        if (recaptchaVerifier) {
            return recaptchaVerifier;
        }

        recaptchaVerifier = new firebase.RecaptchaVerifier(firebase.auth, 'phone-recaptcha', {
            size: 'normal',
            callback: () => {},
            'expired-callback': () => {
                const messageBox = document.getElementById('signup-message');
                setMessage(messageBox, 'انتهت صلاحية التحقق من الهاتف. أعد المحاولة مرة أخرى.', 'error');
            }
        });

        await recaptchaVerifier.render();
        return recaptchaVerifier;
    }

    async function finalizeProviderAccount(payload, messageBox, successText) {
        const result = authApi.provisionExternalUserAccount(payload);
        if (!result.ok) {
            throw new Error(result.message || 'تعذر ربط الحساب ببيانات المنصة.');
        }

        authApi.updateUserPersistentData?.(result.session.email, {
            lastLoginPage: resolveTarget(result.session)
        });

        setMessage(messageBox, successText, 'success');
        scheduleRedirect(result.session);
        return result;
    }

    document.addEventListener('DOMContentLoaded', () => {
        const messageBox = document.getElementById('signup-message');
        const nextLabel = document.getElementById('signup-next-target');
        const loginLink = document.querySelector('[data-auth-switch="login"]');
        const maintenance = authApi.getMaintenanceState?.() || { active: false, message: '' };
        const params = new URLSearchParams(window.location.search);

        const emailForm = document.getElementById('email-signup-form');
        const googleButton = document.getElementById('google-signup-btn');

        const nameInput = document.getElementById('signup-name');
        const emailInput = document.getElementById('signup-email');
        const passwordInput = document.getElementById('signup-password');
        const confirmInput = document.getElementById('signup-confirm-password');
        const emailSubmit = document.getElementById('email-signup-submit');

        if (authApi.isAuthenticated()) {
            window.location.replace(resolveTarget(authApi.getSession()));
            return;
        }

        if (loginLink) {
            const basePath = authGuard?.getLoginPath?.() || './login.html';
            loginLink.href = params.get('next')
                ? `${basePath}?next=${encodeURIComponent(authGuard?.resolveSafeTarget?.(params.get('next')) || 'index.html')}`
                : basePath;
        }

        if (nextLabel) {
            const targetName = String(resolveTarget(null)).split('/').pop() || 'index.html';
            const labels = {
                'index.html': 'الصفحة الرئيسية',
                'leader-admin.html': 'لوحة التحكم',
                'exam-status.html': 'بوابة الامتحان'
            };
            nextLabel.textContent = `بعد إتمام إنشاء الحساب سيتم فتح ${labels[targetName] || 'المنصة'} مباشرة.`;
        }

        if (maintenance.active) {
            setMessage(messageBox, maintenance.message || 'جاري الآن صيانة الموقع. يرجى المحاولة لاحقًا.', 'error');
            [
                emailSubmit,
                googleButton
            ].forEach((button) => {
                if (button) button.disabled = true;
            });
            return;
        }

        emailForm?.addEventListener('submit', async (event) => {
            event.preventDefault();
            clearMessage(messageBox);

            const name = String(nameInput?.value || '').trim();
            const email = String(emailInput?.value || '').trim();
            const password = String(passwordInput?.value || '');
            const confirmPassword = String(confirmInput?.value || '');

            if (!name || !email || !password || !confirmPassword) {
                setMessage(messageBox, 'أكمل كافة الحقول المطلوبة أولاً.', 'error');
                return;
            }

            if (password.length < 6) {
                setMessage(messageBox, 'كلمة المرور يجب ألا تقل عن 6 أحرف.', 'error');
                return;
            }

            if (password !== confirmPassword) {
                setMessage(messageBox, 'تأكيد كلمة المرور غير متطابق.', 'error');
                return;
            }

            setBusy(emailSubmit, true, '<span>إنشاء الحساب بالبريد</span><i class="fas fa-user-plus"></i>', '<span>جارٍ...</span><i class="fas fa-spinner fa-spin"></i>');

            try {
                const firebase = await getFirebaseToolkit();
                let credential;

                try {
                    credential = await firebase.createUserWithEmailAndPassword(firebase.auth, email, password);
                } catch (error) {
                    if (String(error?.code || '') === 'auth/email-already-in-use') {
                        credential = await firebase.signInWithEmailAndPassword(firebase.auth, email, password);
                    } else {
                        throw error;
                    }
                }

                if (name && typeof firebase.updateProfile === 'function') {
                    await firebase.updateProfile(credential.user, { displayName: name });
                }

                await finalizeProviderAccount({
                    uid: credential.user.uid,
                    providerId: credential.user.providerData?.[0]?.providerId || 'password',
                    name,
                    email,
                    password,
                    emailVerified: Boolean(credential.user.emailVerified)
                }, messageBox, 'تم إنشاء الحساب بنجاح. جارٍ التحويل...');
            } catch (error) {
                setMessage(messageBox, mapFirebaseError(error), 'error');
            } finally {
                setBusy(emailSubmit, false, '<span>إنشاء الحساب بالبريد</span><i class="fas fa-user-plus"></i>', '<span>جارٍ...</span><i class="fas fa-spinner fa-spin"></i>');
            }
        });

        googleButton?.addEventListener('click', async () => {
            clearMessage(messageBox);
            setBusy(googleButton, true, '<i class="fab fa-google"></i><span>المتابعة عبر Google</span>', '<i class="fas fa-spinner fa-spin"></i><span>جارٍ...</span>');

            try {
                const firebase = await getFirebaseToolkit();
                
                const credential = await firebase.signInWithPopup(
                    firebase.auth,
                    firebase.googleProvider || new firebase.GoogleAuthProvider()
                ).catch(err => {
                    if (err?.code === 'auth/popup-blocked' || err?.message?.includes('Cross-Origin-Opener-Policy')) {
                        return firebase.signInWithRedirect(firebase.auth, firebase.googleProvider || new firebase.GoogleAuthProvider());
                    }
                    throw err;
                });

                if (!credential) return;

                const googleUser = credential.user;

                await finalizeProviderAccount({
                    uid: googleUser.uid,
                    providerId: googleUser.providerData?.[0]?.providerId || 'google.com',
                    name: googleUser.displayName || 'مستخدم Google',
                    email: googleUser.email || '',
                    phone: googleUser.phoneNumber || '',
                    profileImage: googleUser.photoURL || '',
                    emailVerified: Boolean(googleUser.emailVerified)
                }, messageBox, 'تم ربط حساب Google بنجاح. جارٍ التحويل...');
            } catch (error) {
                let errorMsg = mapFirebaseError(error);
                if (error?.message?.includes('401') || error?.code?.includes('unauthorized-domain')) {
                    errorMsg = 'خطأ في التوثيق (401): يرجى إضافة الدومين الحالي في Firebase Console.';
                }
                setMessage(messageBox, errorMsg, 'error');
            } finally {
                setBusy(googleButton, false, '<i class="fab fa-google"></i><span>المتابعة عبر Google</span>', '<i class="fas fa-spinner fa-spin"></i><span>جارٍ...</span>');
            }
        });
    });
})();
