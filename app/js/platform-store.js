﻿(() => {
    const APPLICATIONS_KEY = 'qaryaeduApplications';
    const EXAM_HISTORY_KEY = 'qaryaeduExamHistory';
    const EXAM_CLEARS_KEY = 'qaryaeduExamHistoryClears';
    const NOTIFICATIONS_KEY = 'qaryaeduPlatformNotifications';
    const SUPPORT_THREADS_KEY = 'qaryaeduSupportThreads';
    const SETTINGS_KEY = 'qaryaeduPlatformSettings';
    const STORE_EVENT = 'qarya:store-updated';
    const REMOTE_POLL_MS = 30000;
    const DEFAULT_STATUS_MESSAGES = {
        pending: 'طلبك قيد المراجعة حاليًا وسيتم تحديث الحالة بعد انتهاء المراجعة.',
        accepted: 'تمت الموافقة على طلبك بنجاح ويمكنك متابعة المراحل التالية من المنصة.',
        rejected: 'نأسف، تم رفض الطلب بعد المراجعة الحالية. يمكنك متابعة الرسالة المرفقة لمعرفة التفاصيل.'
    };
    const DEFAULT_SETTINGS = {
        examMode: 'default',
        examModeMessage: '',
        manualExamOpenedAt: '',
        manualExamEndsAt: '',
        manualExamDurationMinutes: 60,
        maintenanceMode: false,
        maintenanceMessage: 'جاري الآن صيانة الموقع. يرجى المحاولة لاحقًا.',
        welcomeAnnouncementEnabled: true,
        welcomeAnnouncementTitle: 'مرحباً بعودتنا',
        welcomeAnnouncementMessage: 'يرجى العلم أنه جاري الآن تجهيز المرحلة الثالثة على التوالي لبرنامجنا التعليمي "قرية متعلمة".\n\nيرجى التنويه أن جميع طلبات السحب محفوظة لدينا.\n\nانتظرونا يوم 5 سبتمبر.',
        welcomeAnnouncementClosable: false,
        updatedAt: ''
    };

    let syncTimeoutId = null;
    let syncInFlight = null;
    let remotePollStarted = false;
    let lastKnownSignature = '';
    let lastDispatchAt = 0;
    let pendingDispatchTimer = null;
    let platformFirebaseSubscribed = false;
    let platformReadyHooked = false;

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

    function normalizeEmail(value) {
        return normalizeText(value).toLowerCase();
    }

    function isAllowedApplicationRecord(application = {}) {
        // Every valid application must remain visible to leaders.  Deletions are
        // represented by the record's _deleted flag and handled during merging.
        return Boolean(normalizeRequestId(application.requestId));
    }

    function isAllowedExamRecord(record = {}, applications = getStoredApplications()) {
        return Boolean(normalizeRequestId(record.requestId));
    }

    function isAllowedSupportThread(thread = {}) {
        return Boolean(normalizeText(thread.email) || normalizeText(thread.id));
    }

    function normalizeNotificationType(type) {
        const normalized = normalizeText(type) || 'update';
        return normalized;
    }

    function normalizeNotificationAudience(audience) {
        return normalizeText(audience) === 'private' ? 'private' : 'global';
    }

    function normalizeNotificationDisplayMode(mode) {
        const normalized = normalizeText(mode);
        if (normalized === 'banner' || normalized === 'floating') {
            return normalized;
        }
        return 'feed';
    }

    function normalizeNotification(note = {}) {
        return {
            id: normalizeText(note.id) || `NT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            title: normalizeText(note.title) || 'إشعار جديد',
            body: normalizeText(note.body),
            type: normalizeNotificationType(note.type),
            audience: normalizeNotificationAudience(note.audience),
            createdAt: note.createdAt || new Date().toISOString(),
            updatedAt: note.updatedAt || note.createdAt || new Date().toISOString(),
            actionUrl: normalizeText(note.actionUrl),
            actionLabel: normalizeText(note.actionLabel),
            displayMode: normalizeNotificationDisplayMode(note.displayMode),
            sticky: Boolean(note.sticky),
            dismissible: note.dismissible !== false,
            startAt: note.startAt || '',
            endAt: note.endAt || '',
            recipientEmail: normalizeText(note.recipientEmail).toLowerCase(),
            recipientName: normalizeText(note.recipientName),
            systemKey: normalizeText(note.systemKey),
            deleted: Boolean(note.deleted)
        };
    }

    function getApiUrl() {
        return window.location.pathname.includes('/pages/') ? '../api/platform-state.php' : './api/platform-state.php';
    }

    function getFirebaseApi() {
        return window.QaryaFirebase || null;
    }

    function hookFirebaseReady(callback) {
        const firebase = getFirebaseApi();
        if (firebase) {
            callback(firebase);
            return;
        }

        window.addEventListener('qarya:firebase-ready', () => {
            const readyFirebase = getFirebaseApi();
            if (readyFirebase) {
                callback(readyFirebase);
            }
        }, { once: true });
    }

    async function waitForFirebaseApi(timeoutMs = 4000) {
        const firebase = getFirebaseApi();
        if (firebase) {
            return firebase;
        }

        return await new Promise((resolve) => {
            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                resolve(getFirebaseApi());
            };

            window.addEventListener('qarya:firebase-ready', finish, { once: true });
            window.setTimeout(finish, timeoutMs);
        });
    }

    function getStoredApplications() {
        return normalizeArray(parseJson(localStorage.getItem(APPLICATIONS_KEY), []))
            .map((application) => normalizeApplication(application))
            .filter((application) => application.requestId && isAllowedApplicationRecord(application));
    }

    function saveStoredApplications(applications, options = {}) {
        localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(
            normalizeArray(applications)
                .map((application) => normalizeApplication(application))
                .filter((application) => application.requestId && isAllowedApplicationRecord(application))
        ));
        if (!options.silent) notifyChanged();
    }

    function getStoredExamHistory() {
        return normalizeArray(parseJson(localStorage.getItem(EXAM_HISTORY_KEY), []))
            .filter((attempt) => isAllowedExamRecord(attempt));
    }

    function saveExamHistory(history, options = {}) {
        localStorage.setItem(EXAM_HISTORY_KEY, JSON.stringify(
            normalizeArray(history).filter((attempt) => isAllowedExamRecord(attempt))
        ));
        if (!options.silent) notifyChanged();
    }

    function getStoredExamClearsRaw() {
        return normalizeArray(parseJson(localStorage.getItem(EXAM_CLEARS_KEY), []))
            .filter((clearRecord) => isAllowedExamRecord(clearRecord));
    }

    function saveExamClears(clears, options = {}) {
        localStorage.setItem(EXAM_CLEARS_KEY, JSON.stringify(
            normalizeArray(clears).filter((clearRecord) => isAllowedExamRecord(clearRecord))
        ));
        if (!options.silent) notifyChanged();
    }

    function getStoredNotificationsRaw() {
        return normalizeArray(parseJson(localStorage.getItem(NOTIFICATIONS_KEY), []))
            .map((notification) => normalizeNotification(notification));
    }

    function saveNotifications(notifications, options = {}) {
        localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(
            normalizeArray(notifications)
                .map((notification) => normalizeNotification(notification))
                .slice(0, 120)
        ));
        if (!options.silent) notifyChanged();
    }

    function getStoredSupportThreadsRaw() {
        return normalizeArray(parseJson(localStorage.getItem(SUPPORT_THREADS_KEY), []))
            .map((thread) => normalizeSupportThread(thread))
            .filter((thread) => isAllowedSupportThread(thread));
    }

    function saveSupportThreads(threads, options = {}) {
        localStorage.setItem(SUPPORT_THREADS_KEY, JSON.stringify(
            normalizeArray(threads)
                .map((thread) => normalizeSupportThread(thread))
                .filter((thread) => isAllowedSupportThread(thread))
                .slice(0, 80)
        ));
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
            manualExamOpenedAt: normalizeText(settings?.manualExamOpenedAt),
            manualExamEndsAt: normalizeText(settings?.manualExamEndsAt),
            manualExamDurationMinutes: Math.max(5, Number(settings?.manualExamDurationMinutes || DEFAULT_SETTINGS.manualExamDurationMinutes)),
            maintenanceMode: Boolean(settings?.maintenanceMode),
            maintenanceMessage: normalizeText(settings?.maintenanceMessage) || DEFAULT_SETTINGS.maintenanceMessage,
            welcomeAnnouncementEnabled: settings?.welcomeAnnouncementEnabled !== false,
            welcomeAnnouncementTitle: normalizeText(settings?.welcomeAnnouncementTitle) || DEFAULT_SETTINGS.welcomeAnnouncementTitle,
            welcomeAnnouncementMessage: normalizeText(settings?.welcomeAnnouncementMessage) || DEFAULT_SETTINGS.welcomeAnnouncementMessage,
            welcomeAnnouncementClosable: settings?.welcomeAnnouncementClosable !== false,
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

    function normalizeSupportStatus(status) {
        return String(status || '').trim() === 'closed' ? 'closed' : 'open';
    }

    function normalizeSupportAttachment(attachment) {
        const src = normalizeText(attachment?.src);
        if (!src) return null;

        return {
            id: normalizeText(attachment?.id) || `SUPATT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: normalizeText(attachment?.type) || 'image',
            name: normalizeText(attachment?.name) || 'attachment',
            mimeType: normalizeText(attachment?.mimeType) || 'image/jpeg',
            src,
            size: Math.max(0, Number(attachment?.size || 0)),
            width: Math.max(0, Number(attachment?.width || 0)),
            height: Math.max(0, Number(attachment?.height || 0))
        };
    }

    function getSupportMessagePreview(message) {
        const text = normalizeText(message?.text);
        if (text) return text;

        const attachments = normalizeArray(message?.attachments).map((item) => normalizeSupportAttachment(item)).filter(Boolean);
        if (!attachments.length) return '';
        if (attachments.length === 1) return 'تم إرفاق صورة واحدة.';
        return `تم إرفاق ${attachments.length} صور.`;
    }

    function normalizeSupportMessage(message) {
        const sender = ['user', 'admin', 'bot'].includes(String(message?.sender || '').trim())
            ? String(message.sender).trim()
            : 'user';
        const attachments = normalizeArray(message?.attachments)
            .map((item) => normalizeSupportAttachment(item))
            .filter(Boolean)
            .slice(0, 4);
        const text = normalizeText(message?.text);
        return {
            id: normalizeText(message?.id) || `SUPMSG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            sender,
            senderName: normalizeText(message?.senderName) || (sender === 'admin' ? 'الدعم الإداري' : sender === 'bot' ? 'المساعد الآلي' : 'مستخدم المنصة'),
            text,
            attachments,
            createdAt: message?.createdAt || new Date().toISOString(),
            editedAt: normalizeText(message?.editedAt),
            readByAdminAt: normalizeText(message?.readByAdminAt),
            readByUserAt: normalizeText(message?.readByUserAt),
            deleted: Boolean(message?.deleted)
        };
    }

    function normalizeSupportThread(thread) {
        const email = normalizeText(thread?.email).toLowerCase();
        const messages = normalizeArray(thread?.messages)
            .map((message) => normalizeSupportMessage(message))
            .filter((message) => message.text || message.attachments.length || message.deleted)
            .slice(-120);
        const latestMessage = messages.filter((message) => !message.deleted).slice(-1)[0] || null;

        return {
            id: normalizeText(thread?.id) || email || `SUP-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            email,
            userName: normalizeText(thread?.userName),
            role: normalizeText(thread?.role),
            status: normalizeSupportStatus(thread?.status),
            unreadByAdmin: Math.max(0, Number(thread?.unreadByAdmin || 0)),
            unreadByUser: Math.max(0, Number(thread?.unreadByUser || 0)),
            createdAt: thread?.createdAt || latestMessage?.createdAt || new Date().toISOString(),
            updatedAt: thread?.updatedAt || latestMessage?.createdAt || thread?.createdAt || new Date().toISOString(),
            lastMessagePreview: normalizeText(thread?.lastMessagePreview || getSupportMessagePreview(latestMessage)).slice(0, 180),
            messages
        };
    }

    function getDefaultSupportThreads() {
        return [];
    }

    function getSupportThreads() {
        const map = new Map();
        [...getDefaultSupportThreads(), ...getStoredSupportThreadsRaw()].forEach((thread) => {
            const normalized = normalizeSupportThread(thread);
            if (!normalized.email) return;
            const existing = map.get(normalized.email);
            if (!existing) {
                map.set(normalized.email, normalized);
                return;
            }
            const messages = new Map();
            [...existing.messages, ...normalized.messages].forEach((message) => {
                messages.set(message.id, normalizeSupportMessage(message));
            });
            const mergedMessages = Array.from(messages.values())
                .filter((message) => (message.text || message.attachments.length) && !message.deleted)
                .sort((first, second) => new Date(first.createdAt || 0).getTime() - new Date(second.createdAt || 0).getTime());
            map.set(normalized.email, normalizeSupportThread({
                ...existing,
                ...normalized,
                createdAt: existing.createdAt || normalized.createdAt,
                updatedAt: normalized.updatedAt || existing.updatedAt,
                messages: mergedMessages
            }));
        });
        return Array.from(map.values())
            .filter((thread) => thread.email)
            .sort((first, second) => new Date(second.updatedAt || 0).getTime() - new Date(first.updatedAt || 0).getTime());
    }

    function getSupportThreadByEmail(email) {
        const normalizedEmail = normalizeText(email).toLowerCase();
        if (!normalizedEmail) return null;
        return getSupportThreads().find((thread) => thread.email === normalizedEmail) || null;
    }

    function buildRuntimeState() {
        return {
            applications: getStoredApplications(),
            examHistory: getStoredExamHistory(),
            examClears: getStoredExamClearsRaw(),
            notifications: getStoredNotificationsRaw(),
            supportThreads: getStoredSupportThreadsRaw(),
            settings: getPlatformSettings()
        };
    }

    // وظيفة مراقبة إعدادات المنصة اللحظية
    function setupPlatformListeners() {
        const firebase = getFirebaseApi();
        if (!firebase) {
            if (!platformReadyHooked) {
                platformReadyHooked = true;
                hookFirebaseReady(() => {
                    platformReadyHooked = false;
                    setupPlatformListeners();
                    void refreshFromRemote({ force: true });
                });
            }
            return;
        }

        if (platformFirebaseSubscribed) {
            return;
        }
        platformFirebaseSubscribed = true;

        const { db, ref, onValue } = firebase;
        onValue(ref(db, 'state/platform'), (snapshot) => {
            const data = snapshot.val();
            if (!data) {
                return;
            }

            const normalized = normalizeRuntimeState(data);
            const signature = buildSignature(normalized);
            if (signature !== lastKnownSignature) {
                applyRuntimeState(normalized, { dispatch: true });
                console.log('Platform settings synced from Firebase');
            }
        });
    }

    setupPlatformListeners();

    function buildSignature(state) {
        try {
            return JSON.stringify(state);
        } catch (error) {
            return String(Date.now());
        }
    }

    function dispatchStoreUpdated() {
        const now = Date.now();
        if (pendingDispatchTimer) {
            window.clearTimeout(pendingDispatchTimer);
        }
        if (now - lastDispatchAt < 180) {
            pendingDispatchTimer = window.setTimeout(() => {
                pendingDispatchTimer = null;
                lastDispatchAt = Date.now();
                window.dispatchEvent(new CustomEvent(STORE_EVENT));
            }, 80);
            return;
        }
        lastDispatchAt = now;
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
        const applications = normalizeArray(state?.applications)
            .map((application) => normalizeApplication(application))
            .filter((application) => application.requestId && isAllowedApplicationRecord(application));
        return {
            applications,
            examHistory: normalizeArray(state?.examHistory).filter((attempt) => isAllowedExamRecord(attempt, applications)),
            examClears: normalizeArray(state?.examClears).filter((clearRecord) => isAllowedExamRecord(clearRecord, applications)),
            notifications: normalizeArray(state?.notifications),
            supportThreads: normalizeArray(state?.supportThreads)
                .map((thread) => normalizeSupportThread(thread))
                .filter((thread) => isAllowedSupportThread(thread)),
            settings: normalizeSettings(state?.settings || {})
        };
    }

    function applyRuntimeState(state, options = {}) {
        const normalized = normalizeRuntimeState(state);
        saveStoredApplications(normalized.applications, { silent: true });
        saveExamHistory(normalized.examHistory, { silent: true });
        saveExamClears(normalized.examClears, { silent: true });
        saveNotifications(normalized.notifications, { silent: true });
        saveSupportThreads(normalized.supportThreads, { silent: true });
        savePlatformSettings(normalized.settings, { silent: true });
        lastKnownSignature = buildSignature(normalized);
        if (options.dispatch !== false) dispatchStoreUpdated();
    }

    async function readRemoteState() {
        const firebase = await waitForFirebaseApi();
        if (firebase) {
            try {
                const { db, ref, get } = firebase;
                const snapshot = await get(ref(db, 'state/platform'));
                if (snapshot.exists()) {
                    return normalizeRuntimeState(snapshot.val());
                }
            } catch (error) {
                console.error('Firebase platform read error:', error);
            }
        }

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

    async function syncPlatformToFirebaseDirectly(state) {
        if (!window.QaryaFirebase) return;
        const { db, ref, set, update, runTransaction } = window.QaryaFirebase;
        
        try {
            if (window.QaryaFirebaseAuthReady) {
                await window.QaryaFirebaseAuthReady;
            }
            state = normalizeRuntimeState(state);
            // A transaction prevents one user's exam submission from overwriting
            // an administrator update that happened at the same instant.
            if (typeof runTransaction === 'function') {
                await runTransaction(ref(db, 'state/platform'), (current) => {
                    const remote = normalizeRuntimeState(current || {});
                    return mergeRuntimeStates(remote, state);
                }, { applyLocally: false });
            } else {
                await set(ref(db, 'state/platform'), state);
            }
            await set(ref(db, 'applications'), null);
            await set(ref(db, 'supportThreads'), null);
            
            const updates = {};
            if (Array.isArray(state.applications)) {
                state.applications.forEach(app => {
                    updates[`applications/${app.requestId}`] = app;
                });
            }
            if (Array.isArray(state.notifications)) {
                state.notifications.forEach(note => {
                    updates[`notifications/${note.id}`] = note;
                });
            }
            if (Array.isArray(state.supportThreads)) {
                state.supportThreads.forEach(thread => {
                    updates[`supportThreads/${thread.id}`] = thread;
                });
            }
            if (Object.keys(updates).length > 0) {
                await update(ref(db), updates);
            }
            return true;
        } catch (e) {
            console.error("Platform Firebase Sync Error:", e);
            return false;
        }
    }

    function mergeRuntimeStates(remote, local) {
        const mergeByKey = (left, right, getKey) => {
            const records = new Map();
            [...normalizeArray(left), ...normalizeArray(right)].forEach((record) => {
                const key = getKey(record);
                if (!key) return;
                const existing = records.get(key);
                const existingTime = new Date(existing?.updatedAt || existing?.date || existing?.createdAt || existing?.clearedAt || 0).getTime();
                const nextTime = new Date(record?.updatedAt || record?.date || record?.createdAt || record?.clearedAt || 0).getTime();
                if (!existing || nextTime >= existingTime) records.set(key, record);
            });
            return [...records.values()];
        };
        const applications = mergeByKey(remote.applications, local.applications, (item) => normalizeRequestId(item?.requestId));
        return normalizeRuntimeState({
            applications,
            examHistory: mergeByKey(remote.examHistory, local.examHistory, (item) => item?.id || [normalizeRequestId(item?.requestId), item?.date, item?.examDateKey, item?.percentage].join('|')),
            examClears: mergeByKey(remote.examClears, local.examClears, (item) => normalizeRequestId(item?.requestId)),
            notifications: mergeByKey(remote.notifications, local.notifications, (item) => normalizeText(item?.id)),
            supportThreads: mergeByKey(remote.supportThreads, local.supportThreads, (item) => normalizeText(item?.id) || normalizeEmail(item?.email)),
            settings: new Date(local.settings?.updatedAt || 0).getTime() >= new Date(remote.settings?.updatedAt || 0).getTime() ? local.settings : remote.settings
        });
    }

    async function pushRemoteState() {
        const state = buildRuntimeState();
        const firebaseSynced = await syncPlatformToFirebaseDirectly(state);

        const signature = buildSignature(state);
        if (firebaseSynced) {
            lastKnownSignature = signature;
            return true;
        }
        try {
            const response = await fetch(getApiUrl(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                },
                body: JSON.stringify({ state })
            });
            
            if (!response.ok) {
                console.warn("PHP API push failed, but Firebase was updated.");
                return true;
            }
            
            const data = await response.json();
            if (!data?.ok) return true;
            
            lastKnownSignature = signature;
            return true;
        } catch (error) {
            console.error("Push remote state error:", error);
            return true;
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

        setupPlatformListeners();

        void refreshFromRemote({ force: true });
        window.setInterval(() => {
            if (!getFirebaseApi()) void refreshFromRemote();
        }, REMOTE_POLL_MS);
        window.addEventListener('storage', (event) => {
            if ([APPLICATIONS_KEY, EXAM_HISTORY_KEY, EXAM_CLEARS_KEY, NOTIFICATIONS_KEY, SETTINGS_KEY].includes(event.key)) {
                dispatchStoreUpdated();
            }
        });
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') void refreshFromRemote({ force: true });
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
            studentEmail: normalizeText(application?.studentEmail),
            studentPassword: normalizeText(application?.studentPassword),
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
            if (!normalized.requestId || !isAllowedApplicationRecord(normalized)) return;
            map.set(normalized.requestId, {
                ...normalized,
                source: 'fixed'
            });
        });

        getStoredApplications().forEach((application) => {
            const normalized = normalizeApplication(application);
            if (!normalized.requestId || !isAllowedApplicationRecord(normalized)) return;
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

    function getStudentExamBlockMessage(application) {
        if (!application || application._deleted) return 'هذا الطلب غير مسموح له بدخول الامتحان حاليًا.';
        if (application.examAccess === 'blocked') return application.examAccessReason || 'هذا الطلب ممنوع حاليًا من دخول الامتحان.';
        return canStudentTakeExam(application) ? '' : 'هذا الطلب غير مسموح له بدخول الامتحان حاليًا.';
    }

    function addNotification(note) {
        const stored = getStoredNotificationsRaw();
        const notification = normalizeNotification(note);
        stored.unshift(notification);
        saveNotifications(stored);
        return notification;
    }

    function updateNotification(id, updates) {
        const notificationId = normalizeText(id);
        if (!notificationId) return null;

        const current = getNotifications().find((item) => item.id === notificationId) || { id: notificationId };
        return addNotification({
            ...current,
            ...updates,
            id: notificationId,
            createdAt: current.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }

    function deleteNotification(id) {
        const notificationId = normalizeText(id);
        if (!notificationId) return false;
        addNotification({
            id: notificationId,
            deleted: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        return true;
    }

    function saveSupportThreadRecord(thread, options = {}) {
        const normalized = normalizeSupportThread(thread);
        if (!normalized.email) return null;
        const nextThreads = getSupportThreads().filter((item) => item.email !== normalized.email);
        nextThreads.unshift(normalized);
        saveSupportThreads(nextThreads, options);
        return normalized;
    }

    function sendSupportMessage(payload = {}, options = {}) {
        const email = normalizeText(payload.email).toLowerCase();
        const text = normalizeText(payload.text);
        const attachments = normalizeArray(payload.attachments)
            .map((item) => normalizeSupportAttachment(item))
            .filter(Boolean)
            .slice(0, 4);
        if (!email || (!text && !attachments.length)) return null;

        const existing = getSupportThreadByEmail(email);
        const message = normalizeSupportMessage({
            sender: payload.sender || 'user',
            senderName: payload.senderName || (payload.sender === 'admin' ? 'الدعم الإداري' : payload.userName || 'مستخدم المنصة'),
            text,
            attachments,
            createdAt: payload.createdAt || new Date().toISOString()
        });

        const nextThread = saveSupportThreadRecord({
            ...(existing || {}),
            id: existing?.id || email,
            email,
            userName: payload.userName || existing?.userName || '',
            role: payload.role || existing?.role || '',
            status: payload.status || 'open',
            deletedForUser: false,
            unreadByAdmin: payload.sender === 'user'
                ? Number(existing?.unreadByAdmin || 0) + 1
                : Math.max(0, Number(existing?.unreadByAdmin || 0)),
            unreadByUser: payload.sender === 'admin'
                ? Number(existing?.unreadByUser || 0) + 1
                : Math.max(0, Number(existing?.unreadByUser || 0)),
            createdAt: existing?.createdAt || message.createdAt,
            updatedAt: message.createdAt,
            lastMessagePreview: getSupportMessagePreview(message),
            messages: [...normalizeArray(existing?.messages), message]
        }, options);

        return nextThread;
    }

    function updateSupportMessage(email, messageId, updates = {}, options = {}) {
        const normalizedEmail = normalizeText(email).toLowerCase();
        const normalizedMessageId = normalizeText(messageId);
        const existing = getSupportThreadByEmail(normalizedEmail);
        if (!existing || !normalizedMessageId) return null;

        const now = new Date().toISOString();
        let touched = false;
        const messages = normalizeArray(existing.messages).map((message) => {
            const normalized = normalizeSupportMessage(message);
            if (normalized.id !== normalizedMessageId) return normalized;
            touched = true;
            return normalizeSupportMessage({
                ...normalized,
                ...updates,
                id: normalized.id,
                createdAt: updates.createdAt || normalized.createdAt,
                editedAt: now
            });
        });

        if (!touched) return null;
        const latestMessage = messages.filter((message) => !message.deleted).slice(-1)[0] || null;
        return saveSupportThreadRecord({
            ...existing,
            messages,
            updatedAt: updates.createdAt || latestMessage?.createdAt || now,
            lastMessagePreview: getSupportMessagePreview(latestMessage)
        }, options);
    }

    function deleteSupportMessage(email, messageId, options = {}) {
        return updateSupportMessage(email, messageId, { deleted: true }, options);
    }

    function markSupportThreadRead(email, audience, options = {}) {
        const existing = getSupportThreadByEmail(email);
        if (!existing) return null;
        const readAt = new Date().toISOString();
        const messages = normalizeArray(existing.messages).map((message) => {
            const normalizedMessage = normalizeSupportMessage(message);
            if (audience === 'admin' && normalizedMessage.sender === 'user' && !normalizedMessage.readByAdminAt) {
                return {
                    ...normalizedMessage,
                    readByAdminAt: readAt
                };
            }
            if (audience === 'user' && normalizedMessage.sender !== 'user' && !normalizedMessage.readByUserAt) {
                return {
                    ...normalizedMessage,
                    readByUserAt: readAt
                };
            }
            return normalizedMessage;
        });

        return saveSupportThreadRecord({
            ...existing,
            unreadByAdmin: audience === 'admin' ? 0 : existing.unreadByAdmin,
            unreadByUser: audience === 'user' ? 0 : existing.unreadByUser,
            messages,
            updatedAt: existing.updatedAt
        }, options);
    }

    function deleteSupportThread(email, options = {}) {
        const normalizedEmail = normalizeText(email).toLowerCase();
        if (!normalizedEmail) return false;
        
        const nextThreads = getSupportThreads().filter((item) => item.email !== normalizedEmail);
        saveSupportThreads(nextThreads, options);
        
        // مسح من Firebase إذا كان متاحاً
        if (window.QaryaFirebase) {
            const { db, ref, set } = window.QaryaFirebase;
            const safeEmail = normalizedEmail.replace(/\./g, '_');
            set(ref(db, `support_threads/${safeEmail}`), null).catch(e => console.error("Firebase Support Deletion Error:", e));
        }
        
        return true;
    }

    function updateSupportThreadStatus(email, status, options = {}) {
        const existing = getSupportThreadByEmail(email);
        if (!existing) return null;

        const nextStatus = normalizeSupportStatus(status);
        
        // إذا تم الإغلاق، نضيف علامة "محذوف للمستخدم" بناءً على طلب الإدارة
        const updates = {
            status: nextStatus,
            updatedAt: new Date().toISOString()
        };
        
        if (nextStatus === 'closed') {
            updates.deletedForUser = true;
        } else if (nextStatus === 'open') {
            updates.deletedForUser = false;
        }

        return saveSupportThreadRecord({
            ...existing,
            ...updates
        }, options);
    }

    function getDefaultNotifications() {
        return [
            {
                id: 'eid-adha-2026-gift',
                title: 'تهنئة عيد الأضحى',
                body: 'كل عام وأنتم بخير بمناسبة عيد الأضحى. تمت إضافة 100 EGP لرصيد كل طالب متاح داخل المنصة.',
                type: 'finance',
                createdAt: '2026-05-27T09:00:00+03:00',
                actionUrl: './wallet.html',
                actionLabel: 'فتح المحفظة',
                displayMode: 'banner',
                sticky: false,
                dismissible: true,
                systemKey: 'eid-adha-2026'
            },
            {
                id: 'default-exam-window',
                title: 'مواعيد الامتحان الرسمية',
                body: 'تفتح الامتحانات أيام السبت والأحد والاثنين من 08:00 مساءً إلى 09:00 مساءً بتوقيت مصر.',
                type: 'exam',
                createdAt: '2026-03-01T18:00:00+02:00',
                actionUrl: './exam-status.html',
                actionLabel: 'بوابة الامتحان',
                displayMode: 'feed',
                sticky: true,
                dismissible: false,
                systemKey: 'exam-window'
            },
            {
                id: 'default-reapply-policy',
                title: 'سياسة إعادة التقديم',
                body: 'إعادة التقديم بنفس الرقم القومي متاحة بعد 72 ساعة فقط، ثم يتم حذف الطلب السابق تلقائيًا.',
                type: 'application',
                createdAt: '2026-03-02T12:00:00+02:00',
                actionUrl: './request-policy.html',
                actionLabel: 'سياسة الطلبات',
                displayMode: 'feed',
                sticky: true,
                dismissible: false,
                systemKey: 'reapply-policy'
            },
            {
                id: 'default-payment-note',
                title: 'إشعار الأموال',
                body: 'تم إرسال جميع الأموال إلى القائد على جميع الطلاب. تأكدوا من تفعيل الأدمن لكم حتى تتمكنوا من استلام الدفعات.',
                type: 'finance',
                createdAt: '2026-03-03T14:00:00+02:00',
                actionUrl: './notifications.html',
                actionLabel: 'مركز الإشعارات',
                displayMode: 'feed',
                sticky: false,
                dismissible: true,
                systemKey: 'payment-note'
            }
        ].map((item) => normalizeNotification(item));
    }

    function getNotifications() {
        const map = new Map();
        [...getStoredNotificationsRaw(), ...getDefaultNotifications()].forEach((item) => {
            const normalized = normalizeNotification(item);
            if (!map.has(normalized.id)) map.set(normalized.id, normalized);
        });
        return Array.from(map.values())
            .filter((item) => !item.deleted)
            .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());
    }

    function getAuthApi() {
        return window.QaryaAuth || null;
    }

    function getApplicationRecipientEmail(application) {
        const authApi = getAuthApi();
        if (!application || !authApi) return '';

        const directEmail = authApi.normalizeEmail?.(application.studentEmail || application.email || '') || '';
        if (directEmail) return directEmail;

        const byNationalId = application.nationalId ? authApi.getUserByNationalId?.(application.nationalId) : null;
        if (byNationalId?.email) {
            return authApi.normalizeEmail(byNationalId.email);
        }

        const normalizedRequestId = normalizeRequestId(application.requestId);
        const byRequestId = authApi.getAllUsers?.().find((user) => (
            normalizeRequestId(user.requestId || user.applicationRequestId || '') === normalizedRequestId
        ));

        return authApi.normalizeEmail?.(byRequestId?.email || '') || '';
    }

    function pushApplicationPrivateNotification(application, payload = {}) {
        const authApi = getAuthApi();
        if (!authApi?.pushPrivateNotification) return null;

        const recipientEmail = getApplicationRecipientEmail(application);
        if (!recipientEmail) return null;

        return authApi.pushPrivateNotification(recipientEmail, {
            type: payload.type || 'application',
            displayMode: payload.displayMode || 'floating',
            sticky: payload.sticky === true,
            actionUrl: payload.actionUrl || `./status.html?requestId=${encodeURIComponent(application.requestId || '')}&nationalId=${encodeURIComponent(application.nationalId || '')}`,
            actionLabel: payload.actionLabel || 'فتح حالة الطلب',
            ...payload
        });
    }

    function updateApplicationStatus(requestId, status, message) {
        const updated = updateApplicationDetails(requestId, {
            status: normalizeStatus(status),
            message: message || DEFAULT_STATUS_MESSAGES[normalizeStatus(status)]
        });
        if (!updated) return null;

        pushApplicationPrivateNotification(updated, {
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

        pushApplicationPrivateNotification(updated, {
            title: `ضبط الامتحان ${updated.requestId}`,
            body: `تم تحديث صلاحية الامتحان إلى ${getExamAccessLabel(updated.examAccess)}.${updated.examAccessReason ? ` ${updated.examAccessReason}` : ''}`,
            type: 'exam',
            actionUrl: './status.html?requestId=' + encodeURIComponent(updated.requestId) + '&nationalId=' + encodeURIComponent(updated.nationalId || ''),
            actionLabel: 'فتح الطلب'
        });
        return updated;
    }

    function deleteApplication(requestId, options = {}) {
        const normalized = normalizeRequestId(requestId);
        const application = getApplicationByRequestId(normalized);
        const stored = getStoredApplications().filter((item) => normalizeRequestId(item.requestId) !== normalized);
        stored.unshift({ requestId: normalized, _deleted: true, updatedAt: new Date().toISOString() });
        saveStoredApplications(stored);
        clearExamAttempts(normalized, { silent: true });
        if (!options.silentNotification && application) {
            pushApplicationPrivateNotification(application, {
                title: `حذف سجل ${normalized}`,
                body: `تم حذف بيانات الطلب ${application?.name || normalized} من سجلات المنصة.`,
                type: 'application',
                actionUrl: './notifications.html',
                actionLabel: 'فتح الإشعارات'
            });
        }
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
            const application = getApplicationByRequestId(normalized);
            if (application) {
                pushApplicationPrivateNotification(application, {
                    title: `إعادة ضبط الامتحان ${normalized}`,
                    body: 'تم تصفير سجل الامتحان وإتاحة بدء دورة جديدة لطلبك.',
                    type: 'exam',
                    actionUrl: './exam-status.html',
                    actionLabel: 'بوابة الامتحان'
                });
            }
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
        const touchedMaintenance = Object.prototype.hasOwnProperty.call(updates || {}, 'maintenanceMode')
            || Object.prototype.hasOwnProperty.call(updates || {}, 'maintenanceMessage');
        addNotification({
            title: touchedMaintenance ? 'تحديث وضع الصيانة' : 'تحديث إعدادات المنصة',
            body: touchedMaintenance
                ? (nextSettings.maintenanceMode
                    ? `تم تفعيل وضع الصيانة على المنصة.${nextSettings.maintenanceMessage ? ` ${nextSettings.maintenanceMessage}` : ''}`
                    : 'تم إيقاف وضع الصيانة وعودة المنصة للعمل بشكل طبيعي.')
                : `تم ضبط وضع الامتحان العام على ${nextSettings.examMode === 'open' ? 'فتح يدوي' : nextSettings.examMode === 'closed' ? 'إيقاف يدوي' : 'الجدول الرسمي'}.${nextSettings.examModeMessage ? ` ${nextSettings.examModeMessage}` : ''}`,
            type: 'update',
            actionUrl: touchedMaintenance ? './index.html' : './exam-status.html',
            actionLabel: touchedMaintenance ? 'فتح المنصة' : 'عرض البوابة'
        });
        return nextSettings;
    }

    function normalizeUserExamAttempt(user, attempt = {}) {
        const requestId = normalizeRequestId(
            attempt.requestId
            || attempt.applicationRequestId
            || user?.lastExamAttemptRequestId
            || user?.lastExamRewardRequestId
            || user?.requestId
            || user?.applicationRequestId
        );
        const date = attempt.date || user?.lastExamAttemptAt || user?.lastExamRewardAt || '';
        if (!requestId || !date) return null;

        const application = getApplicationByRequestId(requestId);
        const percentage = Number(attempt.percentage ?? user?.lastExamAttemptPercentage ?? user?.lastExamRewardPercentage ?? 50);
        const total = Number(attempt.total || 100);
        const score = Number(attempt.score ?? Math.round((Math.max(0, Math.min(100, percentage)) / 100) * total));
        const passed = typeof attempt.passed === 'boolean'
            ? attempt.passed
            : (typeof user?.lastExamAttemptPassed === 'boolean' ? user.lastExamAttemptPassed : true);
        const rewardAmount = Number(attempt.rewardAmount || (user?.lastExamRewardAt ? 100 : 0));

        return {
            requestId,
            name: normalizeText(attempt.name) || application?.name || user?.name || 'طالب المنصة',
            nationalId: normalizeText(attempt.nationalId) || application?.nationalId || user?.nationalId || '',
            studentEmail: normalizeEmail(attempt.studentEmail || application?.studentEmail || user?.email || ''),
            leaderCode: normalizeText(attempt.leaderCode) || application?.leaderCode || user?.leaderCode || '',
            governorate: normalizeText(attempt.governorate) || application?.governorate || user?.governorate || '',
            city: normalizeText(attempt.city) || application?.city || user?.city || '',
            village: normalizeText(attempt.village) || application?.village || user?.village || '',
            age: attempt.age || application?.age || user?.age || '',
            gender: normalizeText(attempt.gender) || application?.gender || user?.gender || '',
            examLevel: normalizeText(attempt.examLevel) || (Number(application?.age || user?.age || 0) >= 18 ? 'senior' : 'junior'),
            day: normalizeText(attempt.day),
            score,
            total,
            percentage: Number.isFinite(percentage) ? percentage : 50,
            passed,
            date,
            examDateKey: normalizeText(attempt.examDateKey) || getEgyptDateKey(date),
            approved: attempt.approved !== false,
            passThreshold: Number(attempt.passThreshold || 50),
            rewardAmount,
            rewardGrantedAt: attempt.rewardGrantedAt || user?.lastExamRewardAt || '',
            rewardStatus: normalizeText(attempt.rewardStatus) || (rewardAmount > 0 ? 'granted' : 'recovered'),
            rewardEmail: normalizeEmail(attempt.rewardEmail || user?.email || ''),
            walletBalanceAfter: attempt.walletBalanceAfter ?? null,
            source: attempt.source || (attempt.requestId ? 'user-account' : 'wallet-reward')
        };
    }

    function getUserExamAttempts() {
        const authApi = getAuthApi();
        const users = typeof authApi?.getAllUsers === 'function' ? authApi.getAllUsers() : [];
        return normalizeArray(users).flatMap((user) => {
            const attempts = normalizeArray(user?.examAttempts)
                .map((attempt) => normalizeUserExamAttempt(user, attempt))
                .filter(Boolean);

            if (!attempts.length && (user?.lastExamRewardAt || user?.lastExamAttemptAt)) {
                const recovered = normalizeUserExamAttempt(user, {});
                if (recovered) attempts.push(recovered);
            }

            return attempts;
        }).filter((attempt) => isAllowedExamRecord(attempt));
    }

    function mergeExamAttemptLists(...lists) {
        const map = new Map();
        lists.flat().forEach((attempt) => {
            const normalizedRequestId = normalizeRequestId(attempt?.requestId);
            if (!normalizedRequestId) return;
            const key = [
                normalizedRequestId,
                attempt?.examDateKey || getEgyptDateKey(attempt?.date),
                attempt?.date || '',
                attempt?.percentage ?? ''
            ].join('::');
            if (!map.has(key)) {
                map.set(key, { ...attempt, requestId: normalizedRequestId });
            }
        });
        return Array.from(map.values())
            .sort((first, second) => new Date(second.date || 0).getTime() - new Date(first.date || 0).getTime());
    }

    function getExamHistory() {
        return mergeExamAttemptLists(
            filterExamHistory(getStoredExamHistory()),
            filterExamHistory(getUserExamAttempts())
        );
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
            examDateKey: attempt.examDateKey || '',
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

    function getExamAttemptDateKey(attempt) {
        return String(attempt?.examDateKey || '').trim() || getEgyptDateKey(attempt?.date);
    }

    function getExamAttemptsByRequestIdAndDate(requestId, dateValue = Date.now()) {
        const targetDateKey = getEgyptDateKey(dateValue);
        if (!targetDateKey) return [];
        return getAllExamAttemptsByRequestId(requestId).filter((attempt) => getExamAttemptDateKey(attempt) === targetDateKey);
    }

    function hasExamAttemptOnDate(requestId, dateValue = Date.now()) {
        return getExamAttemptsByRequestIdAndDate(requestId, dateValue).length > 0;
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
        const examBlockMessage = getStudentExamBlockMessage(application);
        return [
            { key: 'submitted', title: 'تم إرسال الطلب', state: 'done', date: application?.createdAt || '', text: 'تم تسجيل البيانات وحفظ الطلب داخل المنصة.' },
            { key: 'review', title: 'قيد المراجعة', state: status === 'pending' ? 'current' : 'done', date: application?.updatedAt || application?.createdAt || '', text: 'تتم الآن مراجعة البيانات والتحقق من مطابقة الطلب.' },
            { key: 'decision', title: status === 'accepted' ? 'تمت الموافقة على الطلب' : status === 'rejected' ? 'تم رفض الطلب' : 'بانتظار القرار النهائي', state: status === 'pending' ? 'pending' : status === 'accepted' ? 'done is-success' : 'done is-danger', date: status === 'pending' ? '' : (application?.updatedAt || application?.createdAt || ''), text: status === 'accepted' ? 'الطلب أصبح معتمدًا ويمكن متابعة المراحل التالية.' : status === 'rejected' ? 'تم حفظ قرار الرفض الحالي داخل سجل الطلب.' : 'سيظهر القرار النهائي هنا بعد انتهاء المراجعة.' },
            { key: 'exam', title: latestAttempt ? 'تم تسجيل أداء الامتحان' : (canStudentTakeExam(application) ? 'الطلب جاهز للامتحان' : 'بوابة الامتحان غير متاحة بعد'), state: latestAttempt ? 'done' : (canStudentTakeExam(application) ? 'current' : 'pending'), date: latestAttempt?.date || '', text: latestAttempt ? `آخر نتيجة مسجلة ${latestAttempt.percentage || 0}% بتاريخ ${latestAttempt.date ? new Date(latestAttempt.date).toLocaleString('ar-EG') : ''}.` : canStudentTakeExam(application) ? 'يمكن للطالب دخول بوابة الامتحان وفق الضبط الحالي.' : (examBlockMessage || 'لم يتم السماح لهذا الطلب بدخول الامتحان بعد.') }
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

    function getStateSnapshot() {
        return normalizeRuntimeState(buildRuntimeState());
    }

    function replacePlatformState(state, options = {}) {
        applyRuntimeState(state, { dispatch: options.dispatch !== false });
        if (options.skipNotify !== true) {
            notifyChanged();
        }
        return getStateSnapshot();
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
        getStudentExamBlockMessage,
        getNotifications,
        addNotification,
        updateNotification,
        deleteNotification,
        getSupportThreads,
        getSupportThreadByEmail,
        sendSupportMessage,
        updateSupportMessage,
        deleteSupportMessage,
        markSupportThreadRead,
        updateSupportThreadStatus,
        deleteSupportThread,
        getExamHistory,
        saveExamHistory,
        getExamHistoryByRequestId,
        getAllExamAttemptsByRequestId,
        getExamAttemptsByRequestIdAndDate,
        hasExamAttemptOnDate,
        getLatestExamAttempt,
        getExamSummary,
        buildApplicationTimeline,
        getDashboardMetrics,
        getPlatformSettings,
        savePlatformSettings,
        updatePlatformSettings,
        getStateSnapshot,
        replacePlatformState,
        notifyChanged,
        refreshFromRemote,
        syncNow
    };

    window.dispatchEvent(new CustomEvent('qarya:platform-store-ready'));
})();
