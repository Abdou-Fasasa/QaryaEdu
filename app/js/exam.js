document.addEventListener('DOMContentLoaded', () => {
    const LEADER_CODES = window.QaryaTelegram?.LEADER_CODES || ['Abdou200', 'Mohamed333', 'Reda456'];
    const EXAM_START_HOUR = 19;
    const EXAM_END_HOUR = 20;
    const EXAM_DAYS = [6, 0, 1];
    const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const DEVICE_LOCK_KEY = 'qaryaeduExamDeviceLock';
    const EXAM_HISTORY_KEY = 'qaryaeduExamHistory';
    const EXAM_GATE_KEY = 'qaryaeduExamGatePass';

    const messageBox = document.getElementById('app-message');
    const dateElement = document.getElementById('date');
    const clockElement = document.getElementById('clock');
    const countdownElement = document.getElementById('countdown');
    const examForm = document.getElementById('exam-form');
    const leaderCodeInput = document.getElementById('leader-code');
    const windowStatusElement = document.getElementById('window-status');
    const todayStatusElement = document.getElementById('today-status');
    const nextSlotElement = document.getElementById('next-slot');
    const examAccessNote = document.getElementById('exam-access-note');
    const windowStatusCard = windowStatusElement ? windowStatusElement.closest('.exam-pill') : null;
    const todayStatusCard = todayStatusElement ? todayStatusElement.closest('.exam-pill') : null;
    const deviceGuardNote = document.getElementById('device-guard-note');

    let messageTimeout;

    if (leaderCodeInput?.tagName === 'SELECT') {
        leaderCodeInput.innerHTML = LEADER_CODES.map((code) => `<option value="${code}">${code}</option>`).join('');
        leaderCodeInput.value = LEADER_CODES[0];
    }

    if (deviceGuardNote) {
        const lock = getDeviceLock();
        deviceGuardNote.textContent = lock
            ? `هذا الجهاز مرتبط حاليا بالطلب ${lock.requestId} فقط.`
            : 'عند دخول أول طالب من هذا الجهاز سيتم قفل الجهاز على نفس الطلب فقط.';
    }

    function showMessage(message, duration = 3400) {
        if (!messageBox) return;
        clearTimeout(messageTimeout);
        messageBox.textContent = message;
        messageBox.classList.add('show');
        messageTimeout = setTimeout(() => {
            messageBox.classList.remove('show');
        }, duration);
    }

    function parseJson(value, fallback) {
        try {
            return JSON.parse(value || '');
        } catch (error) {
            return fallback;
        }
    }

    function getDeviceLock() {
        return parseJson(localStorage.getItem(DEVICE_LOCK_KEY), null);
    }

    function hasAttempted(requestId) {
        const history = parseJson(localStorage.getItem(EXAM_HISTORY_KEY), []);
        return history.some((attempt) => attempt.requestId === requestId);
    }

    function storeDeviceLock(student, leaderCode) {
        const lock = {
            requestId: student.requestId,
            name: student.name,
            leaderCode,
            lockedAt: new Date().toISOString()
        };
        localStorage.setItem(DEVICE_LOCK_KEY, JSON.stringify(lock));
        return lock;
    }

    function getEgyptNow() {
        return new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
    }

    function getExamStart(date) {
        const examStart = new Date(date);
        examStart.setHours(EXAM_START_HOUR, 0, 0, 0);
        return examStart;
    }

    function getExamEnd(date) {
        const examEnd = new Date(date);
        examEnd.setHours(EXAM_END_HOUR, 0, 0, 0);
        return examEnd;
    }

    function isExamDay(date) {
        return EXAM_DAYS.includes(date.getDay());
    }

    function isExamOpen(date) {
        return isExamDay(date) && date >= getExamStart(date) && date < getExamEnd(date);
    }

    function getNextExamStart(date) {
        for (let i = 0; i <= 7; i += 1) {
            const candidate = new Date(date);
            candidate.setDate(candidate.getDate() + i);
            candidate.setHours(EXAM_START_HOUR, 0, 0, 0);
            if (isExamDay(candidate) && candidate > date) {
                return candidate;
            }
        }
        const fallback = new Date(date);
        fallback.setDate(fallback.getDate() + 1);
        fallback.setHours(EXAM_START_HOUR, 0, 0, 0);
        return fallback;
    }

    function formatCountdown(diff) {
        const totalSeconds = Math.max(0, Math.floor(diff / 1000));
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const parts = [];
        if (days > 0) parts.push(`${days} يوم`);
        parts.push(`${String(hours).padStart(2, '0')} ساعة`);
        parts.push(`${String(minutes).padStart(2, '0')} دقيقة`);
        parts.push(`${String(seconds).padStart(2, '0')} ثانية`);
        return parts.join('، ');
    }

    function formatNextSlot(date) {
        return `${DAY_NAMES[date.getDay()]} ${date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' })} - 07:00 مساءً`;
    }

    function togglePillState(card, isOpen) {
        if (!card) return;
        card.classList.toggle('is-open', isOpen);
        card.classList.toggle('is-muted', !isOpen);
    }

    function setStatusText(element, text) {
        if (element) element.textContent = text;
    }

    function updateTime() {
        const now = getEgyptNow();
        const examStartToday = getExamStart(now);
        const examEndToday = getExamEnd(now);
        const nextExamStart = getNextExamStart(now);

        if (dateElement) {
            dateElement.textContent = `التاريخ: ${now.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
        }
        if (clockElement) {
            clockElement.textContent = `الساعة الآن: ${now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} بتوقيت مصر`;
        }
        if (!countdownElement || !examForm) return;

        if (isExamOpen(now)) {
            countdownElement.textContent = `الامتحان مفتوح الآن. متبقٍ على الإغلاق: ${formatCountdown(examEndToday - now)}`;
            examForm.style.display = 'flex';
            setStatusText(windowStatusElement, 'مفتوح الآن');
            setStatusText(todayStatusElement, `نعم، ${DAY_NAMES[now.getDay()]}`);
            setStatusText(nextSlotElement, 'يغلق 08:00 مساءً');
            setStatusText(examAccessNote, 'الحقول متاحة الآن');
            togglePillState(windowStatusCard, true);
            togglePillState(todayStatusCard, true);
            return;
        }

        examForm.style.display = 'none';
        setStatusText(windowStatusElement, 'مغلق الآن');
        togglePillState(windowStatusCard, false);

        if (isExamDay(now) && now < examStartToday) {
            countdownElement.textContent = `متبقٍ على فتح امتحان اليوم: ${formatCountdown(examStartToday - now)}`;
            setStatusText(todayStatusElement, 'نعم، يبدأ 07:00 مساءً');
            setStatusText(nextSlotElement, formatNextSlot(examStartToday));
            setStatusText(examAccessNote, 'الحقول مخفية حتى يبدأ الامتحان');
            togglePillState(todayStatusCard, true);
            return;
        }

        if (isExamDay(now) && now >= examEndToday) {
            countdownElement.textContent = `انتهى امتحان اليوم. أقرب موعد: ${formatNextSlot(nextExamStart)}. المتبقي: ${formatCountdown(nextExamStart - now)}`;
            setStatusText(todayStatusElement, 'انتهى امتحان اليوم');
            setStatusText(nextSlotElement, formatNextSlot(nextExamStart));
            setStatusText(examAccessNote, 'الحقول مغلقة حتى الموعد التالي');
            togglePillState(todayStatusCard, true);
            return;
        }

        countdownElement.textContent = `لا يوجد امتحانات اليوم. أقرب امتحان: ${formatNextSlot(nextExamStart)}. المتبقي: ${formatCountdown(nextExamStart - now)}`;
        setStatusText(todayStatusElement, 'لا يوجد امتحانات اليوم');
        setStatusText(nextSlotElement, formatNextSlot(nextExamStart));
        setStatusText(examAccessNote, 'لا توجد حقول كتابة اليوم');
        togglePillState(todayStatusCard, false);
    }

    updateTime();
    setInterval(updateTime, 1000);

    if (examForm) {
        examForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const now = getEgyptNow();

            if (!isExamOpen(now)) {
                showMessage('الامتحان غير متاح الآن. تظهر الحقول فقط أثناء وقت الامتحان.');
                examForm.style.display = 'none';
                return;
            }

            const leaderCode = document.getElementById('leader-code').value.trim();
            const requestId = document.getElementById('request-id').value.trim();
            const age = Number(document.getElementById('age').value.trim());
            const applications = window.fixedApplications || [];
            const student = applications.find((app) => app.requestId === requestId);

            if (!student) {
                showMessage('رقم الطلب غير موجود في قاعدة البيانات الثابتة.');
                return;
            }
            if (student.age !== age) {
                showMessage('العمر المدخل لا يطابق العمر المسجل لهذا الطلب.');
                return;
            }
            if (student.status !== 'accepted') {
                showMessage('هذا الطلب غير مقبول حاليا، ولا يمكنه دخول الامتحان.');
                return;
            }
            if (hasAttempted(student.requestId)) {
                showMessage('هذا الطلب استخدم فرصة الامتحان بالفعل.');
                return;
            }

            const deviceLock = getDeviceLock();
            if (deviceLock && deviceLock.requestId !== student.requestId) {
                showMessage(`هذا الجهاز مرتبط بالفعل بالطلب ${deviceLock.requestId} ولا يسمح بامتحان طالب آخر عليه.`);
                return;
            }

            if (!deviceLock) {
                storeDeviceLock(student, leaderCode || student.leaderCode);
                if (deviceGuardNote) {
                    deviceGuardNote.textContent = `هذا الجهاز مرتبط حاليا بالطلب ${student.requestId} فقط.`;
                }
            }

            const examLevel = student.age >= 18 ? 'senior' : 'junior';
            sessionStorage.setItem('qarya_verified_student', JSON.stringify({
                requestId: student.requestId,
                age: student.age,
                nationalId: student.nationalId,
                leaderCode: leaderCode || student.leaderCode,
                name: student.name,
                timestamp: Date.now()
            }));
            sessionStorage.setItem(EXAM_GATE_KEY, JSON.stringify({
                requestId: student.requestId,
                examLevel,
                issuedAt: Date.now()
            }));

            window.location.href = examLevel === 'senior' ? 'examfull.html' : 'exam.html';
        });
    }
});
