document.addEventListener('DOMContentLoaded', async () => {
    const examWindowApi = window.QaryaExamWindow;
    const authApi = window.QaryaAuth || null;
    const store = window.QaryaPlatformStore || null;
    const telegramApi = window.QaryaTelegram || null;

    if (!examWindowApi) {
        return;
    }

    const LEADER_CODES = telegramApi?.LEADER_CODES || ['Abdou200', 'Mohamed333', 'Reda456'];
    const DEVICE_LOCK_KEY = 'qaryaeduExamDeviceLock';
    const EXAM_GATE_KEY = 'qaryaeduExamGatePass';

    const messageBox = document.getElementById('app-message');
    const dateElement = document.getElementById('date');
    const clockElement = document.getElementById('clock');
    const countdownElement = document.getElementById('countdown');
    const examForm = document.getElementById('exam-form');
    const leaderCodeInput = document.getElementById('leader-code');
    const requestIdInput = document.getElementById('request-id');
    const ageInput = document.getElementById('age');
    const windowStatusElement = document.getElementById('window-status');
    const todayStatusElement = document.getElementById('today-status');
    const nextSlotElement = document.getElementById('next-slot');
    const examAccessNote = document.getElementById('exam-access-note');
    const deviceGuardNote = document.getElementById('device-guard-note');
    const modeBanner = document.querySelector('.main-content-container > .section-shell .status-card');
    const windowStatusCard = windowStatusElement ? windowStatusElement.closest('.exam-pill') : null;
    const todayStatusCard = todayStatusElement ? todayStatusElement.closest('.exam-pill') : null;

    let messageTimeout = null;

    if (store?.refreshFromRemote) {
        await store.refreshFromRemote({ force: true });
    }
    if (authApi?.refreshFromRemote) {
        await authApi.refreshFromRemote({ force: true });
    }

    if (leaderCodeInput?.tagName === 'SELECT') {
        leaderCodeInput.innerHTML = LEADER_CODES.map((code) => `<option value="${code}">${code}</option>`).join('');
    }

    function parseJson(value, fallback) {
        try {
            return JSON.parse(value || '');
        } catch (error) {
            return fallback;
        }
    }

    function showMessage(message, duration = 3400) {
        if (!messageBox) return;
        clearTimeout(messageTimeout);
        messageBox.textContent = message;
        messageBox.classList.add('show');
        messageTimeout = window.setTimeout(() => {
            messageBox.classList.remove('show');
        }, duration);
    }

    function togglePillState(card, isOpen) {
        if (!card) return;
        card.classList.toggle('is-open', isOpen);
        card.classList.toggle('is-muted', !isOpen);
    }

    function getDeviceLock() {
        return parseJson(localStorage.getItem(DEVICE_LOCK_KEY), null);
    }

    function storeDeviceLock(application, leaderCode) {
        const lock = {
            requestId: application.requestId,
            name: application.name,
            leaderCode: leaderCode || application.leaderCode || '',
            lockedAt: new Date().toISOString()
        };
        localStorage.setItem(DEVICE_LOCK_KEY, JSON.stringify(lock));
        return lock;
    }

    function hasAttemptedToday(requestId, dateValue = Date.now()) {
        if (store?.hasExamAttemptOnDate) {
            return store.hasExamAttemptOnDate(requestId, dateValue);
        }
        return Boolean(store?.getExamAttemptsByRequestIdAndDate?.(requestId, dateValue)?.length);
    }

    function renderBanner(windowState) {
        if (!modeBanner) return;
        const iconClass = windowState.open ? 'fa-door-open' : windowState.mode === 'closed' ? 'fa-circle-stop' : 'fa-hourglass-half';
        const accentColor = windowState.open ? 'var(--success)' : windowState.mode === 'closed' ? 'var(--danger)' : 'var(--primary)';
        const background = windowState.open ? 'var(--success-soft)' : windowState.mode === 'closed' ? 'var(--danger-soft)' : 'var(--surface-strong)';

        modeBanner.style.background = background;
        modeBanner.style.border = `2px solid ${accentColor}`;
        modeBanner.innerHTML = `
            <i class="fas ${iconClass}" style="font-size: 3rem; color: ${accentColor}; margin-bottom: 1rem;"></i>
            <h2 style="color: ${accentColor}; font-family: var(--font-display); margin-bottom: 0.5rem;">${windowState.statusText}</h2>
            <p style="font-size: 1.05rem; font-weight: 700; color: var(--text-main);">${windowState.bannerText}</p>
        `;
    }

    function resolveCountdownText(windowState, now) {
        if (!windowState.showCountdown || !windowState.countdownTarget) {
            return windowState.statusText;
        }

        return `${windowState.countdownPrefix}: ${examWindowApi.formatCountdown(windowState.countdownTarget - now)}`;
    }

    function renderState(forceRefresh = false) {
        if (forceRefresh && store?.refreshFromRemote) {
            void store.refreshFromRemote({ force: true });
        }

        const now = examWindowApi.getEgyptNow();
        const settings = store?.getPlatformSettings ? store.getPlatformSettings() : {};
        const windowState = examWindowApi.getExamWindowState(now, settings);

        if (dateElement) {
            dateElement.textContent = `التاريخ: ${now.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
        }
        if (clockElement) {
            clockElement.textContent = `الساعة الآن: ${now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} بتوقيت مصر`;
        }
        if (countdownElement) {
            countdownElement.textContent = resolveCountdownText(windowState, now);
        }
        if (examForm) {
            examForm.style.display = windowState.open ? 'flex' : 'none';
        }
        if (windowStatusElement) {
            windowStatusElement.textContent = windowState.open ? 'مفتوح الآن' : 'مغلق الآن';
        }
        if (todayStatusElement) {
            todayStatusElement.textContent = windowState.todayText;
        }
        if (nextSlotElement) {
            nextSlotElement.textContent = windowState.nextText;
        }
        if (examAccessNote) {
            examAccessNote.textContent = windowState.accessText;
        }

        togglePillState(windowStatusCard, windowState.open);
        togglePillState(todayStatusCard, windowState.open || windowState.todayText !== 'لا يوجد امتحانات اليوم');
        renderBanner(windowState);
    }

    function updateDeviceGuardNote() {
        if (!deviceGuardNote) return;
        const lock = getDeviceLock();
        deviceGuardNote.textContent = lock
            ? `هذا الجهاز مرتبط حاليًا بالطلب ${lock.requestId} فقط.`
            : 'عند دخول أول طالب من هذا الجهاز سيتم قفل الجهاز على نفس الطلب فقط.';
    }

    function sessionMatchesApplication(application) {
        const session = authApi?.getSession?.();
        if (!session) return false;
        if (authApi?.isAdminSession?.(session) || authApi?.isLeader?.(session.email)) {
            return true;
        }

        const sessionUser = authApi.getUserByEmail?.(session.email);
        const sessionEmail = authApi.normalizeEmail?.(session.email);
        const applicationEmail = authApi.normalizeEmail?.(application.studentEmail);
        const sameEmail = Boolean(applicationEmail && sessionEmail === applicationEmail);
        const sameNationalId = Boolean(sessionUser?.nationalId && String(sessionUser.nationalId) === String(application.nationalId));
        return sameEmail || sameNationalId;
    }

    updateDeviceGuardNote();
    renderState(true);
    window.setInterval(() => renderState(false), 1000);
    window.setInterval(() => renderState(true), 5000);

    examForm?.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (store?.refreshFromRemote) {
            await store.refreshFromRemote({ force: true });
        }

        const now = examWindowApi.getEgyptNow();
        const windowState = examWindowApi.getExamWindowState(now, store?.getPlatformSettings?.() || {});
        if (!windowState.open) {
            renderState(false);
            showMessage(windowState.statusText);
            return;
        }

        const leaderCode = String(leaderCodeInput?.value || '').trim();
        const requestId = String(requestIdInput?.value || '').trim().toUpperCase();
        const age = Number(ageInput?.value || 0);
        const application = store?.getApplicationByRequestId?.(requestId);

        if (!LEADER_CODES.includes(leaderCode)) {
            showMessage(`اختر كود قائد صحيح من: ${LEADER_CODES.join(' - ')}.`);
            return;
        }
        if (!application) {
            showMessage('رقم الطلب غير موجود داخل بيانات المنصة الحالية.');
            return;
        }
        if (!sessionMatchesApplication(application)) {
            showMessage('هذا الحساب لا يملك صلاحية دخول هذا الطلب.');
            return;
        }
        if (Number(application.age || 0) !== age) {
            showMessage('العمر المدخل لا يطابق العمر المسجل لهذا الطلب.');
            return;
        }
        if (application.examAccess === 'blocked') {
            showMessage(application.examAccessReason || 'هذا الطلب ممنوع حاليًا من دخول الامتحان.');
            return;
        }
        if (store?.canStudentTakeExam && !store.canStudentTakeExam(application)) {
            showMessage('هذا الطلب غير مسموح له بدخول الامتحان حاليًا.');
            return;
        }
        if (hasAttemptedToday(application.requestId, now)) {
            showMessage('تم استخدام محاولة الامتحان الخاصة بهذا اليوم بالفعل. يمكنك الدخول مرة أخرى في يوم الامتحان التالي فقط.');
            return;
        }

        const deviceLock = getDeviceLock();
        if (deviceLock && deviceLock.requestId !== application.requestId) {
            showMessage(`هذا الجهاز مرتبط بالفعل بالطلب ${deviceLock.requestId} ولا يسمح بطالب آخر.`);
            return;
        }

        if (!deviceLock) {
            storeDeviceLock(application, leaderCode);
            updateDeviceGuardNote();
        }

        const examLevel = Number(application.age) >= 18 ? 'senior' : 'junior';
        const verifiedStudent = {
            requestId: application.requestId,
            age: Number(application.age || 0),
            nationalId: application.nationalId,
            leaderCode: leaderCode || application.leaderCode,
            name: application.name,
            studentEmail: application.studentEmail || '',
            timestamp: Date.now()
        };

        sessionStorage.setItem('qarya_verified_student', JSON.stringify(verifiedStudent));
        sessionStorage.setItem(EXAM_GATE_KEY, JSON.stringify({
            requestId: application.requestId,
            examLevel,
            issuedAt: Date.now()
        }));

        window.location.href = examLevel === 'senior' ? 'examfull.html' : 'exam.html';
    });
});
