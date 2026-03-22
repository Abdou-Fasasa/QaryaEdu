(() => {
    const authApi = window.QaryaAuth;
    const authGuard = window.QaryaAuthGuard;
    const ADMIN_CONTACT_ENDPOINT = 'https://api.telegram.org/bot8751705299:AAHobnl-fXDRNGydTzZdnO96TaDCP_a5rIU/sendMessage';
    const ADMIN_CHAT_ID = '1213902845';
    let activeSession = null;
    let countdownTimer = null;

    if (!authApi) return;

    // 1. حقن التنسيقات (تحسينات الـ CSS)
    const injectStyles = () => {
        if (document.getElementById('qarya-custom-style')) return;
        const style = document.createElement('style');
        style.id = 'qarya-custom-style';
        style.innerHTML = `
            /* تنسيق بوابة الترحيب */
            .welcome-gate {
                position: fixed;
                top: 0; left: 0;
                width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                padding: 15px;
                box-sizing: border-box;
            }
            .welcome-gate-card {
                background: #fff;
                border-radius: 15px;
                max-width: 600px;
                width: 100%;
                max-height: 95vh;
                overflow-y: auto;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                direction: rtl;
            }
            /* إخفاء زر الدخول افتراضياً */
            #welcome-continue-button { display: none; }

            /* تنسيق حقل كلمة المرور مع العين (تحسينات للظهور) */
            .password-wrapper {
                position: relative !important;
                display: flex !important;
                align-items: center !important;
                width: 100% !important;
            }
            .toggle-password-icon {
                position: absolute !important;
                left: 15px !important; /* مكان الأيقونة جهة اليسار للـ RTL */
                cursor: pointer !important;
                color: #888 !important;
                z-index: 10 !important;
                font-size: 18px !important;
                top: 50% !important;
                transform: translateY(-50%) !important;
            }
            .toggle-password-icon:hover { color: #333 !important; }
            #login-password { 
                padding-left: 45px !important; /* مساحة للأيقونة */
                width: 100% !important;
                box-sizing: border-box !important;
            }
        `;
        document.head.appendChild(style);
    };

    document.addEventListener('DOMContentLoaded', () => {
        injectStyles();
        
        const loginForm = document.getElementById('login-form');
        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');
        const messageBox = document.getElementById('login-message');

        // --- إضافة ميزة إظهار/إخفاء كلمة المرور (أيقونة واحدة فقط وتعمل) ---
        if (passwordInput && !passwordInput.dataset.eyeReady) {
            // 1. إنشاء الأيقونة (افتراضياً عين مغلقة)
            const eyeIcon = document.createElement('i');
            eyeIcon.className = 'fas fa-eye-slash toggle-password-icon';
            
            // 2. إنشاء الـ Wrapper ووضعه في الـ DOM
            const wrapper = document.createElement('div');
            wrapper.className = 'password-wrapper';
            
            // تأكد من أن الحقل له أب مباشر قبل محاولة النقل
            if (passwordInput.parentNode) {
                passwordInput.parentNode.insertBefore(wrapper, passwordInput);
                wrapper.appendChild(passwordInput);
                wrapper.appendChild(eyeIcon);

                // 3. إضافة حدث الضغط لتبديل الحالة
                eyeIcon.addEventListener('click', (e) => {
                    // منع أي سلوك افتراضي للنموذج
                    e.preventDefault();
                    
                    const isPassword = passwordInput.type === 'password';
                    
                    // تبديل نوع الحقل
                    passwordInput.type = isPassword ? 'text' : 'password';
                    
                    // تبديل شكل الأيقونة
                    eyeIcon.className = isPassword ? 'fas fa-eye toggle-password-icon' : 'fas fa-eye-slash toggle-password-icon';
                });

                // تعليم الحقل بانه تم إعداد العين له
                passwordInput.dataset.eyeReady = "true";
            }
        }

        ensureWelcomeGate();

        const welcomeGate = document.getElementById('welcome-gate');
        const welcomeFeedback = document.getElementById('welcome-feedback');
        const welcomeForm = document.getElementById('welcome-message-form');
        const welcomeMessageText = document.getElementById('welcome-message-text');
        const welcomeSendButton = document.getElementById('welcome-send-button');
        const welcomeContinueButton = document.getElementById('welcome-continue-button');
        
        const hoursElement = document.getElementById('welcome-hours');
        const minutesElement = document.getElementById('welcome-minutes');
        const secondsElement = document.getElementById('welcome-seconds');

        function ensureWelcomeGate() {
            if (document.getElementById('welcome-gate')) return;
            const gate = document.createElement('section');
            gate.className = 'welcome-gate';
            gate.id = 'welcome-gate';
            gate.style.display = 'none'; 
            
            gate.innerHTML = `
                <div class="welcome-gate-card">
                    <div class="welcome-gate-top">
                        <span class="welcome-badge"><i class="fas fa-heart"></i> إعلان حب رسمي</span>
                        <p class="welcome-user" id="welcome-user">مرحبًا بك</p>
                    </div>
                    <h2 class="welcome-title">رسالة من القلب ليكي يا منى .. قدام العالم كله</h2>
                    <p class="welcome-body">
                        يا منى، الرسالة دي ممكن تبانلك دلوقتي إنها خاصة بيكي انتي بس، بس الحقيقة إنها هتظهر لكل العالم ولكل الناس وقت الامتحانات على المنصة دي! أنا قصدت أعمل كده عشان أعرض حبي ليكي قدام الجميع من غير أي كسوف. أنا بحبك.. والله العظيم بحبك بجد وطالعة من قلبي بتلقائية ومن غير أي زواق. 
                        <br><br> 
                        وفي النهاية، أنا حابب أشكر إدارة المنصة جداً على موافقتهم لنشر الرسالة دي وتوصيلها لكل الناس عشان الكل يشهد على حبي ليكي.
                    </p>

                    <div class="welcome-timer-block">
                        <div>
                            <span class="welcome-label">العد التنازلي حتى ظهور الرسالة للجميع</span>
                            <strong class="welcome-timer-status">يتم حساب الوقت الآن...</strong>
                        </div>
                        <div class="welcome-timer-grid">
                            <div class="welcome-time-box"><span id="welcome-hours">00</span><small>ساعة</small></div>
                            <div class="welcome-time-box"><span id="welcome-minutes">00</span><small>دقيقة</small></div>
                            <div class="welcome-time-box"><span id="welcome-seconds">00</span><small>ثانية</small></div>
                        </div>
                    </div>

                    <form id="welcome-message-form" class="welcome-message-form">
                        <textarea id="welcome-message-text" placeholder="اكتبي ردك هنا..."></textarea>
                        <div class="welcome-actions" style="padding: 15px; text-align: center;">
                            <button type="submit" class="btn-secondary" id="welcome-send-button" style="width:100%; padding:12px; cursor:pointer;">إرسال الرد</button>
                            <button type="button" class="btn-primary" id="welcome-continue-button" style="width:100%; padding:12px; cursor:pointer; background-color: #28a745; color: white; border: none; border-radius: 5px;">دخول المنصة</button>
                        </div>
                        <p class="welcome-feedback" id="welcome-feedback" style="display:none; text-align:center; padding:10px;"></p>
                    </form>
                </div>
            `;
            document.body.appendChild(gate);
        }

        function updateCountdown() {
            const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
            const target = new Date(now);
            target.setHours(19, 0, 0, 0);
            let diff = target.getTime() - now.getTime();
            if (diff < 0) { target.setDate(target.getDate() + 1); diff = target.getTime() - now.getTime(); }
            const totalSeconds = Math.floor(diff / 1000);
            if (hoursElement) hoursElement.textContent = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
            if (minutesElement) minutesElement.textContent = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
            if (secondsElement) secondsElement.textContent = String(totalSeconds % 60).padStart(2, '0');
        }

        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const result = authApi.login(emailInput.value.trim(), passwordInput.value);
            if (result.ok) {
                activeSession = result.session;
                document.getElementById('welcome-user').textContent = `مرحبًا ${activeSession.name}`;
                welcomeGate.style.display = 'flex';
                updateCountdown();
                if (countdownTimer) clearInterval(countdownTimer);
                countdownTimer = setInterval(updateCountdown, 1000);
            } else {
                messageBox.textContent = result.message;
                messageBox.hidden = false;
            }
        });

        if (welcomeForm) {
            welcomeForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const text = welcomeMessageText.value.trim();
                if (!text) return;

                welcomeSendButton.disabled = true;
                welcomeSendButton.textContent = 'جارٍ الإرسال...';

                try {
                    await fetch(ADMIN_CONTACT_ENDPOINT, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: ADMIN_CHAT_ID,
                            text: `💖 رد من منى:\nالاسم: ${activeSession.name}\nالرد: ${text}`
                        })
                    });

                    welcomeFeedback.textContent = 'تم إرسال ردك بنجاح. يمكنك الدخول الآن.';
                    welcomeFeedback.style.display = 'block';
                    welcomeFeedback.style.color = 'green';
                    
                    welcomeSendButton.style.display = 'none';
                    welcomeContinueButton.style.display = 'block';
                    welcomeMessageText.disabled = true;
                } catch (err) {
                    welcomeSendButton.disabled = false;
                    welcomeSendButton.textContent = 'حاولي مرة أخرى';
                }
            });
        }

        if (welcomeContinueButton) {
            welcomeContinueButton.addEventListener('click', () => {
                const params = new URLSearchParams(window.location.search);
                const target = authGuard?.resolveSafeTarget(params.get('next')) || 'index.html';
                window.location.replace(target);
            });
        }
    });
})();