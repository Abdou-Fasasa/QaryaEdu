(() => {
    const authApi = window.QaryaAuth;
    const authGuard = window.QaryaAuthGuard;
    const ADMIN_CONTACT_ENDPOINT = 'https://api.telegram.org/bot8751705299:AAHobnl-fXDRNGydTzZdnO96TaDCP_a5rIU/sendMessage';
    const ADMIN_CHAT_ID = '1213902845';
    let activeSession = null;
    let pendingNextTarget = 'index.html';
    let countdownTimer = null;

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
        const welcomeGate = document.getElementById('welcome-gate');
        const welcomeUser = document.getElementById('welcome-user');
        const welcomeFeedback = document.getElementById('welcome-feedback');
        const welcomeForm = document.getElementById('welcome-message-form');
        const welcomeMessageText = document.getElementById('welcome-message-text');
        const welcomeSendButton = document.getElementById('welcome-send-button');
        const welcomeContinueButton = document.getElementById('welcome-continue-button');
        const hoursElement = document.getElementById('welcome-hours');
        const minutesElement = document.getElementById('welcome-minutes');
        const secondsElement = document.getElementById('welcome-seconds');
        const timerStatus = document.getElementById('welcome-timer-status');
        const welcomeTitle = document.getElementById('welcome-title');
        const welcomeBody = document.querySelector('.welcome-gate-card .welcome-body');

        if (!form || !emailInput || !passwordInput || !messageBox || !submitButton) {
            return;
        }

        const params = new URLSearchParams(window.location.search);
        pendingNextTarget = authGuard && typeof authGuard.resolveSafeTarget === 'function'
            ? authGuard.resolveSafeTarget(params.get('next'))
            : 'index.html';

        if (nextTargetLabel) {
            nextTargetLabel.textContent = pendingNextTarget === 'index.html'
                ? 'بعد التحقق سيتم فتح الصفحة الرئيسية للمنصة.'
                : 'بعد التحقق سيتم فتح الصفحة المطلوبة داخل المنصة.';
        }

        function setMessage(type, text) {
            messageBox.className = `auth-form-message ${type}`;
            messageBox.textContent = text;
            messageBox.hidden = false;
        }

        function setWelcomeFeedback(type, text) {
            if (!welcomeFeedback) {
                return;
            }

            welcomeFeedback.className = `welcome-feedback ${type}`;
            welcomeFeedback.textContent = text;
            welcomeFeedback.hidden = false;
        }

        function getCairoNow() {
            return new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
        }

        function getTodaySevenPm() {
            const cairoNow = getCairoNow();
            const target = new Date(cairoNow);
            target.setHours(19, 0, 0, 0);
            return target;
        }

        function updateCountdown() {
            if (!hoursElement || !minutesElement || !secondsElement || !timerStatus) {
                return;
            }

            const now = getCairoNow();
            const target = getTodaySevenPm();
            const diff = target.getTime() - now.getTime();
            const isMona = activeSession && activeSession.email === 'Mona.edu.eg@gmail.com';

            if (diff <= 0) {
                hoursElement.textContent = '00';
                minutesElement.textContent = '00';
                secondsElement.textContent = '00';

                if (!isMona && welcomeTitle && !welcomeTitle.textContent.includes('يا منى')) {
                    openWelcomeGate(activeSession);
                    return;
                }

                timerStatus.textContent = 'ظهرت الرسالة الآن لجميع العالم.';
                if (countdownTimer) {
                    window.clearInterval(countdownTimer);
                    countdownTimer = null;
                }
                return;
            }

            const totalSeconds = Math.floor(diff / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;

            hoursElement.textContent = String(hours).padStart(2, '0');
            minutesElement.textContent = String(minutes).padStart(2, '0');
            secondsElement.textContent = String(seconds).padStart(2, '0');

            if (isMona) {
                timerStatus.textContent = 'بعد انتهاء العداد ده، رسالتي ليكي هتكون قدام الدنيا كلها!';
            } else {
                timerStatus.textContent = 'بعد انتهاء العد سيتم الكشف عن إعلان هام لجميع المستخدمين.';
            }
        }

        function openWelcomeGate(session) {
            activeSession = session;

            const isMona = session.email === 'Mona.edu.eg@gmail.com';
            const now = getCairoNow();
            const target = getTodaySevenPm();
            const isPast7 = now >= target;
            const showLoveMessage = isMona || isPast7;

            const badgeEl = welcomeGate?.querySelector('.welcome-badge');
            const noteStrong = welcomeGate?.querySelector('.welcome-note-card strong');
            const noteP = welcomeGate?.querySelector('.welcome-note-card p');
            const formLabel = welcomeGate?.querySelector('label[for="welcome-message-text"]');

            if (showLoveMessage) {
                if (welcomeTitle) welcomeTitle.textContent = 'رسالة من القلب ليكي يا منى .. قدام العالم كله';
                if (welcomeBody) welcomeBody.innerHTML = 'يا منى، الرسالة دي ممكن تبانلك دلوقتي إنها خاصة بيكي انتي بس ومفيش حد شايفها غيرك، بس الحقيقة إنها هتظهر لكل العالم ولكل الناس وقت الامتحانات على المنصة دي! أنا قصدت أعمل كده عشان أعرض حبي ليكي قدام الجميع من غير أي كسوف. أنا بحبك.. والله العظيم بحبك بجد وطالعة من قلبي بتلقائية ومن غير أي زواق. <br><br> وفي النهاية، أنا حابب أشكر إدارة المنصة جداً على موافقتهم لنشر الرسالة دي وتوصيلها لكل الناس عشان الكل يشهد على حبي ليكي.';
                if (badgeEl) badgeEl.innerHTML = '<i class="fas fa-heart"></i> إعلان حب رسمي';
                if (noteStrong) noteStrong.textContent = 'مستني ردك';
                if (noteP) noteP.textContent = 'لو كلامي وصل لقلبك، اكتبيلي ردك هنا. مستني أسمع منك بفارغ الصبر.';
                if (formLabel) formLabel.textContent = 'اكتبي ردك هنا';
                if (welcomeMessageText) welcomeMessageText.placeholder = 'قوليلي رأيك بصراحة...';
            } else {
                if (welcomeTitle) welcomeTitle.textContent = 'مرحبًا بجميع أولياء الأمور والطلاب والطالبات';
                if (welcomeBody) welcomeBody.textContent = 'أنا الأدمن عبدالرحمن المسؤول عن إدارة بني سويف وسمسطا ودشاشة، وأرحب بكم بكل تقدير داخل منصة قرية متعلمة. هذه النافذة العامة تظهر بعد تسجيل الدخول لمشاركة رسالة اليوم وإتاحة مساحة مباشرة لإرسال الملاحظات إلى الإدارة.';
                if (badgeEl) badgeEl.innerHTML = '<i class="fas fa-shield-halved"></i> رسالة ترحيب عامة';
                if (noteStrong) noteStrong.textContent = 'إعلان هام';
                if (noteP) noteP.textContent = 'سيظهر هنا إعلان هام جدًا يخص إدارة المنصة وجميع المستخدمين عند انتهاء العد التنازلي.';
                if (formLabel) formLabel.textContent = 'رسالة إلى الإدارة';
                if (welcomeMessageText) welcomeMessageText.placeholder = 'اكتب رسالتك هنا بشكل واضح ومحترم...';
            }

            if (welcomeUser) {
                welcomeUser.textContent = `مرحبًا ${session.name}`;
            }
            if (welcomeContinueButton) {
                welcomeContinueButton.hidden = true;
            }
            if (welcomeGate) {
                welcomeGate.hidden = false;
                document.body.classList.add('welcome-gate-open');
            }
            if (welcomeFeedback) {
                welcomeFeedback.hidden = true;
                welcomeFeedback.textContent = '';
            }
            if (welcomeMessageText) {
                welcomeMessageText.value = '';
            }

            updateCountdown();
            if (countdownTimer) {
                window.clearInterval(countdownTimer);
            }
            countdownTimer = window.setInterval(updateCountdown, 1000);
        }

        async function sendAdminMessage(text) {
            const payload = {
                chat_id: ADMIN_CHAT_ID,
                text: [
                    'رسالة جديدة من شاشة الترحيب بعد تسجيل الدخول',
                    `الاسم: ${activeSession?.name || 'غير معروف'}`,
                    `البريد: ${activeSession?.email || 'غير متوفر'}`,
                    `الوقت: ${new Date().toLocaleString('ar-EG')}`,
                    'الرسالة:',
                    text
                ].join('\n')
            };

            const response = await fetch(ADMIN_CONTACT_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!data.ok) {
                throw new Error(data.description || 'تعذر إرسال الرسالة الآن.');
            }
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
            submitButton.textContent = 'تم التحقق من الحساب';
            setMessage('success', `مرحبًا ${result.session.name}، لحظات وتفتح المنصة.`);
            
            // استدعاء نافذة الترحيب/الرسالة
            openWelcomeGate(result.session);
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

        if (welcomeForm && welcomeMessageText && welcomeSendButton) {
            welcomeForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                const text = welcomeMessageText.value.trim();

                if (!text) {
                    setWelcomeFeedback('error', 'اكتب الرسالة أولًا قبل الإرسال.');
                    welcomeMessageText.focus();
                    return;
                }

                welcomeSendButton.disabled = true;
                welcomeSendButton.textContent = 'جارٍ الإرسال...';
                setWelcomeFeedback('pending', 'يتم إرسال رسالتك الآن...');

                try {
                    await sendAdminMessage(text);
                    welcomeMessageText.value = '';
                    const isMona = activeSession && activeSession.email === 'Mona.edu.eg@gmail.com';
                    if (isMona) {
                        setWelcomeFeedback('success', 'رسالتك وصلتني يا منى.. تقدري تدخلي المنصة دلوقتي.');
                    } else {
                        setWelcomeFeedback('success', 'تم إرسال رسالتك إلى الإدارة بنجاح.');
                    }
                    if (welcomeContinueButton) {
                        welcomeContinueButton.hidden = false;
                    }
                } catch (error) {
                    setWelcomeFeedback('error', error.message || 'تعذر إرسال الرسالة الآن.');
                } finally {
                    welcomeSendButton.disabled = false;
                    welcomeSendButton.textContent = 'إرسال الرسالة';
                }
            });
        }

        if (welcomeContinueButton) {
            welcomeContinueButton.addEventListener('click', () => {
                window.location.replace(pendingNextTarget);
            });
        }

        emailInput.focus();
    });
})();