(() => {
    const EXAM_HISTORY_KEY = 'qaryaeduExamHistory';
    const DEVICE_LOCK_KEY = 'qaryaeduExamDeviceLock';
    const CAMERA_POSITION_KEY = 'qaryaeduProctorBubblePosition';
    const EXAM_GATE_KEY = 'qaryaeduExamGatePass';
    const WAIT_TIME_SECONDS = 15 * 60;
    let cameraStream = null;
    let timerId = null;

    document.addEventListener('DOMContentLoaded', () => {
        const examLevel = document.body.dataset.examLevel;
        const questionKey = examLevel === 'senior' ? 'seniorQuestions' : 'juniorQuestions';
        const selectedQuestions = Array.isArray(window.QaryaQuestions?.[questionKey]) ? window.QaryaQuestions[questionKey] : [];
        const verifiedStudent = getVerifiedStudent();
        const resultDiv = document.getElementById('result');
        const form = document.getElementById('exam-form');
        const submitBtn = document.getElementById('submit-btn');
        const questionsContainer = document.getElementById('questions');
        const submitTimer = document.getElementById('submit-timer');
        const timerBanner = document.getElementById('exam-timer-banner');
        const studentNameInput = document.getElementById('student-name');
        const requestIdInput = document.getElementById('request-id');
        const examDayInput = document.getElementById('exam-day');
        const deviceNotice = document.getElementById('device-lock-note');
        const proctorNote = document.getElementById('proctor-note');

        if (!form || !submitBtn || !questionsContainer || !verifiedStudent || !selectedQuestions.length) {
            return;
        }

        const gateStatus = validateExamGate(verifiedStudent, examLevel);
        if (!gateStatus.ok) {
            sessionStorage.removeItem('qarya_verified_student');
            blockExam(form, resultDiv, 'تم منع فتح صفحة الامتحان بالرابط المباشر. يجب الدخول من بوابة الامتحان بعد التحقق من البيانات.');
            setTimeout(() => {
                window.location.href = 'exam-status.html';
            }, 1200);
            return;
        }

        if (examLevel === 'junior' && verifiedStudent.age >= 18) {
            window.location.href = 'examfull.html';
            return;
        }

        if (examLevel === 'senior' && verifiedStudent.age < 18) {
            window.location.href = 'exam.html';
            return;
        }

        const lockStatus = ensureDeviceLock(verifiedStudent);
        if (!lockStatus.allowed) {
            blockExam(form, resultDiv, `هذا الجهاز تم ربطه سابقا بالطالب ${lockStatus.lock?.name || ''} (${lockStatus.lock?.requestId || ''}) ولا يمكن استخدامه لطلب آخر.`);
            return;
        }

        if (hasAttempted(verifiedStudent.requestId)) {
            blockExam(form, resultDiv, 'تم استخدام فرصة الامتحان لهذا الطلب بالفعل على هذا الجهاز. لا يمكن إعادة الامتحان مرة أخرى.');
            return;
        }

        if (deviceNotice) {
            deviceNotice.textContent = `هذا الجهاز مرتبط الآن بالطلب ${verifiedStudent.requestId} فقط طوال دورة الامتحان.`;
        }

        if (proctorNote) {
            proctorNote.textContent = 'تعمل المراقبة بالكاميرا أثناء الامتحان، وتظهر لك دائرة مراقبة عائمة داخل الصفحة.';
        }

        prefillStudentData(verifiedStudent, studentNameInput, requestIdInput, examDayInput);
        renderQuestions(selectedQuestions, questionsContainer);
        startCountdown(submitBtn, submitTimer, timerBanner);
        initProctorBubble();

        form.addEventListener('submit', async (event) => {
            event.preventDefault();

            if (!canSubmit()) {
                alert('لا يمكن إرسال الامتحان قبل مرور 15 دقيقة كاملة من بدء الدخول.');
                return;
            }

            const freshLock = ensureDeviceLock(verifiedStudent);
            if (!freshLock.allowed) {
                alert('هذا الجهاز مقفل بالفعل لطلب آخر، ولا يمكن متابعة الإرسال.');
                blockExam(form, resultDiv, 'تم إيقاف الامتحان لأن الجهاز مرتبط بطلب آخر.');
                return;
            }

            if (hasAttempted(verifiedStudent.requestId)) {
                alert('تم تسجيل محاولة سابقة لهذا الطلب، ولا يسمح بمحاولة جديدة.');
                blockExam(form, resultDiv, 'تم استخدام فرصة الامتحان بالفعل لهذا الطلب.');
                return;
            }

            const formData = new FormData(form);
            const examDay = examDayInput.value;
            const answers = [];
            let studentScore = 0;
            let totalPoints = 0;

            selectedQuestions.forEach((question, index) => {
                const response = formData.get(`q${index}`) || '';
                const isCorrect = response === question.answer;
                totalPoints += question.points;
                if (isCorrect) {
                    studentScore += question.points;
                }

                answers.push({
                    section: question.section,
                    question: question.q,
                    response,
                    correctAnswer: question.answer,
                    isCorrect,
                    type: question.type
                });
            });

            const percentage = Math.round((studentScore / totalPoints) * 100);
            const passed = percentage >= 50;
            const history = parseJson(localStorage.getItem(EXAM_HISTORY_KEY), []);
            history.push({
                requestId: verifiedStudent.requestId,
                name: verifiedStudent.name,
                leaderCode: verifiedStudent.leaderCode,
                examLevel,
                score: studentScore,
                total: totalPoints,
                percentage,
                passed,
                date: new Date().toISOString(),
                deviceLockRequestId: freshLock.lock?.requestId || verifiedStudent.requestId
            });
            localStorage.setItem(EXAM_HISTORY_KEY, JSON.stringify(history));

            showResult(resultDiv, studentScore, totalPoints, percentage, passed, examLevel);
            form.querySelectorAll('input, select, button').forEach((element) => {
                element.disabled = true;
            });
            sessionStorage.removeItem('qarya_verified_student');
            sessionStorage.removeItem(EXAM_GATE_KEY);

            try {
                if (window.QaryaTelegram?.sendExamSubmission) {
                    await window.QaryaTelegram.sendExamSubmission({
                        name: verifiedStudent.name,
                        requestId: verifiedStudent.requestId,
                        nationalId: verifiedStudent.nationalId,
                        leaderCode: verifiedStudent.leaderCode,
                        examLevel,
                        day: examDay,
                        studentScore,
                        totalPoints,
                        percentage,
                        passed,
                        answers
                    });
                }
            } catch (error) {
                console.error('Exam submission sync failed:', error);
            }
        });
    });

    window.addEventListener('beforeunload', () => {
        if (cameraStream) {
            cameraStream.getTracks().forEach((track) => track.stop());
        }
        if (timerId) {
            clearInterval(timerId);
        }
    });

    function parseJson(value, fallback) {
        try {
            return JSON.parse(value || '');
        } catch (error) {
            return fallback;
        }
    }

    function getVerifiedStudent() {
        const student = parseJson(sessionStorage.getItem('qarya_verified_student'), null);
        if (!student) {
            alert('يجب التحقق من بيانات الطالب أولا قبل دخول الامتحان.');
            window.location.href = 'exam-status.html';
            return null;
        }

        if (Date.now() - Number(student.timestamp || 0) > 30 * 60 * 1000) {
            sessionStorage.removeItem('qarya_verified_student');
            sessionStorage.removeItem(EXAM_GATE_KEY);
            alert('انتهت صلاحية جلسة الدخول إلى الامتحان. أعد الدخول من بوابة الامتحان.');
            window.location.href = 'exam-status.html';
            return null;
        }

        return student;
    }

    function validateExamGate(student, examLevel) {
        const gate = parseJson(sessionStorage.getItem(EXAM_GATE_KEY), null);
        if (!gate) {
            return { ok: false };
        }

        if (gate.requestId !== student.requestId) {
            return { ok: false };
        }

        if (gate.examLevel !== examLevel) {
            return { ok: false };
        }

        if (Date.now() - Number(gate.issuedAt || 0) > 30 * 60 * 1000) {
            sessionStorage.removeItem(EXAM_GATE_KEY);
            return { ok: false };
        }

        return { ok: true };
    }

    function getDeviceLock() {
        return parseJson(localStorage.getItem(DEVICE_LOCK_KEY), null);
    }

    function ensureDeviceLock(student) {
        const existingLock = getDeviceLock();
        if (existingLock && existingLock.requestId !== student.requestId) {
            return { allowed: false, lock: existingLock };
        }

        if (!existingLock) {
            const newLock = {
                requestId: student.requestId,
                name: student.name,
                leaderCode: student.leaderCode,
                lockedAt: new Date().toISOString()
            };
            localStorage.setItem(DEVICE_LOCK_KEY, JSON.stringify(newLock));
            return { allowed: true, lock: newLock };
        }

        return { allowed: true, lock: existingLock };
    }

    function hasAttempted(requestId) {
        const history = parseJson(localStorage.getItem(EXAM_HISTORY_KEY), []);
        return history.some((attempt) => attempt.requestId === requestId);
    }

    function prefillStudentData(student, studentNameInput, requestIdInput, examDayInput) {
        studentNameInput.value = student.name;
        requestIdInput.value = student.requestId;
        studentNameInput.readOnly = true;
        requestIdInput.readOnly = true;
        studentNameInput.style.backgroundColor = '#f3f4f6';
        requestIdInput.style.backgroundColor = '#f3f4f6';

        const dayName = new Date().toLocaleDateString('ar-EG', { weekday: 'long' });
        const allowedDays = ['السبت', 'الأحد', 'الاثنين'];
        if (allowedDays.includes(dayName)) {
            examDayInput.value = dayName;
        }
    }

    function renderQuestions(questions, questionsContainer) {
        questionsContainer.innerHTML = '';
        questions.forEach((question, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'question';
            wrapper.innerHTML = `
                <div class="question-head-row">
                    <span class="question-index">السؤال ${index + 1}</span>
                    <span class="question-section">${question.section}</span>
                </div>
                <p>(${question.points} نقاط) ${question.q}</p>
            `;

            const optionsGrid = document.createElement('div');
            optionsGrid.className = 'options-grid';
            question.options.forEach((option) => {
                const label = document.createElement('label');
                const input = document.createElement('input');
                input.type = 'radio';
                input.name = `q${index}`;
                input.value = option;
                input.required = true;
                label.appendChild(input);
                label.appendChild(document.createTextNode(` ${option}`));
                optionsGrid.appendChild(label);
            });

            wrapper.appendChild(optionsGrid);
            questionsContainer.appendChild(wrapper);
        });
    }

    function startCountdown(submitBtn, submitTimer, timerBanner) {
        const startTime = Date.now();
        submitBtn.disabled = true;
        submitBtn.title = 'يجب الانتظار 15 دقيقة كاملة قبل الإرسال';

        timerId = setInterval(() => {
            const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
            const remainingSeconds = Math.max(0, WAIT_TIME_SECONDS - elapsedSeconds);
            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = remainingSeconds % 60;
            submitTimer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

            if (remainingSeconds === 0) {
                submitBtn.disabled = false;
                submitBtn.title = 'يمكنك الإرسال الآن';
                timerBanner.classList.add('timer-ready');
                timerBanner.innerHTML = '<i class="fas fa-check-circle"></i> يمكنك الآن إرسال الامتحان بعد مراجعة جميع الإجابات بعناية.';
                clearInterval(timerId);
                timerId = null;
            }
        }, 1000);

        window.__qaryaCanSubmitAt = startTime + WAIT_TIME_SECONDS * 1000;
    }

    function canSubmit() {
        return Date.now() >= Number(window.__qaryaCanSubmitAt || 0);
    }

    function showResult(resultDiv, score, total, percentage, passed, examLevel) {
        resultDiv.style.display = 'block';
        resultDiv.className = `result ${passed ? 'pass' : 'fail'}`;
        resultDiv.innerHTML = `
            <strong>${passed ? 'تم إرسال الامتحان بنجاح' : 'تم إرسال الامتحان'}</strong>
            <p>النتيجة: ${score} من ${total} نقطة (${percentage}%).</p>
            <p>${passed ? 'تم اجتياز الامتحان حسب النسبة الحالية.' : 'النتيجة الحالية أقل من نسبة الاجتياز المطلوبة.'}</p>
            <p>نوع الامتحان: ${examLevel === 'senior' ? 'امتحان كبير متقدم' : 'امتحان طلاب متقدم'}.</p>
        `;
    }

    function blockExam(form, resultDiv, message) {
        form.querySelectorAll('input, select, button').forEach((element) => {
            element.disabled = true;
        });
        resultDiv.style.display = 'block';
        resultDiv.className = 'result fail';
        resultDiv.innerHTML = `<strong>تم إيقاف الدخول</strong><p>${message}</p>`;
    }

    function initProctorBubble() {
        const bubble = document.createElement('div');
        bubble.className = 'proctor-bubble';
        bubble.id = 'proctor-bubble';
        bubble.innerHTML = `
            <div class="proctor-handle">
                <span><i class="fas fa-camera"></i> مراقبة مباشرة</span>
                <span class="proctor-state" id="proctor-state">جارٍ التشغيل...</span>
            </div>
            <div class="proctor-video-wrap">
                <video id="proctor-video" autoplay muted playsinline></video>
                <div class="proctor-fallback" id="proctor-fallback">
                    <i class="fas fa-user-shield"></i>
                    <span>الطالب تحت المراقبة</span>
                </div>
            </div>
        `;
        document.body.appendChild(bubble);
        restoreBubblePosition(bubble);
        makeBubbleDraggable(bubble);
        startCamera(bubble);
    }

    async function startCamera(bubble) {
        const state = bubble.querySelector('#proctor-state');
        const video = bubble.querySelector('#proctor-video');
        const fallback = bubble.querySelector('#proctor-fallback');

        if (!navigator.mediaDevices?.getUserMedia) {
            state.textContent = 'لا يدعم المتصفح الكاميرا';
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
            state.textContent = 'الكاميرا غير متاحة';
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
})();
