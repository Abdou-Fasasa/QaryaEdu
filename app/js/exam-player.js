(() => {
    const EXAM_GATE_KEY = 'qaryaeduExamGatePass';
    const DEVICE_LOCK_KEY = 'qaryaeduExamDeviceLock';
    const CAMERA_POSITION_KEY = 'qaryaeduProctorBubblePosition';
    const WAIT_TIME_SECONDS = 0;
    const GATE_TTL_MS = 30 * 60 * 1000;
    const PASS_PERCENTAGE = 50;
    const PASS_REWARD_AMOUNT = 100;
    const FALLBACK_QUESTION_SEED = [
        ['اللغة العربية', 'ما نوع "لا" في قولنا: لا طالبَ علمٍ مهملٌ؟', ['ناهية جازمة', 'زائدة للتوكيد', 'نافية للجنس عاملة', 'نافية غير عاملة'], 'نافية للجنس عاملة'],
        ['اللغة العربية', 'أي الجمل الآتية تحتوي على بدل اشتمال؟', ['حضر الطالب محمدٌ', 'أعجبني الطالبُ خلقُه', 'قرأت الكتاب نصفَه', 'سافر القائد عبد الرحمن'], 'أعجبني الطالبُ خلقُه'],
        ['اللغة العربية', 'أي الأفعال الآتية فعل معتل ناقص؟', ['وعد', 'باع', 'نام', 'رمى'], 'رمى'],
        ['الرياضيات', 'إذا كان س^2 - 5س + 6 = 0، فما مجموع جذري المعادلة؟', ['6', '-5', '1', '5'], '5'],
        ['الرياضيات', 'في متتابعة هندسية حدها الأول 3 ونسبتها 2، ما الحد السادس؟', ['96', '48', '64', '128'], '96'],
        ['الرياضيات', 'زاويتان متتامتان، إحداهما تزيد عن الأخرى 18 درجة. ما قياس الزاوية الصغرى؟', ['42', '54', '36', '72'], '36'],
        ['العلوم', 'أي عضية مسؤولة غالبًا عن إنتاج الطاقة داخل الخلية؟', ['الريبوسوم', 'الميتوكوندريا', 'النواة', 'جهاز جولجي'], 'الميتوكوندريا'],
        ['العلوم', 'عند مضاعفة فرق الجهد مع ثبات المقاومة، فإن شدة التيار:', ['تقل للنصف', 'تظل ثابتة', 'تتضاعف', 'تنعدم'], 'تتضاعف'],
        ['العلوم', 'ما نوع العدسة المستخدمة غالبًا لتصحيح قصر النظر؟', ['محدبة', 'أسطوانية فقط', 'مستوية', 'مقعرة'], 'مقعرة'],
        ['المعلومات العامة', 'أي دولة من الآتي لا تطل على البحر المتوسط؟', ['تشاد', 'مصر', 'تونس', 'اليونان'], 'تشاد'],
        ['المعلومات العامة', 'أي جهة تصدر مؤشر التنمية البشرية؟', ['منظمة الصحة العالمية', 'البنك الدولي', 'برنامج الأمم المتحدة الإنمائي', 'اليونسكو'], 'برنامج الأمم المتحدة الإنمائي'],
        ['المعلومات العامة', 'ما اسم خط الطول الرئيس الذي تقاس منه فروق التوقيت؟', ['مدار السرطان', 'خط الاستواء', 'مدار الجدي', 'خط جرينتش'], 'خط جرينتش']
    ];

    let cameraStream = null;
    let submitTimerId = null;
    let stateMonitorId = null;

    function parseJson(value, fallback) {
        try {
            return JSON.parse(value || '');
        } catch (error) {
            return fallback;
        }
    }

    function getVerifiedStudent() {
        return parseJson(sessionStorage.getItem('qarya_verified_student'), null);
    }

    function getExamGate() {
        return parseJson(sessionStorage.getItem(EXAM_GATE_KEY), null);
    }

    function getDeviceLock() {
        return parseJson(localStorage.getItem(DEVICE_LOCK_KEY), null);
    }

    function setDeviceLock(student) {
        localStorage.setItem(DEVICE_LOCK_KEY, JSON.stringify({
            requestId: student.requestId,
            name: student.name,
            leaderCode: student.leaderCode || '',
            lockedAt: new Date().toISOString()
        }));
    }

    function getExamRuntimeKey(requestId, examLevel) {
        return `qarya_exam_runtime_${String(requestId || '').trim().toUpperCase()}_${String(examLevel || '').trim()}`;
    }

    function getExamRuntime(requestId, examLevel) {
        return parseJson(sessionStorage.getItem(getExamRuntimeKey(requestId, examLevel)), null);
    }

    function setExamRuntime(requestId, examLevel, value) {
        sessionStorage.setItem(getExamRuntimeKey(requestId, examLevel), JSON.stringify(value));
    }

    function clearExamRuntime(requestId, examLevel) {
        sessionStorage.removeItem(getExamRuntimeKey(requestId, examLevel));
    }

    function validateExamGate(student, examLevel) {
        const gate = getExamGate();
        if (!gate) {
            return { ok: false, message: 'يجب الدخول إلى الامتحان من بوابة الامتحان أولًا.' };
        }
        if (gate.requestId !== student.requestId) {
            return { ok: false, message: 'تصريح الدخول لا يخص هذا الطلب.' };
        }
        if (gate.examLevel !== examLevel) {
            return { ok: false, message: 'تم توجيهك إلى نموذج امتحان غير مطابق لهذا الطلب.' };
        }
        if (Date.now() - Number(gate.issuedAt || 0) > GATE_TTL_MS) {
            return { ok: false, message: 'انتهت صلاحية تصريح الدخول. ادخل من البوابة مرة أخرى.' };
        }
        return { ok: true };
    }

    function ensureDeviceLock(student) {
        const lock = getDeviceLock();
        if (!lock) {
            setDeviceLock(student);
            return { allowed: true, lock: getDeviceLock() };
        }
        if (lock.requestId !== student.requestId) {
            return { allowed: false, lock };
        }
        return { allowed: true, lock };
    }

    function sessionMatchesApplication(authApi, application) {
        const session = authApi?.getSession?.();
        if (!session) return false;
        if (authApi.isAdminSession?.(session) || authApi.isLeader?.(session.email)) {
            return true;
        }

        const sessionUser = authApi.getUserByEmail?.(session.email);
        const sessionEmail = authApi.normalizeEmail?.(session.email);
        const applicationEmail = authApi.normalizeEmail?.(application.studentEmail);
        const sameEmail = Boolean(applicationEmail && sessionEmail === applicationEmail);
        const sameNationalId = Boolean(sessionUser?.nationalId && String(sessionUser.nationalId) === String(application.nationalId));
        const sessionRequestId = String(sessionUser?.requestId || sessionUser?.applicationRequestId || '').trim().toUpperCase();
        const applicationRequestId = String(application.requestId || '').trim().toUpperCase();
        const sameRequestId = Boolean(sessionRequestId && sessionRequestId === applicationRequestId);
        return sameEmail || sameNationalId || sameRequestId;
    }

    function getEgyptDateKey(value = Date.now()) {
        const date = value instanceof Date ? value : new Date(value || Date.now());
        if (Number.isNaN(date.getTime())) return '';

        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Africa/Cairo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).formatToParts(date);
        const year = parts.find((part) => part.type === 'year')?.value || '';
        const month = parts.find((part) => part.type === 'month')?.value || '';
        const day = parts.find((part) => part.type === 'day')?.value || '';
        return year && month && day ? `${year}-${month}-${day}` : '';
    }

    function hasAttemptedToday(store, requestId, dateValue = Date.now()) {
        if (store?.hasExamAttemptOnDate) {
            return store.hasExamAttemptOnDate(requestId, dateValue);
        }
        return Boolean(store?.getExamAttemptsByRequestIdAndDate?.(requestId, dateValue)?.length);
    }

    function blockExam(form, resultDiv, message) {
        form?.querySelectorAll('input, select, button').forEach((element) => {
            element.disabled = true;
        });

        if (resultDiv) {
            resultDiv.style.display = 'block';
            resultDiv.className = 'result fail';
            resultDiv.innerHTML = `<strong>تم إيقاف الدخول</strong><p>${message}</p>`;
        }
    }

    function buildFallbackQuestions() {
        return FALLBACK_QUESTION_SEED.map((item, index) => ({
            id: `fallback-q-${index + 1}`,
            type: 'mcq',
            section: item[0],
            q: item[1],
            options: item[2],
            answer: item[3],
            points: 2
        }));
    }

    function getExamQuestions(examLevel) {
        const questionKey = examLevel === 'senior' ? 'seniorQuestions' : 'juniorQuestions';
        const loadedQuestions = Array.isArray(window.QaryaQuestions?.[questionKey])
            ? window.QaryaQuestions[questionKey]
            : [];
        return loadedQuestions.length ? loadedQuestions : buildFallbackQuestions();
    }

    function buildVerifiedApplication(authApi, verifiedStudent, examLevel) {
        const session = authApi?.getSession?.();
        const sessionUser = session?.email ? (authApi.getUserByEmail?.(session.email) || session) : {};
        const now = new Date().toISOString();
        const requestId = String(verifiedStudent.requestId || sessionUser.requestId || sessionUser.applicationRequestId || '').trim().toUpperCase();

        return {
            requestId,
            nationalId: verifiedStudent.nationalId || sessionUser.nationalId || '',
            status: 'accepted',
            name: verifiedStudent.name || sessionUser.name || `طالب ${requestId}`,
            age: Number(verifiedStudent.age || sessionUser.age || (examLevel === 'senior' ? 18 : 0)),
            governorate: sessionUser.governorate || '',
            city: sessionUser.city || '',
            village: sessionUser.village || '',
            leaderCode: verifiedStudent.leaderCode || sessionUser.leaderCode || '',
            studentEmail: verifiedStudent.studentEmail || sessionUser.email || '',
            studentPassword: sessionUser.password || '',
            createdAt: now,
            updatedAt: now,
            message: 'تم السماح بدخول الامتحان برقم الطلب.',
            examAccess: 'default',
            createdByAdmin: true,
            manualStudent: true
        };
    }

    function resolveApplicationForExam(store, authApi, verifiedStudent, examLevel) {
        const existing = store?.getApplicationByRequestId?.(verifiedStudent.requestId);
        if (existing) return existing;

        const provisional = buildVerifiedApplication(authApi, verifiedStudent, examLevel);
        if (!provisional.requestId) return null;
        store?.upsertApplication?.(provisional);
        return store?.getApplicationByRequestId?.(provisional.requestId) || provisional;
    }

    function renderQuestions(container, questions) {
        container.innerHTML = questions.map((question, index) => `
            <section class="question">
                <div class="question-head-row">
                    <span class="question-index">السؤال ${index + 1}</span>
                    <span class="question-section">${question.section}</span>
                </div>
                <p>${question.q}</p>
                <div class="options-grid">
                    ${question.options.map((option, optionIndex) => `
                        <label>
                            <input type="radio" name="${question.id}" value="${option}" ${optionIndex === 0 ? '' : ''} />
                            <span>${option}</span>
                        </label>
                    `).join('')}
                </div>
            </section>
        `).join('');
    }

    function collectAnswers(form, questions) {
        return questions.map((question) => {
            const response = String(form.querySelector(`input[name="${question.id}"]:checked`)?.value || '').trim();
            const isCorrect = response === question.answer;
            return {
                question: question.q,
                section: question.section,
                response,
                correctAnswer: question.answer,
                isCorrect,
                type: question.type || 'mcq'
            };
        });
    }

    function evaluateAnswers(answers, questions) {
        const totalPoints = questions.reduce((sum, question) => sum + Number(question.points || 1), 0);
        const studentScore = answers.reduce((sum, answer, index) => (
            sum + (answer.isCorrect ? Number(questions[index]?.points || 1) : 0)
        ), 0);
        const percentage = totalPoints > 0 ? Math.round((studentScore / totalPoints) * 100) : 0;
        const passed = percentage >= PASS_PERCENTAGE;
        return { totalPoints, studentScore, percentage, passed };
    }

    function resolveStudentRewardUser(authApi, application, verifiedStudent) {
        const directEmail = authApi?.normalizeEmail?.(application.studentEmail || verifiedStudent.studentEmail || '');
        if (directEmail) return authApi.getUserByEmail?.(directEmail) || { email: directEmail };

        const byNationalId = application.nationalId || verifiedStudent.nationalId
            ? authApi?.getUserByNationalId?.(application.nationalId || verifiedStudent.nationalId)
            : null;
        if (byNationalId?.email) return byNationalId;

        const requestId = String(application.requestId || verifiedStudent.requestId || '').trim().toUpperCase();
        return authApi?.getAllUsers?.().find((user) => (
            String(user.requestId || user.applicationRequestId || '').trim().toUpperCase() === requestId
        )) || null;
    }

    async function grantPassReward(authApi, application, verifiedStudent, examAttempt) {
        if (!authApi?.updateUserPersistentData) {
            return { ok: false, message: 'واجهة المحفظة غير جاهزة.' };
        }

        const user = resolveStudentRewardUser(authApi, application, verifiedStudent);
        if (!user?.email) {
            return { ok: false, message: 'لم يتم العثور على حساب الطالب لإضافة المكافأة.' };
        }

        const current = authApi.getUserByEmail?.(user.email) || user;
        const nextBalance = Number(current.balance || 0) + PASS_REWARD_AMOUNT;
        const result = await authApi.updateUserPersistentData(user.email, {
            balance: nextBalance,
            lastExamRewardAt: examAttempt.date,
            lastExamRewardRequestId: examAttempt.requestId,
            lastExamRewardDateKey: examAttempt.examDateKey,
            lastExamRewardPercentage: examAttempt.percentage
        });

        if (result?.ok === false) return result;

        authApi.pushPrivateNotification?.(user.email, {
            id: `exam-pass-reward-${examAttempt.requestId}-${examAttempt.examDateKey}`,
            title: 'مكافأة نجاح الامتحان',
            body: `تمت إضافة ${PASS_REWARD_AMOUNT} EGP إلى محفظتك بعد اجتياز الامتحان بنسبة ${examAttempt.percentage}%.`,
            type: 'finance',
            displayMode: 'banner',
            actionUrl: './wallet.html',
            actionLabel: 'فتح المحفظة'
        });
        await authApi.syncNow?.();
        return { ok: true, amount: PASS_REWARD_AMOUNT, email: user.email, nextBalance };
    }

    async function saveUserExamSnapshot(authApi, application, verifiedStudent, examAttempt) {
        if (!authApi?.updateUserPersistentData) return { ok: false };

        const user = resolveStudentRewardUser(authApi, application, verifiedStudent);
        if (!user?.email) return { ok: false };

        const current = authApi.getUserByEmail?.(user.email) || user;
        const existingAttempts = Array.isArray(current.examAttempts) ? current.examAttempts : [];
        const attemptKey = `${examAttempt.requestId}-${examAttempt.examDateKey || examAttempt.date}`;
        const nextAttempts = [
            examAttempt,
            ...existingAttempts.filter((attempt) => (
                `${attempt?.requestId || ''}-${attempt?.examDateKey || attempt?.date || ''}` !== attemptKey
            ))
        ].slice(0, 80);

        return await authApi.updateUserPersistentData(user.email, {
            examAttempts: nextAttempts,
            lastExamAttempt: examAttempt,
            lastExamAttemptAt: examAttempt.date,
            lastExamAttemptRequestId: examAttempt.requestId,
            lastExamAttemptPercentage: examAttempt.percentage,
            lastExamAttemptPassed: examAttempt.passed
        });
    }

    function stopSubmitTimer() {
        if (submitTimerId) {
            clearInterval(submitTimerId);
            submitTimerId = null;
        }
    }

    function startSubmitTimer(startedAt, submitTimer, submitButton, timerBanner) {
        if (WAIT_TIME_SECONDS <= 0) {
            submitButton.disabled = false;
            submitButton.title = '';
            if (submitTimer) submitTimer.textContent = '00:00';
            if (timerBanner) {
                timerBanner.classList.add('timer-ready');
                timerBanner.innerHTML = '<i class="fas fa-check-circle"></i> الإرسال متاح الآن بعد الإجابة على الأسئلة.';
            }
            return;
        }

        const tick = () => {
            const canSubmitAt = startedAt + (WAIT_TIME_SECONDS * 1000);
            const remainingSeconds = Math.max(0, Math.ceil((canSubmitAt - Date.now()) / 1000));
            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = remainingSeconds % 60;

            if (submitTimer) {
                submitTimer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            }

            if (remainingSeconds === 0) {
                submitButton.disabled = false;
                submitButton.title = '';
                if (timerBanner) {
                    timerBanner.classList.add('timer-ready');
                    timerBanner.innerHTML = '<i class="fas fa-check-circle"></i> تم السماح الآن بإرسال الامتحان.';
                }
                stopSubmitTimer();
            }
        };

        submitButton.disabled = true;
        submitButton.title = 'لا يمكن الإرسال قبل انتهاء المؤقت المحدد.';
        tick();
        submitTimerId = window.setInterval(tick, 1000);
    }

    function initProctorBubble() {
        const bubble = document.createElement('div');
        bubble.className = 'proctor-bubble';
        bubble.id = 'proctor-bubble';
        bubble.innerHTML = `
            <div class="proctor-handle">
                <span><i class="fas fa-camera"></i> مراقبة</span>
                <span class="proctor-state" id="proctor-state">جارٍ التشغيل...</span>
            </div>
            <div class="proctor-video-wrap">
                <video id="proctor-video" autoplay muted playsinline></video>
                <div class="proctor-fallback" id="proctor-fallback">
                    <i class="fas fa-user-shield"></i>
                    <span>هذا الامتحان مراقب</span>
                </div>
            </div>
        `;

        document.body.appendChild(bubble);
        restoreBubblePosition(bubble);
        makeBubbleDraggable(bubble);
        void startCamera(bubble);
    }

    async function startCamera(bubble) {
        const state = bubble.querySelector('#proctor-state');
        const video = bubble.querySelector('#proctor-video');
        const fallback = bubble.querySelector('#proctor-fallback');

        if (!navigator.mediaDevices?.getUserMedia) {
            state.textContent = 'الكاميرا غير متاحة';
            bubble.classList.add('is-fallback');
            return;
        }

        try {
            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 240 },
                    height: { ideal: 240 }
                },
                audio: false
            });
            video.srcObject = cameraStream;
            video.style.display = 'block';
            fallback.style.display = 'none';
            state.textContent = 'المراقبة مفعلة';
            bubble.classList.add('is-live');
        } catch (error) {
            console.error('Camera access failed:', error);
            state.textContent = 'تعذر تشغيل الكاميرا';
            bubble.classList.add('is-fallback');
        }
    }

    function makeBubbleDraggable(bubble) {
        const handle = bubble.querySelector('.proctor-handle');
        let dragging = false;
        let offsetX = 0;
        let offsetY = 0;

        const onPointerMove = (event) => {
            if (!dragging) return;
            bubble.style.left = `${event.clientX - offsetX}px`;
            bubble.style.top = `${event.clientY - offsetY}px`;
            bubble.style.right = 'auto';
            bubble.style.bottom = 'auto';
        };

        const onPointerUp = () => {
            if (!dragging) return;
            dragging = false;
            bubble.classList.remove('dragging');
            localStorage.setItem(CAMERA_POSITION_KEY, JSON.stringify({
                left: bubble.style.left,
                top: bubble.style.top,
                right: bubble.style.right,
                bottom: bubble.style.bottom
            }));
        };

        handle.addEventListener('pointerdown', (event) => {
            dragging = true;
            bubble.classList.add('dragging');
            const rect = bubble.getBoundingClientRect();
            offsetX = event.clientX - rect.left;
            offsetY = event.clientY - rect.top;
            bubble.setPointerCapture?.(event.pointerId);
        });

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    }

    function restoreBubblePosition(bubble) {
        const saved = parseJson(localStorage.getItem(CAMERA_POSITION_KEY), null);
        if (!saved) return;
        if (saved.left) bubble.style.left = saved.left;
        if (saved.top) bubble.style.top = saved.top;
        if (saved.right) bubble.style.right = saved.right;
        if (saved.bottom) bubble.style.bottom = saved.bottom;
    }

    function stopCamera() {
        if (!cameraStream) return;
        cameraStream.getTracks().forEach((track) => track.stop());
        cameraStream = null;
    }

    document.addEventListener('DOMContentLoaded', async () => {
        const examWindowApi = window.QaryaExamWindow;
        const authApi = window.QaryaAuth || null;
        const store = window.QaryaPlatformStore || null;
        const telegramApi = window.QaryaTelegram || null;
        const verifiedStudent = getVerifiedStudent();
        const examLevel = document.body.dataset.examLevel;

        const resultDiv = document.getElementById('result');
        const form = document.getElementById('exam-form');
        const submitButton = document.getElementById('submit-btn');
        const questionsContainer = document.getElementById('questions');
        const submitTimer = document.getElementById('submit-timer');
        const timerBanner = document.getElementById('exam-timer-banner');
        const studentNameInput = document.getElementById('student-name');
        const requestIdInput = document.getElementById('request-id');
        const examDayInput = document.getElementById('exam-day');
        const deviceNotice = document.getElementById('device-lock-note');
        const proctorNote = document.getElementById('proctor-note');

        if (!verifiedStudent || !examWindowApi || !store || !form || !submitButton || !questionsContainer) {
            return;
        }

        submitButton.hidden = true;

        if (store.refreshFromRemote) {
            await store.refreshFromRemote({ force: true });
        }
        if (authApi?.refreshFromRemote) {
            await authApi.refreshFromRemote({ force: true });
        }

        const gateStatus = validateExamGate(verifiedStudent, examLevel);
        if (!gateStatus.ok) {
            blockExam(form, resultDiv, gateStatus.message);
            setTimeout(() => { window.location.href = 'exam-status.html'; }, 1400);
            return;
        }

        const selectedQuestions = getExamQuestions(examLevel);
        if (!selectedQuestions.length) {
            blockExam(form, resultDiv, 'لم يتم تحميل أسئلة الامتحان بشكل صحيح.');
            return;
        }

        const application = resolveApplicationForExam(store, authApi, verifiedStudent, examLevel);
        if (!application) {
            blockExam(form, resultDiv, 'تعذر تجهيز بيانات الطالب للامتحان. ادخل من بوابة الامتحان مرة أخرى.');
            return;
        }
        if (!sessionMatchesApplication(authApi, application)) {
            blockExam(form, resultDiv, 'هذا الحساب لا يملك صلاحية تقديم هذا الامتحان.');
            return;
        }
        const examBlockMessage = store.getStudentExamBlockMessage?.(application);
        if (examBlockMessage) {
            blockExam(form, resultDiv, examBlockMessage);
            return;
        }
        if (application.examAccess === 'blocked') {
            blockExam(form, resultDiv, application.examAccessReason || 'تم منع هذا الطلب من الامتحان.');
            return;
        }
        if (store.canStudentTakeExam && !store.canStudentTakeExam(application)) {
            blockExam(form, resultDiv, 'هذا الطلب غير مسموح له بدخول الامتحان حاليًا.');
            return;
        }
        if (hasAttemptedToday(store, verifiedStudent.requestId, examWindowApi.getEgyptNow())) {
            blockExam(form, resultDiv, 'تم استخدام محاولة هذا اليوم بالفعل. يمكنك العودة في يوم الامتحان التالي فقط.');
            return;
        }

        const lockStatus = ensureDeviceLock(verifiedStudent);
        if (!lockStatus.allowed) {
            blockExam(form, resultDiv, `هذا الجهاز مرتبط بالفعل بالطلب ${lockStatus.lock?.requestId || ''} ولا يقبل طالبًا آخر.`);
            return;
        }

        const currentState = examWindowApi.getExamWindowState(examWindowApi.getEgyptNow(), store.getPlatformSettings?.() || {});
        if (!currentState.open) {
            blockExam(form, resultDiv, currentState.statusText);
            setTimeout(() => { window.location.href = 'exam-status.html'; }, 1400);
            return;
        }

        if (deviceNotice) {
            deviceNotice.textContent = `هذا الجهاز مرتبط الآن بالطلب ${verifiedStudent.requestId} فقط.`;
        }
        if (proctorNote) {
            proctorNote.textContent = 'الكاميرا الصغيرة أمامك الآن لإظهار أن الامتحان مراقب ضد أي محاولة غش.';
        }

        renderQuestions(questionsContainer, selectedQuestions);
        if (!questionsContainer.children.length) {
            blockExam(form, resultDiv, 'لم تظهر أسئلة الامتحان. أعد تحميل الصفحة وحاول مرة أخرى.');
            return;
        }
        submitButton.hidden = false;
        initProctorBubble();

        studentNameInput.value = application.name || verifiedStudent.name || '';
        requestIdInput.value = verifiedStudent.requestId;
        studentNameInput.readOnly = true;
        requestIdInput.readOnly = true;

        const egyptNow = examWindowApi.getEgyptNow();
        const currentDay = examWindowApi.DAY_NAMES[egyptNow.getDay()];
        if (examDayInput && [...examDayInput.options].some((option) => option.value === currentDay)) {
            examDayInput.value = currentDay;
        }

        const runtime = getExamRuntime(verifiedStudent.requestId, examLevel) || { startedAt: Date.now() };
        setExamRuntime(verifiedStudent.requestId, examLevel, runtime);
        startSubmitTimer(runtime.startedAt, submitTimer, submitButton, timerBanner);

        stateMonitorId = window.setInterval(() => {
            const liveState = examWindowApi.getExamWindowState(examWindowApi.getEgyptNow(), store.getPlatformSettings?.() || {});
            if (!liveState.open) {
                stopSubmitTimer();
                blockExam(form, resultDiv, liveState.statusText);
            }
        }, 5000);

        form.addEventListener('submit', async (event) => {
            event.preventDefault();

            if (submitButton.disabled) {
                return;
            }

            if (store.refreshFromRemote) {
                await store.refreshFromRemote({ force: true });
            }

            const liveState = examWindowApi.getExamWindowState(examWindowApi.getEgyptNow(), store.getPlatformSettings?.() || {});
            if (!liveState.open) {
                blockExam(form, resultDiv, liveState.statusText);
                return;
            }

            if (hasAttemptedToday(store, verifiedStudent.requestId, examWindowApi.getEgyptNow())) {
                blockExam(form, resultDiv, 'تم تسجيل محاولة هذا اليوم بالفعل. لا يمكن إعادة الامتحان إلا في يوم الامتحان التالي.');
                return;
            }

            const answers = collectAnswers(form, selectedQuestions);
            const { totalPoints, studentScore, percentage, passed } = evaluateAnswers(answers, selectedQuestions);
            const attemptDate = new Date();
            let rewardResult = { ok: false };
            const examAttempt = {
                requestId: verifiedStudent.requestId,
                name: application.name || verifiedStudent.name,
                nationalId: application.nationalId || verifiedStudent.nationalId || '',
                studentEmail: application.studentEmail || verifiedStudent.studentEmail || '',
                leaderCode: verifiedStudent.leaderCode || application.leaderCode || '',
                governorate: application.governorate || '',
                city: application.city || '',
                village: application.village || '',
                age: application.age || '',
                gender: application.gender || '',
                examLevel,
                day: examDayInput?.value || '',
                score: studentScore,
                total: totalPoints,
                percentage,
                passed,
                date: attemptDate.toISOString(),
                examDateKey: getEgyptDateKey(attemptDate),
                approved: true,
                passThreshold: PASS_PERCENTAGE,
                rewardAmount: 0,
                rewardGrantedAt: '',
                rewardStatus: passed ? 'pending' : 'not_applicable',
                rewardEmail: '',
                walletBalanceAfter: null
            };

            if (passed) {
                rewardResult = await grantPassReward(authApi, application, verifiedStudent, examAttempt);
                if (rewardResult.ok) {
                    examAttempt.rewardAmount = PASS_REWARD_AMOUNT;
                    examAttempt.rewardGrantedAt = new Date().toISOString();
                    examAttempt.rewardStatus = 'granted';
                    examAttempt.rewardEmail = rewardResult.email || '';
                    examAttempt.walletBalanceAfter = rewardResult.nextBalance ?? null;
                } else {
                    examAttempt.rewardStatus = 'failed';
                }
            }

            try {
                await saveUserExamSnapshot(authApi, application, verifiedStudent, examAttempt);
            } catch (error) {
                console.error('Failed to save user exam snapshot:', error);
            }

            const history = store.getExamHistory ? store.getExamHistory() : [];
            store.saveExamHistory([examAttempt, ...history]);
            if (store.syncNow) {
                await store.syncNow();
            }

            try {
                await telegramApi?.sendExamSubmission?.({
                    ...examAttempt,
                    studentScore,
                    totalPoints,
                    answers
                });
            } catch (error) {
                console.error('Failed to send exam submission update:', error);
            }

            stopSubmitTimer();
            if (stateMonitorId) {
                clearInterval(stateMonitorId);
                stateMonitorId = null;
            }

            form.querySelectorAll('input, select, button').forEach((element) => {
                element.disabled = true;
            });

            resultDiv.style.display = 'block';
            resultDiv.className = `result ${passed ? 'pass' : 'fail'}`;
            const rewardText = passed
                ? (rewardResult.ok
                    ? `تم حفظ النتيجة وإضافة ${PASS_REWARD_AMOUNT} EGP إلى المحفظة.`
                    : 'تم حفظ النتيجة، لكن تعذر إضافة مكافأة المحفظة تلقائيًا.')
                : 'تم حفظ المحاولة داخل المنصة.';
            resultDiv.innerHTML = `
                <strong>${passed ? 'تم اجتياز الامتحان' : 'تم إرسال الامتحان'}</strong>
                <p>النتيجة النهائية: ${percentage}% من 100%.</p>
                <p>درجتك: ${studentScore} من ${totalPoints}.</p>
                <p>${rewardText}</p>
            `;

            clearExamRuntime(verifiedStudent.requestId, examLevel);
            sessionStorage.removeItem(EXAM_GATE_KEY);
        });
    });

    window.addEventListener('beforeunload', () => {
        stopSubmitTimer();
        stopCamera();
        if (stateMonitorId) {
            clearInterval(stateMonitorId);
        }
    });
})();
