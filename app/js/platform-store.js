(() => {
    const APPLICATIONS_KEY = 'qaryaeduApplications';
    const EXAM_HISTORY_KEY = 'qaryaeduExamHistory';
    const EXAM_CLEARS_KEY = 'qaryaeduExamHistoryClears';
    const NOTIFICATIONS_KEY = 'qaryaeduPlatformNotifications';
    const SETTINGS_KEY = 'qaryaeduPlatformSettings';
    const STORE_EVENT = 'qarya:store-updated';
    const REMOTE_POLL_MS = 5000;
    const DEFAULT_STATUS_MESSAGES = {
        pending: 'طلبك قيد المراجعة حاليًا وسيتم تحديث الحالة بعد انتهاء المراجعة.',
        accepted: 'تمت الموافقة على طلبك بنجاح ويمكنك متابعة المراحل التالية من المنصة.',
        rejected: 'نأسف، تم رفض الطلب بعد المراجعة الحالية. يمكنك متابعة الرسالة المرفقة لمعرفة التفاصيل.'
    };
    const DEFAULT_SETTINGS = {
        examMode: 'default',
        examModeMessage: '',
        updatedAt: ''
    };

    let syncTimeoutId = null;
    let syncInFlight = null;
    let remotePollStarted = false;
    let lastKnownSignature = '';

    function parseJson(value, fallback) {
        try {
            return JSON.parse(value || '');
        } catch (error) {
            return fallback;
        }
    }

    function normalizeRequestId(value) {
        return String(value || '').trim().toUpperCase();
    }

    function normalizeStatus(status) {
        if (status === 'accepted' || status === 'rejected') return status;
        return 'pending';
    }

    function normalizeExamAccess(access) {
        if (access === 'allowed' || access === 'blocked') return access;
        return 'default';
    }

    function normalizeExamMode(mode) {
        if (mode === 'open' || mode === 'closed') return mode;
        return 'default';
    }

    function normalizeArray(value) {
        return Array.isArray(value) ? value : [];
    }

    function normalizeText(value) {
        return String(value || '').trim();
    }

    function getApiUrl() {
        return window.location.pathname.includes('/pages/') ? '../api/platform-state.php' : './api/platform-state.php';
    }

    function getStoredApplications() {
        return normalizeArray(parseJson(localStorage.getItem(APPLICATIONS_KEY), []));
    }

    function saveStoredApplications(applications, options = {}) {
        localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(normalizeArray(applications)));
        if (!options.silent) notifyChanged();
    }

    function getStoredExamHistory() {
        return normalizeArray(parseJson(localStorage.getItem(EXAM_HISTORY_KEY), []));
    }

    function saveExamHistory(history, options = {}) {
        localStorage.setItem(EXAM_HISTORY_KEY, JSON.stringify(normalizeArray(history)));
        if (!options.silent) notifyChanged();
    }

    function getStoredExamClearsRaw() {
        return normalizeArray(parseJson(localStorage.getItem(EXAM_CLEARS_KEY), []));
    }

    function saveExamClears(clears, options = {}) {
        localStorage.setItem(EXAM_CLEARS_KEY, JSON.stringify(normalizeArray(clears)));
        if (!options.silent) notifyChanged();
    }

    function getStoredNotificationsRaw() {
        return normalizeArray(parseJson(localStorage.getItem(NOTIFICATIONS_KEY), []));
    }

    function saveNotifications(notifications, options = {}) {
        localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(normalizeArray(notifications).slice(0, 80)));
        if (!options.silent) notifyChanged();
    }

    function getStoredSettingsRaw() {
        return parseJson(localStorage.getItem(SETTINGS_KEY), {});
    }

    function normalizeSettings(settings) {
        return {
            ...DEFAULT_SETTINGS,
            ...settings,
            examMode: normalizeExamMode(settings?.examMode),
            examModeMessage: normalizeText(settings?.examModeMessage),
            updatedAt: settings?.updatedAt || DEFAULT_SETTINGS.updatedAt
        };
    }

    function getPlatformSettings() {
        return normalizeSettings(getStoredSettingsRaw());
    }

    function savePlatformSettings(settings, options = {}) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalizeSettings(settings)));
        if (!options.silent) notifyChanged();
    }

    function buildRuntimeState() {
        return {
            applications: getStoredApplications(),
            examHistory: getStoredExamHistory(),
            examClears: getStoredExamClearsRaw(),
            notifications: getStoredNotificationsRaw(),
            settings: getPlatformSettings()
        };
    }

    function buildSignature(state) {
        try {
            return JSON.stringify(state);
        } catch (error) {
            return String(Date.now());
        }
    }

    function dispatchStoreUpdated() {
        window.dispatchEvent(new CustomEvent(STORE_EVENT));
    }

    function scheduleRemoteSync() {
        if (syncTimeoutId) clearTimeout(syncTimeoutId);
        syncTimeoutId = window.setTimeout(() => {
            syncTimeoutId = null;
            void syncNow({ pullAfter: false });
        }, 350);
    }

    function notifyChanged(options = {}) {
        dispatchStoreUpdated();
        if (!options.skipRemote) scheduleRemoteSync();
    }

    function normalizeRuntimeState(state) {
        return {
            applications: normalizeArray(state?.applications),
            examHistory: normalizeArray(state?.examHistory),
            examClears: normalizeArray(state?.examClears),
            notifications: normalizeArray(state?.notifications),
            settings: normalizeSettings(state?.settings || {})
        };
    }

    function applyRuntimeState(state, options = {}) {
        const normalized = normalizeRuntimeState(state);
        saveStoredApplications(normalized.applications, { silent: true });
        saveExamHistory(normalized.examHistory, { silent: true });
        saveExamClears(normalized.examClears, { silent: true });
        saveNotifications(normalized.notifications, { silent: true });
        savePlatformSettings(normalized.settings, { silent: true });
        lastKnownSignature = buildSignature(normalized);
        if (options.dispatch !== false) dispatchStoreUpdated();
    }

    async function readRemoteState() {
        try {
            const response = await fetch(`${getApiUrl()}?t=${Date.now()}`, {
                cache: 'no-store',
                headers: { Accept: 'application/json' }
            });
            if (!response.ok) return null;
            const data = await response.json();
            if (!data?.ok || !data.state) return null;
            return normalizeRuntimeState(data.state);
        } catch (error) {
            return null;
        }
    }

    async function pushRemoteState() {
        const state = buildRuntimeState();
        const signature = buildSignature(state);
        try {
            const response = await fetch(getApiUrl(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                },
                body: JSON.stringify({ state })
            });
            if (!response.ok) return false;
            const data = await response.json();
            if (!data?.ok) return false;
            lastKnownSignature = signature;
            return true;
        } catch (error) {
            return false;
        }
    }

    async function syncNow(options = {}) {
        if (syncTimeoutId) {
            clearTimeout(syncTimeoutId);
            syncTimeoutId = null;
        }

        if (syncInFlight) {
            return syncInFlight;
        }

        syncInFlight = (async () => {
            if (options.pullFirst) {
                await refreshFromRemote({ force: true });
            }

            const pushed = await pushRemoteState();
            if (pushed && options.pullAfter !== false) {
                await refreshFromRemote({ force: true });
            }
            return pushed;
        })();

        try {
            return await syncInFlight;
        } finally {
            syncInFlight = null;
        }
    }

    async function refreshFromRemote(options = {}) {
        const remoteState = await readRemoteState();
        if (!remoteState) return false;
        const signature = buildSignature(remoteState);
        if (options.force || signature !== lastKnownSignature) {
            applyRuntimeState(remoteState, { dispatch: true });
        }
        return true;
    }

    function initRemoteSync() {
        if (remotePollStarted) return;
        remotePollStarted = true;
        lastKnownSignature = buildSignature(buildRuntimeState());
        void refreshFromRemote({ force: true });
        window.setInterval(() => {
            void refreshFromRemote();
        }, REMOTE_POLL_MS);
        window.addEventListener('storage', (event) => {
            if ([APPLICATIONS_KEY, EXAM_HISTORY_KEY, EXAM_CLEARS_KEY, NOTIFICATIONS_KEY, SETTINGS_KEY].includes(event.key)) {
                dispatchStoreUpdated();
            }
        });
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') void refreshFromRemote();
        });
    }

    function getFixedApplications() {
        return Array.isArray(window.fixedApplications) ? window.fixedApplications : [];
    }

    function normalizeApplication(application) {
        const ageNumber = Number(application?.age);
        return {
            ...application,
            requestId: normalizeRequestId(application?.requestId),
            nationalId: normalizeText(application?.nationalId),
            name: normalizeText(application?.name),
            governorate: normalizeText(application?.governorate),
            city: normalizeText(application?.city),
            village: normalizeText(application?.village),
            leaderCode: normalizeText(application?.leaderCode),
            dob: normalizeText(application?.dob),
            gender: normalizeText(application?.gender),
            ageCategory: normalizeText(application?.ageCategory),
            status: normalizeStatus(application?.status),
            examAccess: normalizeExamAccess(application?.examAccess),
            examAccessReason: normalizeText(application?.examAccessReason),
            message: normalizeText(application?.message),
            createdAt: application?.createdAt || '',
            updatedAt: application?.updatedAt || '',
            age: Number.isFinite(ageNumber) && ageNumber > 0 ? ageNumber : null,
            _deleted: Boolean(application?._deleted)
        };
    }

    function normalizeExamClear(clearRecord) {
        return {
            requestId: normalizeRequestId(clearRecord?.requestId),
            clearedAt: clearRecord?.clearedAt || ''
        };
    }

    function getLatestExamClearMap() {
        const map = new Map();
        getStoredExamClearsRaw().forEach((clearRecord) => {
            const normalized = normalizeExamClear(clearRecord);
            if (!normalized.requestId) return;
            const currentTime = new Date(normalized.clearedAt || 0).getTime();
            const previous = map.get(normalized.requestId);
            const previousTime = previous ? new Date(previous.clearedAt || 0).getTime() : 0;
            if (!previous || currentTime >= previousTime) {
                map.set(normalized.requestId, normalized);
            }
        });
        return map;
    }

    function filterExamHistory(history) {
        const clearMap = getLatestExamClearMap();
        return normalizeArray(history).filter((attempt) => {
            const requestId = normalizeRequestId(attempt?.requestId);
            if (!requestId) return false;
            const clearRecord = clearMap.get(requestId);
            if (!clearRecord) return true;
            const clearTime = new Date(clearRecord.clearedAt || 0).getTime();
            const attemptTime = new Date(attempt?.date || 0).getTime();
            if (!Number.isFinite(clearTime) || clearTime <= 0) return true;
            if (!Number.isFinite(attemptTime) || attemptTime <= 0) return false;
            return attemptTime > clearTime;
        });
    }

    function mergeApplications() {
        const map = new Map();

        getFixedApplications().forEach((application) => {
            const normalized = normalizeApplication(application);
            if (!normalized.requestId) return;
            map.set(normalized.requestId, {
                ...normalized,
                source: 'fixed'
            });
        });

        getStoredApplications().forEach((application) => {
            const normalized = normalizeApplication(application);
            if (!normalized.requestId) return;
            if (normalized._deleted) {
                map.delete(normalized.requestId);
                return;
            }
            const previous = map.get(normalized.requestId) || {};
            map.set(normalized.requestId, {
                ...previous,
                ...normalized,
                source: 'stored'
            });
        });

        return Array.from(map.values()).sort((first, second) => {
            const firstDate = new Date(first.updatedAt || first.createdAt || 0).getTime();
            const secondDate = new Date(second.updatedAt || second.createdAt || 0).getTime();
            return secondDate - firstDate;
        });
    }

    function getAllApplications() {
        return mergeApplications();
    }

    function getApplicationByRequestId(requestId) {
        const normalized = normalizeRequestId(requestId);
        return getAllApplications().find((application) => application.requestId === normalized) || null;
    }

    function getApplicationByRequestAndNationalId(requestId, nationalId) {
        const normalizedRequestId = normalizeRequestId(requestId);
        const normalizedNationalId = normalizeText(nationalId);
        return getAllApplications().find((application) => (
            application.requestId === normalizedRequestId
            && normalizeText(application.nationalId) === normalizedNationalId
        )) || null;
    }

    function upsertApplication(application) {
        const nextValue = normalizeApplication({
            ...application,
            requestId: normalizeRequestId(application?.requestId),
            updatedAt: application?.updatedAt || new Date().toISOString(),
            message: application?.message || DEFAULT_STATUS_MESSAGES[normalizeStatus(application?.status)]
        });
        const stored = getStoredApplications();
        const index = stored.findIndex((item) => normalizeRequestId(item.requestId) === nextValue.requestId);
        if (index >= 0) {
            stored[index] = { ...stored[index], ...nextValue };
        } else {
            stored.unshift(nextValue);
        }
        saveStoredApplications(stored);
        return nextValue;
    }

    function updateApplicationDetails(requestId, updates) {
        const application = getApplicationByRequestId(requestId);
        if (!application) return null;
        const nextValue = {
            ...application,
            ...updates,
            requestId: application.requestId,
            updatedAt: new Date().toISOString(),
            status: normalizeStatus(updates?.status || application.status),
            examAccess: normalizeExamAccess(updates?.examAccess || application.examAccess)
        };
        return upsertApplication(nextValue);
    }

    function getStatusLabel(status) {
        if (status === 'accepted') return 'مقبول';
        if (status === 'rejected') return 'مرفوض';
        return 'قيد المراجعة';
    }

    function getExamAccessLabel(access) {
        if (access === 'allowed') return 'سماح خاص';
        if (access === 'blocked') return 'ممنوع من الامتحان';
        return 'حسب القواعد';
    }

    function canStudentTakeExam(application) {
        if (!application || application._deleted) return false;
        if (application.examAccess === 'blocked') return false;
        if (application.examAccess === 'allowed') return true;
        return normalizeStatus(application.status) === 'accepted';
    }

    function addNotification(note) {
        const stored = getStoredNotificationsRaw();
        const notification = {
            id: note.id || `NT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            title: note.title || 'إشعار جديد',
            body: note.body || '',
            type: note.type || 'update',
            createdAt: note.createdAt || new Date().toISOString(),
            actionUrl: note.actionUrl || '',
            actionLabel: note.actionLabel || ''
        };
        stored.unshift(notification);
        saveNotifications(stored);
        return notification;
    }

    function getDefaultNotifications() {
        return [
            {
                id: 'default-exam-window',
                title: 'مواعيد الامتحان الرسمية',
                body: 'تفتح الامتحانات أيام السبت والأحد والاثنين من 07:00 مساءً إلى 08:00 مساءً بتوقيت مصر.',
                type: 'exam',
                createdAt: '2026-03-01T18:00:00+02:00',
                actionUrl: './exam-status.html',
                actionLabel: 'بوابة الامتحان'
            },
            {
                id: 'default-reapply-policy',
                title: 'سياسة إعادة التقديم',
                body: 'إعادة التقديم بنفس الرقم القومي متاحة بعد 72 ساعة فقط، ثم يتم حذف الطلب السابق تلقائيًا.',
                type: 'application',
                createdAt: '2026-03-02T12:00:00+02:00',
                actionUrl: './request-policy.html',
                actionLabel: 'سياسة الطلبات'
            },
            {
                id: 'default-payment-note',
                title: 'إشعار الأموال',
                body: 'تم إرسال جميع الأموال إلى القائد على جميع الطلاب. تأكدوا من تفعيل الأدمن لكم حتى تتمكنوا من استلام الدفعات.',
                type: 'finance',
                createdAt: '2026-03-03T14:00:00+02:00',
                actionUrl: './notifications.html',
                actionLabel: 'مركز الإشعارات'
            }
        ];
    }

    function getNotifications() {
        const map = new Map();
        [...getStoredNotificationsRaw(), ...getDefaultNotifications()].forEach((item) => {
            if (!map.has(item.id)) map.set(item.id, item);
        });
        return Array.from(map.values()).sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());
    }

    function updateApplicationStatus(requestId, status, message) {
        const updated = updateApplicationDetails(requestId, {
            status: normalizeStatus(status),
            message: message || DEFAULT_STATUS_MESSAGES[normalizeStatus(status)]
        });
        if (!updated) return null;
        addNotification({
            title: `تحديث الطلب ${updated.requestId}`,
            body: `تم تحديث حالة الطلب إلى ${getStatusLabel(updated.status)}.${updated.message ? ` ${updated.message}` : ''}`,
            type: 'application',
            actionUrl: './status.html?requestId=' + encodeURIComponent(updated.requestId) + '&nationalId=' + encodeURIComponent(updated.nationalId || ''),
            actionLabel: 'فتح حالة الطلب'
        });
        return updated;
    }

    function setExamAccess(requestId, examAccess, reason = '') {
        const updated = updateApplicationDetails(requestId, {
            examAccess: normalizeExamAccess(examAccess),
            examAccessReason: reason
        });
        if (!updated) return null;
        addNotification({
            title: `ضبط الامتحان ${updated.requestId}`,
            body: `تم تحديث صلاحية الامتحان إلى ${getExamAccessLabel(updated.examAccess)}.${updated.examAccessReason ? ` ${updated.examAccessReason}` : ''}`,
            type: 'exam',
            actionUrl: './status.html?requestId=' + encodeURIComponent(updated.requestId) + '&nationalId=' + encodeURIComponent(updated.nationalId || ''),
            actionLabel: 'فتح الطلب'
        });
        return updated;
    }

    function deleteApplication(requestId) {
        const normalized = normalizeRequestId(requestId);
        const application = getApplicationByRequestId(normalized);
        const stored = getStoredApplications().filter((item) => normalizeRequestId(item.requestId) !== normalized);
        stored.unshift({ requestId: normalized, _deleted: true, updatedAt: new Date().toISOString() });
        saveStoredApplications(stored);
        clearExamAttempts(normalized, { silent: true });
        addNotification({
            title: `حذف الطالب ${normalized}`,
            body: `تم حذف بيانات ${application?.name || normalized} من المنصة عبر لوحة الأدمن.`,
            type: 'application'
        });
        return true;
    }

    function clearExamAttempts(requestId, options = {}) {
        const normalized = normalizeRequestId(requestId);
        const clearedAt = new Date().toISOString();
        const nextClears = getStoredExamClearsRaw().filter((item) => normalizeRequestId(item.requestId) !== normalized);
        nextClears.unshift({ requestId: normalized, clearedAt });
        saveExamClears(nextClears, { silent: true });

        const nextHistory = getStoredExamHistory().filter((attempt) => normalizeRequestId(attempt.requestId) !== normalized);
        saveExamHistory(nextHistory, { silent: options.silent });
        if (!options.silent) {
            addNotification({
                title: `إعادة ضبط الامتحان ${normalized}`,
                body: 'تم حذف سجل المحاولات السابقة لهذا الطلب وإتاحة بدء دورة امتحان جديدة.',
                type: 'exam',
                actionUrl: './exam-status.html',
                actionLabel: 'بوابة الامتحان'
            });
        }
        return true;
    }

    function updatePlatformSettings(updates) {
        const nextSettings = normalizeSettings({
            ...getPlatformSettings(),
            ...updates,
            updatedAt: new Date().toISOString()
        });
        savePlatformSettings(nextSettings);
        addNotification({
            title: 'تحديث إعدادات المنصة',
            body: `تم ضبط وضع الامتحان العام على ${nextSettings.examMode === 'open' ? 'فتح إجباري' : nextSettings.examMode === 'closed' ? 'إغلاق إجباري' : 'الجدول الرسمي'}.${nextSettings.examModeMessage ? ` ${nextSettings.examModeMessage}` : ''}`,
            type: 'update',
            actionUrl: './exam-status.html',
            actionLabel: 'عرض البوابة'
        });
        return nextSettings;
    }

    function getExamHistory() {
        return filterExamHistory(getStoredExamHistory()).slice().sort((first, second) => new Date(second.date || 0).getTime() - new Date(first.date || 0).getTime());
    }

    function getExamHistoryByRequestId(requestId) {
        const normalized = normalizeRequestId(requestId);
        return getExamHistory().filter((attempt) => normalizeRequestId(attempt.requestId) === normalized);
    }

    function getStaticExamRecord(requestId) {
        const normalized = normalizeRequestId(requestId);
        const records = Array.isArray(window.examResults) ? window.examResults : [];
        return records.find((record) => normalizeRequestId(record.requestId) === normalized) || null;
    }

    function getStaticExamAttempts(requestId) {
        const record = getStaticExamRecord(requestId);
        if (!record || !Array.isArray(record.attempts)) return [];
        return record.attempts.map((attempt) => ({
            requestId: normalizeRequestId(requestId),
            name: record.name,
            examLevel: attempt.examLevel || 'senior',
            score: attempt.score,
            total: attempt.total,
            percentage: attempt.percentage,
            passed: attempt.status === 'passed',
            date: attempt.date,
            source: 'official',
            approved: attempt.approved !== false
        }));
    }

    function getAllExamAttemptsByRequestId(requestId) {
        const normalized = normalizeRequestId(requestId);
        const map = new Map();
        [...getExamHistoryByRequestId(normalized), ...getStaticExamAttempts(normalized)].forEach((attempt) => {
            const key = `${normalizeRequestId(attempt.requestId)}-${attempt.date || ''}-${attempt.percentage || ''}`;
            if (!map.has(key)) {
                map.set(key, { ...attempt, requestId: normalized });
            }
        });
        return Array.from(map.values()).sort((first, second) => new Date(second.date || 0).getTime() - new Date(first.date || 0).getTime());
    }

    function getLatestExamAttempt(requestId) {
        return getAllExamAttemptsByRequestId(requestId)[0] || null;
    }

    function getExamSummary(requestId) {
        const application = getApplicationByRequestId(requestId);
        const staticRecord = getStaticExamRecord(requestId);
        const attempts = getAllExamAttemptsByRequestId(requestId);
        return {
            requestId: normalizeRequestId(requestId),
            name: application?.name || staticRecord?.name || 'طالب المنصة',
            application,
            attempts,
            latestAttempt: attempts[0] || null,
            hasAttempts: attempts.length > 0
        };
    }

    function buildApplicationTimeline(application) {
        const latestAttempt = getLatestExamAttempt(application?.requestId);
        const status = normalizeStatus(application?.status);
        return [
            { key: 'submitted', title: 'تم إرسال الطلب', state: 'done', date: application?.createdAt || '', text: 'تم تسجيل البيانات وحفظ الطلب داخل المنصة.' },
            { key: 'review', title: 'قيد المراجعة', state: status === 'pending' ? 'current' : 'done', date: application?.updatedAt || application?.createdAt || '', text: 'تتم الآن مراجعة البيانات والتحقق من مطابقة الطلب.' },
            { key: 'decision', title: status === 'accepted' ? 'تمت الموافقة على الطلب' : status === 'rejected' ? 'تم رفض الطلب' : 'بانتظار القرار النهائي', state: status === 'pending' ? 'pending' : status === 'accepted' ? 'done is-success' : 'done is-danger', date: status === 'pending' ? '' : (application?.updatedAt || application?.createdAt || ''), text: status === 'accepted' ? 'الطلب أصبح معتمدًا ويمكن متابعة المراحل التالية.' : status === 'rejected' ? 'تم حفظ قرار الرفض الحالي داخل سجل الطلب.' : 'سيظهر القرار النهائي هنا بعد انتهاء المراجعة.' },
            { key: 'exam', title: latestAttempt ? 'تم تسجيل أداء الامتحان' : (canStudentTakeExam(application) ? 'الطلب جاهز للامتحان' : 'بوابة الامتحان غير متاحة بعد'), state: latestAttempt ? 'done' : (canStudentTakeExam(application) ? 'current' : 'pending'), date: latestAttempt?.date || '', text: latestAttempt ? `آخر نتيجة مسجلة ${latestAttempt.percentage || 0}% بتاريخ ${latestAttempt.date ? new Date(latestAttempt.date).toLocaleString('ar-EG') : ''}.` : canStudentTakeExam(application) ? 'يمكن للطالب دخول بوابة الامتحان وفق الضبط الحالي.' : 'لم يتم السماح لهذا الطلب بدخول الامتحان بعد.' }
        ];
    }

    function getDashboardMetrics() {
        const applications = getAllApplications();
        const history = getExamHistory();
        return {
            totalApplications: applications.length,
            pendingApplications: applications.filter((item) => item.status === 'pending').length,
            acceptedApplications: applications.filter((item) => item.status === 'accepted').length,
            rejectedApplications: applications.filter((item) => item.status === 'rejected').length,
            blockedExamApplications: applications.filter((item) => item.examAccess === 'blocked').length,
            totalExamAttempts: history.length,
            latestApplications: applications.slice(0, 6),
            latestExamAttempts: history.slice(0, 6)
        };
    }

    function canAccessAdmin(session) {
        return Boolean(window.QaryaAuth?.isAdminSession?.(session));
    }

    initRemoteSync();

    window.QaryaPlatformStore = {
        storeEventName: STORE_EVENT,
        getStoredApplications,
        saveStoredApplications,
        getAllApplications,
        getApplicationByRequestId,
        getApplicationByRequestAndNationalId,
        upsertApplication,
        updateApplicationDetails,
        updateApplicationStatus,
        deleteApplication,
        setExamAccess,
        clearExamAttempts,
        getStatusLabel,
        getExamAccessLabel,
        canStudentTakeExam,
        getNotifications,
        addNotification,
        getExamHistory,
        saveExamHistory,
        getExamHistoryByRequestId,
        getLatestExamAttempt,
        getAllExamAttemptsByRequestId,
        getExamSummary,
        buildApplicationTimeline,
        getDashboardMetrics,
        getPlatformSettings,
        savePlatformSettings,
        updatePlatformSettings,
        canAccessAdmin,
        notifyChanged,
        refreshFromRemote,
        syncNow
    };
})();
