(() => {
    const ACTIVITY_KEY = 'qaryaeduAdminActivityLogs';
    const ARCHIVES_KEY = 'qaryaeduAdminArchives';
    const STUDENT_FILES_KEY = 'qaryaeduStudentFiles';
    const STORE_EVENT = 'qarya:admin-advanced-updated';
    const REMOTE_POLL_MS = 4000;

    let syncTimeoutId = null;
    let syncInFlight = null;
    let remotePollStarted = false;
    let lastKnownSignature = '';
    let firebaseSubscribed = false;
    let readyHooked = false;

    function parseJson(value, fallback) {
        try {
            return JSON.parse(value || '');
        } catch (error) {
            return fallback;
        }
    }

    function normalizeText(value) {
        return String(value || '').trim();
    }

    function normalizeArray(value) {
        return Array.isArray(value) ? value : [];
    }

    function buildId(prefix) {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }

    function normalizeActivityLog(item = {}) {
        return {
            id: normalizeText(item.id) || buildId('ACT'),
            actorEmail: normalizeText(item.actorEmail).toLowerCase(),
            actorName: normalizeText(item.actorName) || 'إدارة المنصة',
            action: normalizeText(item.action) || 'update',
            area: normalizeText(item.area) || 'platform',
            targetType: normalizeText(item.targetType) || 'record',
            targetId: normalizeText(item.targetId),
            summary: normalizeText(item.summary) || 'تم تنفيذ إجراء إداري.',
            details: item.details && typeof item.details === 'object' ? item.details : {},
            createdAt: item.createdAt || new Date().toISOString(),
            deleted: Boolean(item.deleted)
        };
    }

    function normalizeArchiveItem(item = {}) {
        return {
            id: normalizeText(item.id) || buildId('ARC'),
            type: normalizeText(item.type) || 'record',
            title: normalizeText(item.title) || 'عنصر مؤرشف',
            description: normalizeText(item.description),
            actorEmail: normalizeText(item.actorEmail).toLowerCase(),
            actorName: normalizeText(item.actorName),
            createdAt: item.createdAt || new Date().toISOString(),
            sourceId: normalizeText(item.sourceId),
            payload: item.payload && typeof item.payload === 'object' ? item.payload : {},
            deleted: Boolean(item.deleted)
        };
    }

    function normalizeStudentFile(file = {}) {
        return {
            id: normalizeText(file.id) || buildId('FILE'),
            requestId: normalizeText(file.requestId).toUpperCase(),
            fileName: normalizeText(file.fileName) || 'ملف بدون اسم',
            category: normalizeText(file.category) || 'other',
            mimeType: normalizeText(file.mimeType) || 'application/octet-stream',
            size: Math.max(0, Number(file.size || 0)),
            content: normalizeText(file.content),
            note: normalizeText(file.note),
            uploadedBy: normalizeText(file.uploadedBy),
            uploadedByName: normalizeText(file.uploadedByName),
            createdAt: file.createdAt || new Date().toISOString(),
            updatedAt: file.updatedAt || file.createdAt || new Date().toISOString(),
            deleted: Boolean(file.deleted)
        };
    }

    function getStoredActivityLogsRaw() {
        return normalizeArray(parseJson(localStorage.getItem(ACTIVITY_KEY), []));
    }

    function saveStoredActivityLogs(logs, options = {}) {
        localStorage.setItem(ACTIVITY_KEY, JSON.stringify(
            normalizeArray(logs)
                .map((item) => normalizeActivityLog(item))
                .slice(0, 1000)
        ));
        if (!options.silent) notifyChanged();
    }

    function getStoredArchivesRaw() {
        return normalizeArray(parseJson(localStorage.getItem(ARCHIVES_KEY), []));
    }

    function saveStoredArchives(items, options = {}) {
        localStorage.setItem(ARCHIVES_KEY, JSON.stringify(
            normalizeArray(items)
                .map((item) => normalizeArchiveItem(item))
                .slice(0, 600)
        ));
        if (!options.silent) notifyChanged();
    }

    function getStoredStudentFilesRaw() {
        return normalizeArray(parseJson(localStorage.getItem(STUDENT_FILES_KEY), []));
    }

    function saveStoredStudentFiles(files, options = {}) {
        localStorage.setItem(STUDENT_FILES_KEY, JSON.stringify(
            normalizeArray(files)
                .map((item) => normalizeStudentFile(item))
                .slice(0, 800)
        ));
        if (!options.silent) notifyChanged();
    }

    function buildState() {
        return {
            activityLogs: getStoredActivityLogsRaw(),
            archives: getStoredArchivesRaw(),
            studentFiles: getStoredStudentFilesRaw()
        };
    }

    function normalizeState(state) {
        return {
            activityLogs: normalizeArray(state?.activityLogs).map((item) => normalizeActivityLog(item)),
            archives: normalizeArray(state?.archives).map((item) => normalizeArchiveItem(item)),
            studentFiles: normalizeArray(state?.studentFiles).map((item) => normalizeStudentFile(item))
        };
    }

    function buildSignature(state) {
        try {
            return JSON.stringify(state);
        } catch (error) {
            return String(Date.now());
        }
    }

    function dispatchUpdated() {
        window.dispatchEvent(new CustomEvent(STORE_EVENT));
    }

    function applyState(state, options = {}) {
        const normalized = normalizeState(state);
        saveStoredActivityLogs(normalized.activityLogs, { silent: true });
        saveStoredArchives(normalized.archives, { silent: true });
        saveStoredStudentFiles(normalized.studentFiles, { silent: true });
        lastKnownSignature = buildSignature(normalized);
        if (options.dispatch !== false) {
            dispatchUpdated();
        }
    }

    function scheduleRemoteSync() {
        if (syncTimeoutId) {
            clearTimeout(syncTimeoutId);
        }
        syncTimeoutId = window.setTimeout(() => {
            syncTimeoutId = null;
            void syncNow();
        }, 350);
    }

    function notifyChanged(options = {}) {
        dispatchUpdated();
        if (!options.skipRemote) {
            scheduleRemoteSync();
        }
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

    function setupFirebaseListeners() {
        const firebase = getFirebaseApi();
        if (!firebase) {
            if (!readyHooked) {
                readyHooked = true;
                hookFirebaseReady(() => {
                    readyHooked = false;
                    setupFirebaseListeners();
                    void refreshFromRemote({ force: true });
                });
            }
            return;
        }

        if (firebaseSubscribed) {
            return;
        }
        firebaseSubscribed = true;

        const { db, ref, onValue } = firebase;
        onValue(ref(db, 'state/adminAdvanced'), (snapshot) => {
            const data = snapshot.val();
            if (!data) {
                return;
            }
            const normalized = normalizeState(data);
            const signature = buildSignature(normalized);
            if (signature !== lastKnownSignature) {
                applyState(normalized, { dispatch: true });
            }
        });
    }

    async function readRemoteState() {
        const firebase = await waitForFirebaseApi();
        if (!firebase) {
            return null;
        }

        try {
            const { db, ref, get } = firebase;
            const snapshot = await get(ref(db, 'state/adminAdvanced'));
            if (snapshot.exists()) {
                return normalizeState(snapshot.val());
            }
        } catch (error) {
            console.error('Admin advanced read error:', error);
        }

        return null;
    }

    async function pushRemoteState() {
        const firebase = await waitForFirebaseApi();
        if (!firebase) {
            return false;
        }

        try {
            if (window.QaryaFirebaseAuthReady) {
                await window.QaryaFirebaseAuthReady;
            }
            const { db, ref, set } = firebase;
            const state = normalizeState(buildState());
            await set(ref(db, 'state/adminAdvanced'), state);
            lastKnownSignature = buildSignature(state);
            return true;
        } catch (error) {
            console.error('Admin advanced sync error:', error);
            return false;
        }
    }

    async function syncNow() {
        if (syncTimeoutId) {
            clearTimeout(syncTimeoutId);
            syncTimeoutId = null;
        }

        if (syncInFlight) {
            return syncInFlight;
        }

        syncInFlight = (async () => {
            const pushed = await pushRemoteState();
            if (pushed) {
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
        const state = await readRemoteState();
        if (!state) return false;
        const signature = buildSignature(state);
        if (options.force || signature !== lastKnownSignature) {
            applyState(state, { dispatch: true });
        }
        return true;
    }

    function initRemoteSync() {
        if (remotePollStarted) return;
        remotePollStarted = true;
        lastKnownSignature = buildSignature(normalizeState(buildState()));
        setupFirebaseListeners();
        void refreshFromRemote({ force: true });
        window.setInterval(() => {
            void refreshFromRemote();
        }, REMOTE_POLL_MS);
    }

    function getActivityLogs() {
        return getStoredActivityLogsRaw()
            .map((item) => normalizeActivityLog(item))
            .filter((item) => !item.deleted)
            .sort((first, second) => new Date(second.createdAt || 0).getTime() - new Date(first.createdAt || 0).getTime());
    }

    function addActivityLog(item = {}) {
        const next = normalizeActivityLog(item);
        saveStoredActivityLogs([next, ...getStoredActivityLogsRaw()]);
        return next;
    }

    function clearActivityLogs() {
        saveStoredActivityLogs([]);
        return true;
    }

    function getArchives(type = '') {
        const normalizedType = normalizeText(type);
        return getStoredArchivesRaw()
            .map((item) => normalizeArchiveItem(item))
            .filter((item) => !item.deleted)
            .filter((item) => !normalizedType || item.type === normalizedType)
            .sort((first, second) => new Date(second.createdAt || 0).getTime() - new Date(first.createdAt || 0).getTime());
    }

    function addArchiveItem(item = {}) {
        const next = normalizeArchiveItem(item);
        saveStoredArchives([next, ...getStoredArchivesRaw()]);
        return next;
    }

    function deleteArchiveItem(id) {
        const archiveId = normalizeText(id);
        if (!archiveId) return false;
        const next = getStoredArchivesRaw().filter((item) => normalizeText(item.id) !== archiveId);
        saveStoredArchives(next);
        return true;
    }

    function getStudentFiles(requestId = '') {
        const normalizedRequestId = normalizeText(requestId).toUpperCase();
        return getStoredStudentFilesRaw()
            .map((item) => normalizeStudentFile(item))
            .filter((item) => !item.deleted)
            .filter((item) => !normalizedRequestId || item.requestId === normalizedRequestId)
            .sort((first, second) => new Date(second.updatedAt || second.createdAt || 0).getTime() - new Date(first.updatedAt || first.createdAt || 0).getTime());
    }

    function upsertStudentFile(file = {}) {
        const next = normalizeStudentFile({
            ...file,
            updatedAt: new Date().toISOString(),
            createdAt: file.createdAt || new Date().toISOString()
        });
        if (!next.requestId || !next.content) {
            return null;
        }
        const all = getStoredStudentFilesRaw().filter((item) => !(normalizeText(item.requestId).toUpperCase() === next.requestId && normalizeText(item.id) === next.id));
        all.unshift(next);
        saveStoredStudentFiles(all);
        return next;
    }

    function deleteStudentFile(requestId, fileId) {
        const normalizedRequestId = normalizeText(requestId).toUpperCase();
        const normalizedFileId = normalizeText(fileId);
        const next = getStoredStudentFilesRaw().filter((item) => !(
            normalizeText(item.requestId).toUpperCase() === normalizedRequestId
            && normalizeText(item.id) === normalizedFileId
        ));
        saveStoredStudentFiles(next);
        return true;
    }

    function getStateSnapshot() {
        return normalizeState(buildState());
    }

    function replaceState(state, options = {}) {
        applyState(state, { dispatch: false });
        if (options.skipNotify !== true) {
            notifyChanged();
        }
        return getStateSnapshot();
    }

    initRemoteSync();

    window.QaryaAdminAdvancedStore = {
        storeEventName: STORE_EVENT,
        getActivityLogs,
        addActivityLog,
        clearActivityLogs,
        getArchives,
        addArchiveItem,
        deleteArchiveItem,
        getStudentFiles,
        upsertStudentFile,
        deleteStudentFile,
        getStateSnapshot,
        replaceState,
        refreshFromRemote,
        syncNow
    };
})();
