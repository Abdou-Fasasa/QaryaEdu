(() => {
    const EXAM_GATE_KEY = 'qaryaeduExamGatePass';
    const DEVICE_LOCK_KEY = 'qaryaeduExamDeviceLock';
    const CAMERA_POSITION_KEY = 'qaryaeduProctorBubblePosition';
    const WAIT_TIME_SECONDS = 15 * 60;
    const GATE_TTL_MS = 30 * 60 * 1000;

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
        return sameEmail || sameNationalId;
    }

    function hasAttempted(store, requestId) {
        return Boolean(store?.getExamHistoryByRequestId?.(requestId)?.length);
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
        const passed = percentage >= 60;
        return { totalPoints, studentScore, percentage, passed };
    }

    function stopSubmitTimer() {
        if (submitTimerId) {
            clearInterval(submitTimerId);
            submitTimerId = null;
        }
    }

    function startSubmitTimer(startedAt, submitTimer, submitButton, timerBanner) {
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
        submitButton.title = 'لا يمكن الإرسال قبل مرور 15 دقيقة كاملة.';
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

        const questionKey = examLevel === 'senior' ? 'seniorQuestions' : 'juniorQuestions';
        const selectedQuestions = Array.isArray(window.QaryaQuestions?.[questionKey]) ? window.QaryaQuestions[questionKey] : [];
        if (!selectedQuestions.length) {
            blockExam(form, resultDiv, 'لم يتم تحميل أسئلة الامتحان بشكل صحيح.');
            return;
        }

        const application = store.getApplicationByRequestId?.(verifiedStudent.requestId);
        if (!application) {
            blockExam(form, resultDiv, 'الطلب غير موجود داخل بيانات المنصة الحالية.');
            return;
        }
        if (!sessionMatchesApplication(authApi, application)) {
            blockExam(form, resultDiv, 'هذا الحساب لا يملك صلاحية تقديم هذا الامتحان.');
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
        if (hasAttempted(store, verifiedStudent.requestId)) {
            blockExam(form, resultDiv, 'هذا الطلب استخدم فرصة الامتحان بالفعل.');
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

            if (hasAttempted(store, verifiedStudent.requestId)) {
                blockExam(form, resultDiv, 'تم تسجيل محاولة سابقة لهذا الطلب.');
                return;
            }

            const answers = collectAnswers(form, selectedQuestions);
            const { totalPoints, studentScore, percentage, passed } = evaluateAnswers(answers, selectedQuestions);
            const examAttempt = {
                requestId: verifiedStudent.requestId,
                name: application.name || verifiedStudent.name,
                nationalId: application.nationalId || verifiedStudent.nationalId || '',
                leaderCode: verifiedStudent.leaderCode || application.leaderCode || '',
                examLevel,
                day: examDayInput?.value || '',
                score: studentScore,
                total: totalPoints,
                percentage,
                passed,
                date: new Date().toISOString(),
                approved: true
            };

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
            resultDiv.innerHTML = `
                <strong>${passed ? 'تم اجتياز الامتحان' : 'تم إرسال الامتحان'}</strong>
                <p>النتيجة: ${studentScore} من ${totalPoints} (${percentage}%).</p>
                <p>${passed ? 'تم حفظ النتيجة بنجاح داخل المنصة.' : 'تم حفظ المحاولة داخل المنصة.'}</p>
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
