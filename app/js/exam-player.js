(() => {
    const EXAM_HISTORY_KEY = 'qaryaeduExamHistory';
    const DEVICE_LOCK_KEY = 'qaryaeduExamDeviceLock';
    const CAMERA_POSITION_KEY = 'qaryaeduProctorBubblePosition';
    const EXAM_GATE_KEY = 'qaryaeduExamGatePass';
    const WAIT_TIME_SECONDS = 15 * 60;
    let cameraStream = null;
    let timerId = null;

    document.addEventListener('DOMContentLoaded', async () => {
        const store = window.QaryaPlatformStore || null;
        if (store?.refreshFromRemote) {
            await store.refreshFromRemote({ force: true });
        }
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
            blockExam(form, resultDiv, 'ÃƒËœÃ‚ÂªÃƒâ„¢Ã¢â‚¬Â¦ Ãƒâ„¢Ã¢â‚¬Â¦Ãƒâ„¢Ã¢â‚¬Â ÃƒËœÃ‚Â¹ Ãƒâ„¢Ã‚ÂÃƒËœÃ‚ÂªÃƒËœÃ‚Â­ ÃƒËœÃ‚ÂµÃƒâ„¢Ã‚ÂÃƒËœÃ‚Â­ÃƒËœÃ‚Â© ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚ÂªÃƒËœÃ‚Â­ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â  ÃƒËœÃ‚Â¨ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â±ÃƒËœÃ‚Â§ÃƒËœÃ‚Â¨ÃƒËœÃ‚Â· ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚Â¨ÃƒËœÃ‚Â§ÃƒËœÃ‚Â´ÃƒËœÃ‚Â±. Ãƒâ„¢Ã…Â ÃƒËœÃ‚Â¬ÃƒËœÃ‚Â¨ ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â¯ÃƒËœÃ‚Â®Ãƒâ„¢Ã‹â€ Ãƒâ„¢Ã¢â‚¬Å¾ Ãƒâ„¢Ã¢â‚¬Â¦Ãƒâ„¢Ã¢â‚¬Â  ÃƒËœÃ‚Â¨Ãƒâ„¢Ã‹â€ ÃƒËœÃ‚Â§ÃƒËœÃ‚Â¨ÃƒËœÃ‚Â© ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚ÂªÃƒËœÃ‚Â­ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â  ÃƒËœÃ‚Â¨ÃƒËœÃ‚Â¹ÃƒËœÃ‚Â¯ ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚ÂªÃƒËœÃ‚Â­Ãƒâ„¢Ã¢â‚¬Å¡Ãƒâ„¢Ã¢â‚¬Å¡ Ãƒâ„¢Ã¢â‚¬Â¦Ãƒâ„¢Ã¢â‚¬Â  ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â¨Ãƒâ„¢Ã…Â ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â ÃƒËœÃ‚Â§ÃƒËœÃ‚Âª.');
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

        const currentApplication = store?.getApplicationByRequestId ? store.getApplicationByRequestId(verifiedStudent.requestId) : null;
        if (!currentApplication) {
            blockExam(form, resultDiv, 'تم إيقاف هذا الطلب أو حذفه من المنصة، ولا يمكن متابعة الامتحان.');
            return;
        }

        if (currentApplication.examAccess === 'blocked') {
            blockExam(form, resultDiv, currentApplication.examAccessReason || 'هذا الطلب ممنوع من دخول الامتحان بقرار من الإدارة.');
            return;
        }

        if (store?.canStudentTakeExam && !store.canStudentTakeExam(currentApplication)) {
            blockExam(form, resultDiv, 'تم إيقاف صلاحية الامتحان لهذا الطلب حاليًا.');
            return;
        }

        const lockStatus = ensureDeviceLock(verifiedStudent);
        if (!lockStatus.allowed) {
            blockExam(form, resultDiv, `Ãƒâ„¢Ã¢â‚¬Â¡ÃƒËœÃ‚Â°ÃƒËœÃ‚Â§ ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â¬Ãƒâ„¢Ã¢â‚¬Â¡ÃƒËœÃ‚Â§ÃƒËœÃ‚Â² ÃƒËœÃ‚ÂªÃƒâ„¢Ã¢â‚¬Â¦ ÃƒËœÃ‚Â±ÃƒËœÃ‚Â¨ÃƒËœÃ‚Â·Ãƒâ„¢Ã¢â‚¬Â¡ ÃƒËœÃ‚Â³ÃƒËœÃ‚Â§ÃƒËœÃ‚Â¨Ãƒâ„¢Ã¢â‚¬Å¡ÃƒËœÃ‚Â§ ÃƒËœÃ‚Â¨ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â·ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â¨ ${lockStatus.lock?.name || ''} (${lockStatus.lock?.requestId || ''}) Ãƒâ„¢Ã‹â€ Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â§ Ãƒâ„¢Ã…Â Ãƒâ„¢Ã¢â‚¬Â¦Ãƒâ„¢Ã†â€™Ãƒâ„¢Ã¢â‚¬Â  ÃƒËœÃ‚Â§ÃƒËœÃ‚Â³ÃƒËœÃ‚ÂªÃƒËœÃ‚Â®ÃƒËœÃ‚Â¯ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â¦Ãƒâ„¢Ã¢â‚¬Â¡ Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â·Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â¨ ÃƒËœÃ‚Â¢ÃƒËœÃ‚Â®ÃƒËœÃ‚Â±.`);
            return;
        }

        if (hasAttempted(verifiedStudent.requestId)) {
            blockExam(form, resultDiv, 'ÃƒËœÃ‚ÂªÃƒâ„¢Ã¢â‚¬Â¦ ÃƒËœÃ‚Â§ÃƒËœÃ‚Â³ÃƒËœÃ‚ÂªÃƒËœÃ‚Â®ÃƒËœÃ‚Â¯ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â¦ Ãƒâ„¢Ã‚ÂÃƒËœÃ‚Â±ÃƒËœÃ‚ÂµÃƒËœÃ‚Â© ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚ÂªÃƒËœÃ‚Â­ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â  Ãƒâ„¢Ã¢â‚¬Å¾Ãƒâ„¢Ã¢â‚¬Â¡ÃƒËœÃ‚Â°ÃƒËœÃ‚Â§ ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â·Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â¨ ÃƒËœÃ‚Â¨ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾Ãƒâ„¢Ã‚ÂÃƒËœÃ‚Â¹Ãƒâ„¢Ã¢â‚¬Å¾ ÃƒËœÃ‚Â¹Ãƒâ„¢Ã¢â‚¬Å¾Ãƒâ„¢Ã¢â‚¬Â° Ãƒâ„¢Ã¢â‚¬Â¡ÃƒËœÃ‚Â°ÃƒËœÃ‚Â§ ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â¬Ãƒâ„¢Ã¢â‚¬Â¡ÃƒËœÃ‚Â§ÃƒËœÃ‚Â². Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â§ Ãƒâ„¢Ã…Â Ãƒâ„¢Ã¢â‚¬Â¦Ãƒâ„¢Ã†â€™Ãƒâ„¢Ã¢â‚¬Â  ÃƒËœÃ‚Â¥ÃƒËœÃ‚Â¹ÃƒËœÃ‚Â§ÃƒËœÃ‚Â¯ÃƒËœÃ‚Â© ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚ÂªÃƒËœÃ‚Â­ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â  Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚Â±ÃƒËœÃ‚Â© ÃƒËœÃ‚Â£ÃƒËœÃ‚Â®ÃƒËœÃ‚Â±Ãƒâ„¢Ã¢â‚¬Â°.');
            return;
        }

        if (deviceNotice) {
            deviceNotice.textContent = `Ãƒâ„¢Ã¢â‚¬Â¡ÃƒËœÃ‚Â°ÃƒËœÃ‚Â§ ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â¬Ãƒâ„¢Ã¢â‚¬Â¡ÃƒËœÃ‚Â§ÃƒËœÃ‚Â² Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚Â±ÃƒËœÃ‚ÂªÃƒËœÃ‚Â¨ÃƒËœÃ‚Â· ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â¢Ãƒâ„¢Ã¢â‚¬Â  ÃƒËœÃ‚Â¨ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â·Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â¨ ${verifiedStudent.requestId} Ãƒâ„¢Ã‚ÂÃƒâ„¢Ã¢â‚¬Å¡ÃƒËœÃ‚Â· ÃƒËœÃ‚Â·Ãƒâ„¢Ã‹â€ ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ ÃƒËœÃ‚Â¯Ãƒâ„¢Ã‹â€ ÃƒËœÃ‚Â±ÃƒËœÃ‚Â© ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚ÂªÃƒËœÃ‚Â­ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â .`;
        }

        if (proctorNote) {
            proctorNote.textContent = 'ÃƒËœÃ‚ÂªÃƒËœÃ‚Â¹Ãƒâ„¢Ã¢â‚¬Â¦Ãƒâ„¢Ã¢â‚¬Å¾ ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚Â±ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¡ÃƒËœÃ‚Â¨ÃƒËœÃ‚Â© ÃƒËœÃ‚Â¨ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾Ãƒâ„¢Ã†â€™ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â¦Ãƒâ„¢Ã…Â ÃƒËœÃ‚Â±ÃƒËœÃ‚Â§ ÃƒËœÃ‚Â£ÃƒËœÃ‚Â«Ãƒâ„¢Ã¢â‚¬Â ÃƒËœÃ‚Â§ÃƒËœÃ‚Â¡ ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚ÂªÃƒËœÃ‚Â­ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â ÃƒËœÃ…â€™ Ãƒâ„¢Ã‹â€ ÃƒËœÃ‚ÂªÃƒËœÃ‚Â¸Ãƒâ„¢Ã¢â‚¬Â¡ÃƒËœÃ‚Â± Ãƒâ„¢Ã¢â‚¬Å¾Ãƒâ„¢Ã†â€™ ÃƒËœÃ‚Â¯ÃƒËœÃ‚Â§ÃƒËœÃ‚Â¦ÃƒËœÃ‚Â±ÃƒËœÃ‚Â© Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚Â±ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¡ÃƒËœÃ‚Â¨ÃƒËœÃ‚Â© ÃƒËœÃ‚Â¹ÃƒËœÃ‚Â§ÃƒËœÃ‚Â¦Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚Â© ÃƒËœÃ‚Â¯ÃƒËœÃ‚Â§ÃƒËœÃ‚Â®Ãƒâ„¢Ã¢â‚¬Å¾ ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚ÂµÃƒâ„¢Ã‚ÂÃƒËœÃ‚Â­ÃƒËœÃ‚Â©.';
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

            if (store?.refreshFromRemote) {
                await store.refreshFromRemote({ force: true });
            }

            const liveApplication = store?.getApplicationByRequestId ? store.getApplicationByRequestId(verifiedStudent.requestId) : null;
            if (!liveApplication || (store?.canStudentTakeExam && !store.canStudentTakeExam(liveApplication))) {
                alert('تم سحب أو إيقاف صلاحية هذا الطلب قبل الإرسال.');
                blockExam(form, resultDiv, 'تم إيقاف صلاحية هذا الطلب قبل الإرسال بقرار من الإدارة.');
                return;
            }

            const freshLock = ensureDeviceLock(verifiedStudent);
            if (!freshLock.allowed) {
                alert('Ãƒâ„¢Ã¢â‚¬Â¡ÃƒËœÃ‚Â°ÃƒËœÃ‚Â§ ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â¬Ãƒâ„¢Ã¢â‚¬Â¡ÃƒËœÃ‚Â§ÃƒËœÃ‚Â² Ãƒâ„¢Ã¢â‚¬Â¦Ãƒâ„¢Ã¢â‚¬Å¡Ãƒâ„¢Ã‚ÂÃƒâ„¢Ã¢â‚¬Å¾ ÃƒËœÃ‚Â¨ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾Ãƒâ„¢Ã‚ÂÃƒËœÃ‚Â¹Ãƒâ„¢Ã¢â‚¬Å¾ Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â·Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â¨ ÃƒËœÃ‚Â¢ÃƒËœÃ‚Â®ÃƒËœÃ‚Â±ÃƒËœÃ…â€™ Ãƒâ„¢Ã‹â€ Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â§ Ãƒâ„¢Ã…Â Ãƒâ„¢Ã¢â‚¬Â¦Ãƒâ„¢Ã†â€™Ãƒâ„¢Ã¢â‚¬Â  Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚ÂªÃƒËœÃ‚Â§ÃƒËœÃ‚Â¨ÃƒËœÃ‚Â¹ÃƒËœÃ‚Â© ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â¥ÃƒËœÃ‚Â±ÃƒËœÃ‚Â³ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾.');
                blockExam(form, resultDiv, 'ÃƒËœÃ‚ÂªÃƒâ„¢Ã¢â‚¬Â¦ ÃƒËœÃ‚Â¥Ãƒâ„¢Ã…Â Ãƒâ„¢Ã¢â‚¬Å¡ÃƒËœÃ‚Â§Ãƒâ„¢Ã‚Â ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚ÂªÃƒËœÃ‚Â­ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â  Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â£Ãƒâ„¢Ã¢â‚¬Â  ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â¬Ãƒâ„¢Ã¢â‚¬Â¡ÃƒËœÃ‚Â§ÃƒËœÃ‚Â² Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚Â±ÃƒËœÃ‚ÂªÃƒËœÃ‚Â¨ÃƒËœÃ‚Â· ÃƒËœÃ‚Â¨ÃƒËœÃ‚Â·Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â¨ ÃƒËœÃ‚Â¢ÃƒËœÃ‚Â®ÃƒËœÃ‚Â±.');
                return;
            }

            if (hasAttempted(verifiedStudent.requestId)) {
                alert('ÃƒËœÃ‚ÂªÃƒâ„¢Ã¢â‚¬Â¦ ÃƒËœÃ‚ÂªÃƒËœÃ‚Â³ÃƒËœÃ‚Â¬Ãƒâ„¢Ã…Â Ãƒâ„¢Ã¢â‚¬Å¾ Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚Â­ÃƒËœÃ‚Â§Ãƒâ„¢Ã‹â€ Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â© ÃƒËœÃ‚Â³ÃƒËœÃ‚Â§ÃƒËœÃ‚Â¨Ãƒâ„¢Ã¢â‚¬Å¡ÃƒËœÃ‚Â© Ãƒâ„¢Ã¢â‚¬Å¾Ãƒâ„¢Ã¢â‚¬Â¡ÃƒËœÃ‚Â°ÃƒËœÃ‚Â§ ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â·Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â¨ÃƒËœÃ…â€™ Ãƒâ„¢Ã‹â€ Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â§ Ãƒâ„¢Ã…Â ÃƒËœÃ‚Â³Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚Â­ ÃƒËœÃ‚Â¨Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚Â­ÃƒËœÃ‚Â§Ãƒâ„¢Ã‹â€ Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â© ÃƒËœÃ‚Â¬ÃƒËœÃ‚Â¯Ãƒâ„¢Ã…Â ÃƒËœÃ‚Â¯ÃƒËœÃ‚Â©.');
                blockExam(form, resultDiv, 'ÃƒËœÃ‚ÂªÃƒâ„¢Ã¢â‚¬Â¦ ÃƒËœÃ‚Â§ÃƒËœÃ‚Â³ÃƒËœÃ‚ÂªÃƒËœÃ‚Â®ÃƒËœÃ‚Â¯ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â¦ Ãƒâ„¢Ã‚ÂÃƒËœÃ‚Â±ÃƒËœÃ‚ÂµÃƒËœÃ‚Â© ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚ÂªÃƒËœÃ‚Â­ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â  ÃƒËœÃ‚Â¨ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾Ãƒâ„¢Ã‚ÂÃƒËœÃ‚Â¹Ãƒâ„¢Ã¢â‚¬Å¾ Ãƒâ„¢Ã¢â‚¬Å¾Ãƒâ„¢Ã¢â‚¬Â¡ÃƒËœÃ‚Â°ÃƒËœÃ‚Â§ ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â·Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â¨.');
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
            if (window.QaryaPlatformStore?.saveExamHistory) {
                window.QaryaPlatformStore.saveExamHistory(history);
                window.QaryaPlatformStore.addNotification({
                    title: `ØªÙ… ØªØ³Ø¬ÙŠÙ„ Ù†ØªÙŠØ¬Ø© Ø§Ù…ØªØ­Ø§Ù† ${verifiedStudent.requestId}`,
                    body: `ØªÙ… Ø­ÙØ¸ Ù†ØªÙŠØ¬Ø© ${verifiedStudent.name} Ø¨Ù†Ø³Ø¨Ø© ${percentage}% Ø¯Ø§Ø®Ù„ Ø§Ù„Ù…Ù†ØµØ©.`,
                    type: 'exam',
                    actionUrl: './exam-results.html?requestId=' + encodeURIComponent(verifiedStudent.requestId),
                    actionLabel: 'Ø¹Ø±Ø¶ Ø§Ù„Ù†ØªÙŠØ¬Ø©'
                });
            } else {
                localStorage.setItem(EXAM_HISTORY_KEY, JSON.stringify(history));
            }

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
            alert('Ãƒâ„¢Ã…Â ÃƒËœÃ‚Â¬ÃƒËœÃ‚Â¨ ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚ÂªÃƒËœÃ‚Â­Ãƒâ„¢Ã¢â‚¬Å¡Ãƒâ„¢Ã¢â‚¬Å¡ Ãƒâ„¢Ã¢â‚¬Â¦Ãƒâ„¢Ã¢â‚¬Â  ÃƒËœÃ‚Â¨Ãƒâ„¢Ã…Â ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â ÃƒËœÃ‚Â§ÃƒËœÃ‚Âª ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â·ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â¨ ÃƒËœÃ‚Â£Ãƒâ„¢Ã‹â€ Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â§ Ãƒâ„¢Ã¢â‚¬Å¡ÃƒËœÃ‚Â¨Ãƒâ„¢Ã¢â‚¬Å¾ ÃƒËœÃ‚Â¯ÃƒËœÃ‚Â®Ãƒâ„¢Ã‹â€ Ãƒâ„¢Ã¢â‚¬Å¾ ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚ÂªÃƒËœÃ‚Â­ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â .');
            window.location.href = 'exam-status.html';
            return null;
        }

        if (Date.now() - Number(student.timestamp || 0) > 30 * 60 * 1000) {
            sessionStorage.removeItem('qarya_verified_student');
            sessionStorage.removeItem(EXAM_GATE_KEY);
            alert('ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â ÃƒËœÃ‚ÂªÃƒâ„¢Ã¢â‚¬Â¡ÃƒËœÃ‚Âª ÃƒËœÃ‚ÂµÃƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â§ÃƒËœÃ‚Â­Ãƒâ„¢Ã…Â ÃƒËœÃ‚Â© ÃƒËœÃ‚Â¬Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â³ÃƒËœÃ‚Â© ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â¯ÃƒËœÃ‚Â®Ãƒâ„¢Ã‹â€ Ãƒâ„¢Ã¢â‚¬Å¾ ÃƒËœÃ‚Â¥Ãƒâ„¢Ã¢â‚¬Å¾Ãƒâ„¢Ã¢â‚¬Â° ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚ÂªÃƒËœÃ‚Â­ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â . ÃƒËœÃ‚Â£ÃƒËœÃ‚Â¹ÃƒËœÃ‚Â¯ ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â¯ÃƒËœÃ‚Â®Ãƒâ„¢Ã‹â€ Ãƒâ„¢Ã¢â‚¬Å¾ Ãƒâ„¢Ã¢â‚¬Â¦Ãƒâ„¢Ã¢â‚¬Â  ÃƒËœÃ‚Â¨Ãƒâ„¢Ã‹â€ ÃƒËœÃ‚Â§ÃƒËœÃ‚Â¨ÃƒËœÃ‚Â© ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚ÂªÃƒËœÃ‚Â­ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â .');
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
        if (window.QaryaPlatformStore?.getExamHistoryByRequestId) {
            return window.QaryaPlatformStore.getExamHistoryByRequestId(requestId).length > 0;
        }
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
        const allowedDays = ['ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â³ÃƒËœÃ‚Â¨ÃƒËœÃ‚Âª', 'ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â£ÃƒËœÃ‚Â­ÃƒËœÃ‚Â¯', 'ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â§ÃƒËœÃ‚Â«Ãƒâ„¢Ã¢â‚¬Â Ãƒâ„¢Ã…Â Ãƒâ„¢Ã¢â‚¬Â '];
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
                    <span class="question-index">ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â³ÃƒËœÃ‚Â¤ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ ${index + 1}</span>
                    <span class="question-section">${question.section}</span>
                </div>
                <p>(${question.points} Ãƒâ„¢Ã¢â‚¬Â Ãƒâ„¢Ã¢â‚¬Å¡ÃƒËœÃ‚Â§ÃƒËœÃ‚Â·) ${question.q}</p>
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
        submitBtn.title = 'Ãƒâ„¢Ã…Â ÃƒËœÃ‚Â¬ÃƒËœÃ‚Â¨ ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â ÃƒËœÃ‚ÂªÃƒËœÃ‚Â¸ÃƒËœÃ‚Â§ÃƒËœÃ‚Â± 15 ÃƒËœÃ‚Â¯Ãƒâ„¢Ã¢â‚¬Å¡Ãƒâ„¢Ã…Â Ãƒâ„¢Ã¢â‚¬Å¡ÃƒËœÃ‚Â© Ãƒâ„¢Ã†â€™ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â¦Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â© Ãƒâ„¢Ã¢â‚¬Å¡ÃƒËœÃ‚Â¨Ãƒâ„¢Ã¢â‚¬Å¾ ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â¥ÃƒËœÃ‚Â±ÃƒËœÃ‚Â³ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾';

        timerId = setInterval(() => {
            const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
            const remainingSeconds = Math.max(0, WAIT_TIME_SECONDS - elapsedSeconds);
            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = remainingSeconds % 60;
            submitTimer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

            if (remainingSeconds === 0) {
                submitBtn.disabled = false;
                submitBtn.title = 'Ãƒâ„¢Ã…Â Ãƒâ„¢Ã¢â‚¬Â¦Ãƒâ„¢Ã†â€™Ãƒâ„¢Ã¢â‚¬Â Ãƒâ„¢Ã†â€™ ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â¥ÃƒËœÃ‚Â±ÃƒËœÃ‚Â³ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â¢Ãƒâ„¢Ã¢â‚¬Â ';
                timerBanner.classList.add('timer-ready');
                timerBanner.innerHTML = '<i class="fas fa-check-circle"></i> Ãƒâ„¢Ã…Â Ãƒâ„¢Ã¢â‚¬Â¦Ãƒâ„¢Ã†â€™Ãƒâ„¢Ã¢â‚¬Â Ãƒâ„¢Ã†â€™ ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â¢Ãƒâ„¢Ã¢â‚¬Â  ÃƒËœÃ‚Â¥ÃƒËœÃ‚Â±ÃƒËœÃ‚Â³ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚ÂªÃƒËœÃ‚Â­ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â  ÃƒËœÃ‚Â¨ÃƒËœÃ‚Â¹ÃƒËœÃ‚Â¯ Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚Â±ÃƒËœÃ‚Â§ÃƒËœÃ‚Â¬ÃƒËœÃ‚Â¹ÃƒËœÃ‚Â© ÃƒËœÃ‚Â¬Ãƒâ„¢Ã¢â‚¬Â¦Ãƒâ„¢Ã…Â ÃƒËœÃ‚Â¹ ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â¥ÃƒËœÃ‚Â¬ÃƒËœÃ‚Â§ÃƒËœÃ‚Â¨ÃƒËœÃ‚Â§ÃƒËœÃ‚Âª ÃƒËœÃ‚Â¨ÃƒËœÃ‚Â¹Ãƒâ„¢Ã¢â‚¬Â ÃƒËœÃ‚Â§Ãƒâ„¢Ã…Â ÃƒËœÃ‚Â©.';
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
            <strong>${passed ? 'ÃƒËœÃ‚ÂªÃƒâ„¢Ã¢â‚¬Â¦ ÃƒËœÃ‚Â¥ÃƒËœÃ‚Â±ÃƒËœÃ‚Â³ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚ÂªÃƒËœÃ‚Â­ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â  ÃƒËœÃ‚Â¨Ãƒâ„¢Ã¢â‚¬Â ÃƒËœÃ‚Â¬ÃƒËœÃ‚Â§ÃƒËœÃ‚Â­' : 'ÃƒËœÃ‚ÂªÃƒâ„¢Ã¢â‚¬Â¦ ÃƒËœÃ‚Â¥ÃƒËœÃ‚Â±ÃƒËœÃ‚Â³ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚ÂªÃƒËœÃ‚Â­ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â '}</strong>
            <p>ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾Ãƒâ„¢Ã¢â‚¬Â ÃƒËœÃ‚ÂªÃƒâ„¢Ã…Â ÃƒËœÃ‚Â¬ÃƒËœÃ‚Â©: ${score} Ãƒâ„¢Ã¢â‚¬Â¦Ãƒâ„¢Ã¢â‚¬Â  ${total} Ãƒâ„¢Ã¢â‚¬Â Ãƒâ„¢Ã¢â‚¬Å¡ÃƒËœÃ‚Â·ÃƒËœÃ‚Â© (${percentage}%).</p>
            <p>${passed ? 'ÃƒËœÃ‚ÂªÃƒâ„¢Ã¢â‚¬Â¦ ÃƒËœÃ‚Â§ÃƒËœÃ‚Â¬ÃƒËœÃ‚ÂªÃƒâ„¢Ã…Â ÃƒËœÃ‚Â§ÃƒËœÃ‚Â² ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚ÂªÃƒËœÃ‚Â­ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â  ÃƒËœÃ‚Â­ÃƒËœÃ‚Â³ÃƒËœÃ‚Â¨ ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾Ãƒâ„¢Ã¢â‚¬Â ÃƒËœÃ‚Â³ÃƒËœÃ‚Â¨ÃƒËœÃ‚Â© ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â­ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾Ãƒâ„¢Ã…Â ÃƒËœÃ‚Â©.' : 'ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾Ãƒâ„¢Ã¢â‚¬Â ÃƒËœÃ‚ÂªÃƒâ„¢Ã…Â ÃƒËœÃ‚Â¬ÃƒËœÃ‚Â© ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â­ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾Ãƒâ„¢Ã…Â ÃƒËœÃ‚Â© ÃƒËœÃ‚Â£Ãƒâ„¢Ã¢â‚¬Å¡Ãƒâ„¢Ã¢â‚¬Å¾ Ãƒâ„¢Ã¢â‚¬Â¦Ãƒâ„¢Ã¢â‚¬Â  Ãƒâ„¢Ã¢â‚¬Â ÃƒËœÃ‚Â³ÃƒËœÃ‚Â¨ÃƒËœÃ‚Â© ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â§ÃƒËœÃ‚Â¬ÃƒËœÃ‚ÂªÃƒâ„¢Ã…Â ÃƒËœÃ‚Â§ÃƒËœÃ‚Â² ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚Â·Ãƒâ„¢Ã¢â‚¬Å¾Ãƒâ„¢Ã‹â€ ÃƒËœÃ‚Â¨ÃƒËœÃ‚Â©.'}</p>
            <p>Ãƒâ„¢Ã¢â‚¬Â Ãƒâ„¢Ã‹â€ ÃƒËœÃ‚Â¹ ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚ÂªÃƒËœÃ‚Â­ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â : ${examLevel === 'senior' ? 'ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚ÂªÃƒËœÃ‚Â­ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â  Ãƒâ„¢Ã†â€™ÃƒËœÃ‚Â¨Ãƒâ„¢Ã…Â ÃƒËœÃ‚Â± Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚ÂªÃƒâ„¢Ã¢â‚¬Å¡ÃƒËœÃ‚Â¯Ãƒâ„¢Ã¢â‚¬Â¦' : 'ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚ÂªÃƒËœÃ‚Â­ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â  ÃƒËœÃ‚Â·Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â§ÃƒËœÃ‚Â¨ Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚ÂªÃƒâ„¢Ã¢â‚¬Å¡ÃƒËœÃ‚Â¯Ãƒâ„¢Ã¢â‚¬Â¦'}.</p>
        `;
    }

    function blockExam(form, resultDiv, message) {
        form.querySelectorAll('input, select, button').forEach((element) => {
            element.disabled = true;
        });
        resultDiv.style.display = 'block';
        resultDiv.className = 'result fail';
        resultDiv.innerHTML = `<strong>ÃƒËœÃ‚ÂªÃƒâ„¢Ã¢â‚¬Â¦ ÃƒËœÃ‚Â¥Ãƒâ„¢Ã…Â Ãƒâ„¢Ã¢â‚¬Å¡ÃƒËœÃ‚Â§Ãƒâ„¢Ã‚Â ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â¯ÃƒËœÃ‚Â®Ãƒâ„¢Ã‹â€ Ãƒâ„¢Ã¢â‚¬Å¾</strong><p>${message}</p>`;
    }

    function initProctorBubble() {
        const bubble = document.createElement('div');
        bubble.className = 'proctor-bubble';
        bubble.id = 'proctor-bubble';
        bubble.innerHTML = `
            <div class="proctor-handle">
                <span><i class="fas fa-camera"></i> Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚Â±ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¡ÃƒËœÃ‚Â¨ÃƒËœÃ‚Â© Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚Â¨ÃƒËœÃ‚Â§ÃƒËœÃ‚Â´ÃƒËœÃ‚Â±ÃƒËœÃ‚Â©</span>
                <span class="proctor-state" id="proctor-state">ÃƒËœÃ‚Â¬ÃƒËœÃ‚Â§ÃƒËœÃ‚Â±Ãƒâ„¢Ã‚Â ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚ÂªÃƒËœÃ‚Â´ÃƒËœÃ‚ÂºÃƒâ„¢Ã…Â Ãƒâ„¢Ã¢â‚¬Å¾...</span>
            </div>
            <div class="proctor-video-wrap">
                <video id="proctor-video" autoplay muted playsinline></video>
                <div class="proctor-fallback" id="proctor-fallback">
                    <i class="fas fa-user-shield"></i>
                    <span>ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â·ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â¨ ÃƒËœÃ‚ÂªÃƒËœÃ‚Â­ÃƒËœÃ‚Âª ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚Â±ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¡ÃƒËœÃ‚Â¨ÃƒËœÃ‚Â©</span>
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
            state.textContent = 'Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â§ Ãƒâ„¢Ã…Â ÃƒËœÃ‚Â¯ÃƒËœÃ‚Â¹Ãƒâ„¢Ã¢â‚¬Â¦ ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚ÂªÃƒËœÃ‚ÂµÃƒâ„¢Ã‚ÂÃƒËœÃ‚Â­ ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾Ãƒâ„¢Ã†â€™ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â¦Ãƒâ„¢Ã…Â ÃƒËœÃ‚Â±ÃƒËœÃ‚Â§';
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
            state.textContent = 'ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚Â±ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¡ÃƒËœÃ‚Â¨ÃƒËœÃ‚Â© Ãƒâ„¢Ã¢â‚¬Â¦Ãƒâ„¢Ã‚ÂÃƒËœÃ‚Â¹Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â©';
            bubble.classList.add('is-live');
        } catch (error) {
            console.error('Camera access failed:', error);
            state.textContent = 'ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾Ãƒâ„¢Ã†â€™ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â¦Ãƒâ„¢Ã…Â ÃƒËœÃ‚Â±ÃƒËœÃ‚Â§ ÃƒËœÃ‚ÂºÃƒâ„¢Ã…Â ÃƒËœÃ‚Â± Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚ÂªÃƒËœÃ‚Â§ÃƒËœÃ‚Â­ÃƒËœÃ‚Â©';
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
