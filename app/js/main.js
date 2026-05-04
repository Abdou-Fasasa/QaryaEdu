document.addEventListener('DOMContentLoaded', () => {
    const authApi = window.QaryaAuth || null;
    const store = window.QaryaPlatformStore || null;
    const authSession = authApi ? authApi.getSession() : null;
    const siteHeader = document.querySelector('.header');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebarClose = document.getElementById('sidebar-close');
    const siteSidebar = document.getElementById('site-sidebar');
    const sidebarNav = siteSidebar ? siteSidebar.querySelector('.sidebar-nav') : null;
    const sidebarLinks = siteSidebar ? Array.from(siteSidebar.querySelectorAll('.sidebar-link')) : [];
    const mainNav = document.getElementById('main-nav');
    const navLinks = mainNav ? Array.from(mainNav.querySelectorAll('.nav-link')) : [];
    const notificationBanner = document.querySelector('.important-notification');
    const closeBannerBtn = notificationBanner ? notificationBanner.querySelector('.close-btn') : null;
    const modal = document.getElementById('important-modal');
    const closeModalBtn = document.getElementById('close-important-modal');
    const faqButtons = Array.from(document.querySelectorAll('[data-faq-question]'));
    const copyButtons = Array.from(document.querySelectorAll('[data-copy-target]'));
    const countElements = Array.from(document.querySelectorAll('[data-count-to]'));
    const currentFile = getCurrentFileName();
    const overlay = createOverlay();
    const serviceDropdowns = [];
    const SUPPORT_GUEST_KEY = 'qaryaeduSupportGuestProfile';
    const DISMISSED_NOTIFICATIONS_KEY = 'qaryaeduDismissedNotifications';
    const SUPPORT_FAQ = [
        { question: 'متى يفتح الامتحان؟', answer: 'بوابة الامتحان تعمل حسب الضبط الحالي للمنصة. في الوضع العادي تفتح حسب الجدول الرسمي، ويمكن للإدارة أيضًا فتحها أو إيقافها يدويًا.' },
        { question: 'كيف أتابع حالة الطلب؟', answer: 'من قسم خدمات الطالب اختر حالة الطلب، ثم اكتب رقم الطلب والرقم القومي لعرض آخر تحديث مسجل على طلبك.' },
        { question: 'متى أستطيع إعادة التقديم؟', answer: 'إعادة التقديم بنفس الرقم القومي تصبح متاحة بعد مرور 72 ساعة، ثم يحذف الطلب السابق تلقائيًا عند حفظ الطلب الجديد.' },
        { question: 'أين أجد الإشعارات؟', answer: 'كل الإشعارات العامة والخاصة تظهر في مركز الإشعارات، وتظهر الردود الإدارية المرتبطة بالدعم هناك أيضًا.' }
    ];
    let supportWidget = null;
    let supportPanel = null;
    let supportBadge = null;
    let supportHomeView = null;
    let supportFaqView = null;
    let supportChatView = null;
    let supportFaqAnswer = null;
    let supportMessages = null;
    let supportEmpty = null;
    let supportComposer = null;
    let supportGuestFields = null;
    let supportGuestNameInput = null;
    let supportGuestEmailInput = null;
    let supportInput = null;
    let supportSendBtn = null;
    let supportAttachmentInput = null;
    let supportAttachmentPreview = null;
    let supportAttachmentCounter = null;
    let supportAttachmentHint = null;
    let pendingSupportAttachments = [];
    let supportView = 'home';
    let supportSubmitInFlight = false;
    let platformStoreReadyPromise = null;
    const runtimeSeenNotifications = new Map();
    let runtimeNotificationsSeeded = false;
    let managedNotificationSurfaceSignature = '';

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getStoreApi() {
        return window.QaryaPlatformStore || store || null;
    }

    function getPlatformStorePath() {
        return window.location.pathname.includes('/pages/')
            ? '../js/platform-store.js?v=20260418-2'
            : './js/platform-store.js?v=20260418-2';
    }

    async function ensurePlatformStoreReady(timeoutMs = 4500) {
        const currentStore = getStoreApi();
        if (currentStore) return currentStore;
        if (platformStoreReadyPromise) return platformStoreReadyPromise;

        platformStoreReadyPromise = new Promise((resolve) => {
            let settled = false;

            const finish = () => {
                if (settled) return;
                const readyStore = getStoreApi();
                if (!readyStore) return;
                settled = true;
                cleanup();
                resolve(readyStore);
            };

            const fallbackFinish = () => {
                if (settled) return;
                settled = true;
                cleanup();
                resolve(getStoreApi());
            };

            const cleanup = () => {
                window.removeEventListener('qarya:platform-store-ready', finish);
                window.removeEventListener('qarya:store-updated', finish);
                if (timeoutId) {
                    window.clearTimeout(timeoutId);
                }
            };

            const timeoutId = window.setTimeout(fallbackFinish, timeoutMs);

            window.addEventListener('qarya:platform-store-ready', finish);
            window.addEventListener('qarya:store-updated', finish);

            const existingScript = Array.from(document.querySelectorAll('script[src]')).find((script) => (
                String(script.src || '').includes('platform-store.js')
            ));

            if (!existingScript) {
                const script = document.createElement('script');
                script.src = getPlatformStorePath();
                script.dataset.qaryaAutoPlatformStore = 'true';
                script.addEventListener('load', finish, { once: true });
                script.addEventListener('error', fallbackFinish, { once: true });
                document.body.appendChild(script);
            }

            finish();
        }).finally(() => {
            if (getStoreApi()) {
                platformStoreReadyPromise = Promise.resolve(getStoreApi());
            } else {
                platformStoreReadyPromise = null;
            }
        });

        return platformStoreReadyPromise;
    }

    function getLiveSession() {
        return authApi?.getSession?.() || authSession || null;
    }

    function normalizeGuestEmail(value) {
        return String(value || '').trim().toLowerCase();
    }

    function readSupportGuestProfile() {
        try {
            const stored = JSON.parse(localStorage.getItem(SUPPORT_GUEST_KEY) || '{}');
            const email = normalizeGuestEmail(stored?.email);
            const name = String(stored?.name || '').trim();
            if (!email || !name) return null;
            return { email, name };
        } catch (error) {
            return null;
        }
    }

    function saveSupportGuestProfile(name, email) {
        localStorage.setItem(SUPPORT_GUEST_KEY, JSON.stringify({
            name: String(name || '').trim(),
            email: normalizeGuestEmail(email)
        }));
    }

    async function waitForStoreApi(timeoutMs = 4000) {
        return await ensurePlatformStoreReady(timeoutMs);
    }

    function getSupportThreadsLocalRaw() {
        try {
            const parsed = JSON.parse(localStorage.getItem('qaryaeduSupportThreads') || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }

    function saveSupportThreadsLocalRaw(threads) {
        localStorage.setItem('qaryaeduSupportThreads', JSON.stringify(Array.isArray(threads) ? threads.slice(0, 80) : []));
        window.dispatchEvent(new CustomEvent('qarya:store-updated', { detail: { source: 'support-fallback' } }));
    }

    function normalizeSupportAttachmentLocal(attachment = {}) {
        const src = String(attachment.src || '').trim();
        if (!src) return null;

        return {
            id: String(attachment.id || `SUPATT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`).trim(),
            type: String(attachment.type || 'image').trim() || 'image',
            name: String(attachment.name || 'attachment').trim() || 'attachment',
            mimeType: String(attachment.mimeType || 'image/jpeg').trim() || 'image/jpeg',
            src,
            size: Math.max(0, Number(attachment.size || 0)),
            width: Math.max(0, Number(attachment.width || 0)),
            height: Math.max(0, Number(attachment.height || 0))
        };
    }

    function getSupportMessagePreviewLocal(message = {}) {
        const text = String(message.text || '').trim();
        if (text) return text;

        const attachments = (Array.isArray(message.attachments) ? message.attachments : [])
            .map((item) => normalizeSupportAttachmentLocal(item))
            .filter(Boolean);
        if (!attachments.length) return '';
        if (attachments.length === 1) return 'تم إرفاق صورة واحدة.';
        return `تم إرفاق ${attachments.length} صور.`;
    }

    function normalizeSupportMessageLocal(message = {}) {
        const sender = ['user', 'admin', 'bot'].includes(String(message.sender || '').trim())
            ? String(message.sender).trim()
            : 'user';
        const attachments = (Array.isArray(message.attachments) ? message.attachments : [])
            .map((item) => normalizeSupportAttachmentLocal(item))
            .filter(Boolean)
            .slice(0, 4);
        return {
            id: String(message.id || `SUPMSG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`).trim(),
            sender,
            senderName: String(message.senderName || (sender === 'admin' ? 'الدعم الإداري' : sender === 'bot' ? 'المساعد الآلي' : 'مستخدم المنصة')).trim(),
            text: String(message.text || '').trim(),
            attachments,
            createdAt: message.createdAt || new Date().toISOString(),
            readByAdminAt: String(message.readByAdminAt || '').trim(),
            readByUserAt: String(message.readByUserAt || '').trim(),
            deleted: Boolean(message.deleted)
        };
    }

    function normalizeSupportThreadLocal(thread = {}) {
        const email = normalizeGuestEmail(thread.email || '');
        const messages = (Array.isArray(thread.messages) ? thread.messages : [])
            .map((message) => normalizeSupportMessageLocal(message))
            .filter((message) => (message.text || message.attachments.length) && !message.deleted)
            .slice(-120);
        const latestMessage = messages[messages.length - 1] || null;

        return {
            id: String(thread.id || email || `SUP-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`).trim(),
            email,
            userName: String(thread.userName || '').trim(),
            role: String(thread.role || '').trim(),
            status: String(thread.status || '').trim() === 'closed' ? 'closed' : 'open',
            unreadByAdmin: Math.max(0, Number(thread.unreadByAdmin || 0)),
            unreadByUser: Math.max(0, Number(thread.unreadByUser || 0)),
            createdAt: thread.createdAt || latestMessage?.createdAt || new Date().toISOString(),
            updatedAt: thread.updatedAt || latestMessage?.createdAt || new Date().toISOString(),
            lastMessagePreview: String(thread.lastMessagePreview || getSupportMessagePreviewLocal(latestMessage) || '').trim(),
            deletedForUser: Boolean(thread.deletedForUser),
            messages
        };
    }

    function getSupportFallbackApi() {
        return {
            getSupportThreadByEmail(email) {
                const normalizedEmail = normalizeGuestEmail(email);
                if (!normalizedEmail) return null;
                const match = getSupportThreadsLocalRaw()
                    .map((thread) => normalizeSupportThreadLocal(thread))
                    .find((thread) => thread.email === normalizedEmail);
                return match || null;
            },
            sendSupportMessage(payload = {}) {
                const email = normalizeGuestEmail(payload.email || '');
                const text = String(payload.text || '').trim();
                const attachments = (Array.isArray(payload.attachments) ? payload.attachments : [])
                    .map((item) => normalizeSupportAttachmentLocal(item))
                    .filter(Boolean)
                    .slice(0, 4);
                if (!email || (!text && !attachments.length)) return null;

                const existingThreads = getSupportThreadsLocalRaw().map((thread) => normalizeSupportThreadLocal(thread));
                const existing = existingThreads.find((thread) => thread.email === email) || null;
                const message = normalizeSupportMessageLocal({
                    sender: payload.sender || 'user',
                    senderName: payload.senderName || (payload.sender === 'admin' ? 'الدعم الإداري' : payload.userName || 'مستخدم المنصة'),
                    text,
                    attachments,
                    createdAt: payload.createdAt || new Date().toISOString()
                });

                const nextThread = normalizeSupportThreadLocal({
                    ...(existing || {}),
                    id: existing?.id || email,
                    email,
                    userName: payload.userName || existing?.userName || '',
                    role: payload.role || existing?.role || '',
                    status: payload.status || 'open',
                    unreadByAdmin: payload.sender === 'user'
                        ? Number(existing?.unreadByAdmin || 0) + 1
                        : Math.max(0, Number(existing?.unreadByAdmin || 0)),
                    unreadByUser: payload.sender === 'admin'
                        ? Number(existing?.unreadByUser || 0) + 1
                        : Math.max(0, Number(existing?.unreadByUser || 0)),
                    createdAt: existing?.createdAt || message.createdAt,
                    updatedAt: message.createdAt,
                    deletedForUser: false,
                    lastMessagePreview: getSupportMessagePreviewLocal(message),
                    messages: [...(existing?.messages || []), message]
                });

                const nextThreads = existingThreads.filter((thread) => thread.email !== email);
                nextThreads.unshift(nextThread);
                saveSupportThreadsLocalRaw(nextThreads);
                return nextThread;
            },
            markSupportThreadRead(email, audience) {
                const normalizedEmail = normalizeGuestEmail(email);
                if (!normalizedEmail) return null;
                const existingThreads = getSupportThreadsLocalRaw().map((thread) => normalizeSupportThreadLocal(thread));
                const existing = existingThreads.find((thread) => thread.email === normalizedEmail);
                if (!existing) return null;
                const readAt = new Date().toISOString();

                const nextThread = normalizeSupportThreadLocal({
                    ...existing,
                    messages: (existing.messages || []).map((message) => {
                        const normalizedMessage = normalizeSupportMessageLocal(message);
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
                    }),
                    unreadByAdmin: audience === 'admin' ? 0 : existing.unreadByAdmin,
                    unreadByUser: audience === 'user' ? 0 : existing.unreadByUser
                });

                const nextThreads = existingThreads.filter((thread) => thread.email !== normalizedEmail);
                nextThreads.unshift(nextThread);
                saveSupportThreadsLocalRaw(nextThreads);
                return nextThread;
            },
            syncNow: async () => true,
            storeEventName: 'qarya:store-updated'
        };
    }

    function getSupportStoreApi() {
        const storeApi = getStoreApi();
        if (storeApi?.sendSupportMessage && storeApi?.getSupportThreadByEmail && storeApi?.markSupportThreadRead) {
            return storeApi;
        }
        return getSupportFallbackApi();
    }

    function getDismissedNotificationsMap() {
        try {
            const parsed = JSON.parse(localStorage.getItem(DISMISSED_NOTIFICATIONS_KEY) || '{}');
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (error) {
            return {};
        }
    }

    function saveDismissedNotificationsMap(map) {
        localStorage.setItem(DISMISSED_NOTIFICATIONS_KEY, JSON.stringify(map || {}));
    }

    function getNotificationDismissKey(note) {
        const audience = String(note?.audience || 'global').trim() || 'global';
        const recipient = normalizeGuestEmail(note?.recipientEmail || 'all-users');
        const version = String(note?.updatedAt || note?.createdAt || '').trim();
        return `${audience}:${recipient}:${String(note?.id || '').trim()}:${version}`;
    }

    function isNotificationDismissed(note) {
        if (!note || note.sticky) return false;
        const key = getNotificationDismissKey(note);
        return Boolean(getDismissedNotificationsMap()[key]);
    }

    function dismissNotificationLocally(note) {
        if (!note) return;
        const next = getDismissedNotificationsMap();
        next[getNotificationDismissKey(note)] = new Date().toISOString();
        saveDismissedNotificationsMap(next);
    }

    function resolvePlatformUrl(url) {
        const value = String(url || '').trim();
        if (!value) return '';
        if (/^(https?:|mailto:|tel:|#|\/)/i.test(value)) return value;
        if (value.startsWith('../') || value.startsWith('./')) {
            if (window.location.pathname.includes('/pages/')) {
                return value;
            }
            if (value.startsWith('./')) {
                return `./pages/${value.slice(2)}`;
            }
            return value.replace(/^\.\.\//, './');
        }
        return window.location.pathname.includes('/pages/') ? `./${value}` : `./pages/${value.replace(/^\.?\//, '')}`;
    }

    function getNotificationTimestamp(value) {
        const time = new Date(value || '').getTime();
        return Number.isFinite(time) && time > 0 ? time : 0;
    }

    function isNotificationActive(note) {
        if (!note) return false;

        const now = Date.now();
        const startAt = getNotificationTimestamp(note.startAt || note.createdAt);
        const endAt = getNotificationTimestamp(note.endAt);

        if (startAt && startAt > now) return false;
        if (endAt && endAt <= now) return false;
        return true;
    }

    function isSensitiveGlobalUserNotification(note) {
        const liveSession = getLiveSession();
        if (!note || note.audience === 'private') return false;
        if (authApi?.isAdminSession?.(liveSession)) return false;

        const title = String(note.title || '').trim();
        const actionUrl = String(note.actionUrl || '').trim();

        return (
            actionUrl.includes('status.html?requestId=')
            || (/عملية السحب/.test(title) && actionUrl.includes('wallet.html'))
            || /^تحديث الطلب/.test(title)
            || /^ضبط الامتحان/.test(title)
            || /^حذف سجل/.test(title)
            || /^إعادة ضبط الامتحان/.test(title)
        );
    }

    function getRuntimeNotificationKey(note) {
        const audience = String(note?.audience || 'global').trim() || 'global';
        const recipient = normalizeGuestEmail(note?.recipientEmail || 'all-users');
        return `${audience}:${recipient}:${String(note?.id || '').trim()}`;
    }

    function getRuntimeNotificationVersion(note) {
        return String(note?.updatedAt || note?.createdAt || '').trim() || String(Date.now());
    }

    function buildManagedNotificationSurfaceSignature(notes) {
        return notes
            .filter((note) => note.displayMode === 'banner' || note.displayMode === 'floating')
            .slice(0, 4)
            .map((note, index) => [
                note.displayMode || 'feed',
                getRuntimeNotificationKey(note),
                getRuntimeNotificationVersion(note),
                String(index)
            ].join('|'))
            .join('||');
    }

    function getVisibleUserNotifications() {
        const storeApi = getStoreApi();
        const liveSession = getLiveSession();
        const globalNotes = (storeApi?.getNotifications?.() || []).map((note) => ({
            ...note,
            audience: 'global'
        }));
        const privateNotes = (liveSession && authApi?.canReceivePrivateNotifications?.(liveSession.email))
            ? (authApi.getPrivateNotifications(liveSession.email) || []).map((note) => ({
                ...note,
                audience: 'private',
                recipientEmail: liveSession.email,
                recipientName: liveSession.name || ''
            }))
            : [];

        return [...privateNotes, ...globalNotes]
            .filter((note) => !note.deleted && isNotificationActive(note) && !isNotificationDismissed(note) && !isSensitiveGlobalUserNotification(note))
            .sort((first, second) => (
                getNotificationTimestamp(second.updatedAt || second.createdAt || 0)
                - getNotificationTimestamp(first.updatedAt || first.createdAt || 0)
            ));
    }

    function syncRealtimeNotificationState(options = {}) {
        const seedOnly = options.seedOnly === true || !runtimeNotificationsSeeded;
        const visibleNotes = getVisibleUserNotifications();
        const nextState = new Map();

        visibleNotes.forEach((note) => {
            const key = getRuntimeNotificationKey(note);
            const version = getRuntimeNotificationVersion(note);
            const previousVersion = runtimeSeenNotifications.get(key);

            nextState.set(key, version);

            if (seedOnly) {
                return;
            }

            if (!previousVersion || previousVersion === version) {
                return;
            }

            showLiveNotification(note.title, note.body, null, {
                actionUrl: note.actionUrl,
                actionLabel: note.actionLabel || 'فتح التفاصيل',
                iconClass: note.type === 'support' ? 'fa-comment-dots' : 'fa-bell'
            });
        });

        if (!seedOnly) {
            visibleNotes.forEach((note) => {
                const key = getRuntimeNotificationKey(note);
                if (!runtimeSeenNotifications.has(key)) {
                    showLiveNotification(note.title, note.body, null, {
                        actionUrl: note.actionUrl,
                        actionLabel: note.actionLabel || 'فتح التفاصيل',
                        iconClass: note.type === 'support' ? 'fa-comment-dots' : 'fa-bell'
                    });
                }
            });
        }

        runtimeSeenNotifications.clear();
        nextState.forEach((value, key) => runtimeSeenNotifications.set(key, value));
        runtimeNotificationsSeeded = true;
    }

    function clearManagedNotificationSurfaces() {
        document.querySelectorAll('[data-managed-notification="banner"], [data-managed-notification="floating"]').forEach((element) => element.remove());
    }

    function renderManagedNotificationSurfaces() {
        const notes = getVisibleUserNotifications();
        const signature = buildManagedNotificationSurfaceSignature(notes);

        if (!signature) {
            if (managedNotificationSurfaceSignature) {
                clearManagedNotificationSurfaces();
                managedNotificationSurfaceSignature = '';
            }
            return;
        }

        if (signature === managedNotificationSurfaceSignature) {
            return;
        }

        clearManagedNotificationSurfaces();
        managedNotificationSurfaceSignature = signature;

        const bannerNote = notes.find((note) => note.displayMode === 'banner');
        if (bannerNote) {
            const prefix = getPrefix();
            const banner = document.createElement('div');
            banner.className = 'holiday-banner managed-notification-surface';
            banner.dataset.managedNotification = 'banner';
            banner.innerHTML = `
                <div class="holiday-banner-content">
                    <div class="holiday-banner-icon"><i class="fas fa-bullhorn"></i></div>
                    <div class="holiday-banner-text">
                        <h3>${escapeHtml(bannerNote.title)}</h3>
                        <p>${escapeHtml(bannerNote.body)}</p>
                    </div>
                    <div class="holiday-banner-actions">
                        ${bannerNote.actionUrl ? `<a href="${resolvePlatformUrl(bannerNote.actionUrl)}" class="btn-festive">${escapeHtml(bannerNote.actionLabel || 'فتح التفاصيل')}</a>` : ''}
                        <button class="holiday-banner-close-btn btn-ghost" type="button">إغلاق</button>
                        <button class="holiday-banner-close" type="button" aria-label="إغلاق">&times;</button>
                    </div>
                </div>
            `;
            
            const closeBanner = () => {
                dismissNotificationLocally(bannerNote);
                managedNotificationSurfaceSignature = '';
                renderManagedNotificationSurfaces();
            };

            banner.querySelector('.holiday-banner-close')?.addEventListener('click', closeBanner);
            banner.querySelector('.holiday-banner-close-btn')?.addEventListener('click', closeBanner);
            document.body.prepend(banner);
        }

        const floatingNotes = notes.filter((note) => note.displayMode === 'floating').slice(0, 3);
        floatingNotes.forEach((note, index) => {
            const notification = document.createElement('div');
            notification.className = 'floating-notification managed-notification-surface';
            notification.dataset.managedNotification = 'floating';
            notification.style.bottom = `${2.75 + (index * 6.3)}rem`;
            notification.innerHTML = `
                <div class="floating-notification-content">
                    <div class="floating-notification-icon">
                        <i class="fas ${note.type === 'support' ? 'fa-comment-dots' : 'fa-bell'}"></i>
                    </div>
                    <div class="floating-notification-text">
                        <strong>${escapeHtml(note.title)}</strong>
                        <p>${escapeHtml(note.body)}</p>
                        <div class="floating-notification-actions">
                            ${note.actionUrl ? `<a href="${resolvePlatformUrl(note.actionUrl)}" class="btn-primary btn-xs">${escapeHtml(note.actionLabel || 'فتح')}</a>` : ''}
                            <button class="btn-ghost btn-xs" type="button">إغلاق</button>
                        </div>
                    </div>
                </div>
                <button class="floating-notification-close" type="button">&times;</button>
            `;

            const closeManagedNotification = () => {
                dismissNotificationLocally(note);
                managedNotificationSurfaceSignature = '';
                renderManagedNotificationSurfaces();
            };

            notification.querySelector('.floating-notification-close')?.addEventListener('click', closeManagedNotification);
            notification.querySelector('.btn-ghost')?.addEventListener('click', closeManagedNotification);
            document.body.appendChild(notification);
        });
    }

    function getSupportIdentity() {
        const liveSession = authApi?.getSession?.() || authSession;
        if (liveSession?.email) {
            return {
                email: normalizeGuestEmail(liveSession.email),
                name: String(liveSession.name || 'مستخدم المنصة').trim(),
                role: String(liveSession.role || 'مستخدم المنصة').trim(),
                authenticated: true
            };
        }

        const guest = readSupportGuestProfile();
        if (!guest) return null;
        return {
            email: guest.email,
            name: guest.name,
            role: 'زائر المنصة',
            authenticated: false
        };
    }

    function getCurrentUserData() {
        const liveSession = authApi?.getSession?.() || authSession;
        if (!authApi || !liveSession?.email) return null;
        return authApi.getUserByEmail(liveSession.email) || liveSession;
    }

    function canShowWallet() {
        const userData = getCurrentUserData();
        return Boolean(authApi?.canAccessWallet?.(userData || authSession));
    }

    function canReceivePrivateCloudNotifications() {
        const userData = getCurrentUserData();
        return Boolean(authApi?.canReceivePrivateNotifications?.(userData || authSession));
    }

    function isExamOnlySession() {
        const userData = getCurrentUserData();
        return Boolean(authApi?.isExamOnlyUser?.(userData || authSession));
    }

    if (enforceMaintenanceMode()) {
        return;
    }

    function formatBalance(value) {
        return `${Number(value || 0).toLocaleString('en-US')} EGP`;
    }

    pruneRestrictedNavigation();
    injectHeaderServiceDropdown();
    injectLeaderAdminLink();
    injectStudentHubLink();
    injectSettingsIcon();
    injectAuthSummary();
    injectSidebarExtras();
    checkComplaintNotification();
    checkBalanceNotification();
    handleSpecialLoginNotif();
    handleHolidayGiftAndNotif();
    handleCloudNotifications();
    updateActiveLinks();
    updateHeaderState();
    initCounters();
    initFaqs();
    initCopyButtons();
    initRevealAnimations();
    bindDropdowns();
    bindAuthActions();
    function handleUserUpdateEvent() {
        // إعادة بناء عناصر الواجهة التي تعتمد على صلاحيات المستخدم
        updateHeaderState();
        injectAuthSummary();
        injectLeaderAdminLink();
        injectStudentHubLink();
        injectSettingsIcon();
        injectSidebarExtras();
        pruneRestrictedNavigation();
        updateActiveLinks();
    }

    // BroadcastChannel for real-time admin updates
    if (typeof BroadcastChannel === 'function') {
        window.userUpdateChannel = new BroadcastChannel('qaryaedu-admin-update');
        window.userUpdateChannel.onmessage = (e) => {
            if (e.data.type === 'user-updated') {
                const liveSession = getLiveSession();
                if (liveSession && authApi?.normalizeEmail(e.data.email) === authApi?.normalizeEmail(liveSession.email)) {
                    handleDataUpdate({ detail: { source: 'broadcast-sync' } });
                }
            } else if (e.data.type === 'transactions-updated') {
                handleDataUpdate({ detail: { source: 'transactions-sync' } });
            }
        };
    }

    window.addEventListener(authApi?.storeEventName || 'qarya_auth_store_updated', (event) => {
        if (event.detail?.source === 'user-data-update' || event.detail?.source === 'role-change') {
            handleUserUpdateEvent();
        }
    });

    window.addEventListener('qarya_user_data_updated', (event) => {
        const liveSession = getLiveSession();
        if (liveSession && authApi?.normalizeEmail(event.detail?.email) === authApi?.normalizeEmail(liveSession.email)) {
            handleUserUpdateEvent();
        }
    });

    injectSupportWidget();
    void (async () => {
        const storeApi = await waitForStoreApi();
        await Promise.allSettled([
            storeApi?.refreshFromRemote?.({ force: true }),
            authApi?.refreshFromRemote?.({ force: true })
        ]);
        syncRealtimeNotificationState({ seedOnly: true });
    })();

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => setSidebarState(true));
    }

    if (sidebarClose) {
        sidebarClose.addEventListener('click', () => setSidebarState(false));
    }

    if (overlay) {
        overlay.addEventListener('click', () => setSidebarState(false));
    }

    [...navLinks, ...sidebarLinks].forEach((link) => {
        link.addEventListener('click', () => setSidebarState(false));
    });

    document.addEventListener('click', (event) => {
        serviceDropdowns.forEach((dropdown) => {
            if (!dropdown.contains(event.target)) {
                dropdown.removeAttribute('open');
            }
        });
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            setSidebarState(false);
            serviceDropdowns.forEach((dropdown) => dropdown.removeAttribute('open'));
            if (modal) {
                modal.style.display = 'none';
            }
        }
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 900) {
            setSidebarState(false);
        }
    });

    if (closeBannerBtn && notificationBanner) {
        closeBannerBtn.addEventListener('click', () => {
            notificationBanner.style.display = 'none';
        });
    }

    if (modal && closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    window.addEventListener('scroll', updateHeaderState, { passive: true });
    // وظيفة لتحديث الواجهة عند حدوث تغيير في البيانات
    function handleDataUpdate(e) {
        if (enforceMaintenanceMode()) {
            return;
        }

        // إظهار إشعار بسيط للأدمن عند التحديث اللحظي من السيرفر
        if (e.detail?.source === 'firebase-sync' && authApi && authApi.isAdminSession(authApi.getSession())) {
            showToast('تم تحديث البيانات من السيرفر لحظياً', 'info');
        }

        if (typeof renderSidebar === 'function') renderSidebar();
        injectAuthSummary();
        pruneRestrictedNavigation();
        injectLeaderAdminLink();
        injectStudentHubLink();
        if (typeof updateBalanceDisplays === 'function') updateBalanceDisplays();
        if (typeof renderNotifications === 'function') renderNotifications();
        renderManagedNotificationSurfaces();
        syncRealtimeNotificationState();
        if (supportWidget) {
            renderSupportWidget();
        }
        
        // تحديث بيانات الجلسة
        const currentSession = getLiveSession();
        if (currentSession && currentSession.email) {
            const freshUser = authApi.getUserByEmail(currentSession.email);
            if (freshUser && canShowWallet()) {
                const balanceStr = formatBalance(freshUser.balance);
                const headerBalance = document.querySelector('.header-balance-chip span');
                const sidebarBalance = document.querySelector('.sidebar-balance-card strong');
                if (headerBalance) headerBalance.textContent = balanceStr;
                if (sidebarBalance) sidebarBalance.textContent = balanceStr;
            }
        }
    }

    // الاستماع لحدث تحديث البيانات من Firebase
    window.addEventListener(authApi?.storeEventName || 'qarya_auth_store_updated', handleDataUpdate);
    window.addEventListener(getStoreApi()?.storeEventName || 'qarya:store-updated', handleDataUpdate);
    window.addEventListener('qarya:platform-store-ready', handleDataUpdate);
    window.addEventListener('qarya_platform_store_updated', handleDataUpdate);
    window.addEventListener('qarya_user_data_updated', handleDataUpdate);

    // فحص دوري للتأكد من مزامنة الجلسة (كل 10 ثواني)
    setInterval(() => {
        if (authApi) {
            const session = authApi.getSession();
            if (session) {
                const fresh = authApi.getUserByEmail(session.email);
                if (fresh && JSON.stringify(fresh) !== JSON.stringify(session)) {
                    handleDataUpdate({ detail: { source: 'auto-sync' } });
                }
            }
        }
    }, 10000);

    function getCurrentFileName() {
        return window.location.pathname.replace(/\\/g, '/').split('/').pop() || 'index.html';
    }

    function getHomePath() {
        return window.location.pathname.includes('/pages/') ? '../index.html' : './index.html';
    }

    function getPrefix() {
        return window.location.pathname.includes('/pages/') ? './' : './pages/';
    }

    function getLoginPath() {
        return window.location.pathname.includes('/pages/') ? '../login.html' : './login.html';
    }

    function getMaintenanceState() {
        const storeApi = getStoreApi();
        if (storeApi?.getPlatformSettings) {
            const settings = storeApi.getPlatformSettings();
            return {
                active: Boolean(settings?.maintenanceMode),
                message: String(settings?.maintenanceMessage || 'جاري الآن صيانة الموقع. يرجى المحاولة لاحقًا.').trim()
            };
        }
        return authApi?.getMaintenanceState?.() || { active: false, message: '' };
    }

    function enforceMaintenanceMode() {
        const liveSession = getLiveSession();
        if (!authApi || !liveSession) return false;
        const maintenance = getMaintenanceState();
        if (!maintenance.active || authApi.isAdminSession(liveSession)) {
            return false;
        }

        authApi.logout?.();
        window.location.replace(`${getLoginPath()}?maintenance=1&message=${encodeURIComponent(maintenance.message || 'جاري الآن صيانة الموقع. يرجى المحاولة لاحقًا.')}`);
        return true;
    }

    function getSupportThreadForCurrentUser() {
        const storeApi = getSupportStoreApi();
        const identity = getSupportIdentity();
        if (!storeApi?.getSupportThreadByEmail || !identity?.email) return null;
        const thread = storeApi.getSupportThreadByEmail(identity.email);
        
        // إخفاء المحادثة عن المستخدم إذا كانت مغلقة أو معلمة كحذف للمستخدم بناءً على طلب الإدارة
        if (thread && (thread.deletedForUser || thread.status === 'closed')) {
            return null;
        }
        
        return thread;
    }

    function getAdminRecipients() {
        if (!authApi?.getAllUsers) return [];
        return authApi.getAllUsers()
            .filter((user) => authApi.isAdminSession?.(user.email))
            .map((user) => user.email);
    }

    async function notifyAdminsAboutSupportMessage(text, senderName) {
        const recipients = getAdminRecipients();
        if (!recipients.length) return;
        await Promise.all(recipients.map((email) => authApi.pushPrivateNotification?.(email, {
            title: `رسالة دعم جديدة من ${senderName || authSession?.name || 'مستخدم المنصة'}`,
            body: text,
            type: 'support',
            actionUrl: './leader-admin.html',
            actionLabel: 'فتح لوحة الإدارة'
        })));
    }

    async function markSupportThreadReadForUser() {
        const storeApi = (await waitForStoreApi(4500)) || getSupportStoreApi();
        const identity = getSupportIdentity();
        if (!storeApi?.markSupportThreadRead || !identity?.email) return;
        const thread = getSupportThreadForCurrentUser();
        if (!thread || Number(thread.unreadByUser || 0) <= 0) return;
        storeApi.markSupportThreadRead(identity.email, 'user');
        await storeApi.syncNow?.();
    }

    function pruneRestrictedNavigation() {
        const walletAllowed = canShowWallet();
        const leaderAllowed = isLeaderSession() || isAdminSession();
        const examOnly = isExamOnlySession();

        document.querySelectorAll('a[href*="wallet.html"]').forEach((link) => {
            link.style.display = walletAllowed ? '' : 'none';
        });
        document.querySelectorAll('[data-wallet-only="true"]').forEach((element) => {
            element.style.display = walletAllowed ? '' : 'none';
        });

        if (!leaderAllowed) {
            document.querySelectorAll('a[href*="leader-admin.html"], a[href*="students-hub.html"], a[href*="student-editor.html"]').forEach((link) => {
                link.style.display = 'none';
            });
        } else {
            document.querySelectorAll('a[href*="leader-admin.html"], a[href*="students-hub.html"], a[href*="student-editor.html"]').forEach((link) => {
                link.style.display = '';
            });
        }

        if (examOnly) {
            document.querySelectorAll('a[href*="dashboard.html"]').forEach((link) => {
                link.style.display = 'none';
            });
        } else {
            document.querySelectorAll('a[href*="dashboard.html"]').forEach((link) => {
                link.style.display = '';
            });
        }
    }

    function getUserInitial() {
        const liveSession = getLiveSession();
        if (!liveSession || !liveSession.name) return 'ق';
        const parts = String(liveSession.name).trim().split(/\s+/).filter(Boolean);
        return (parts[0] || 'ق').charAt(0);
    }

    function isAdminSession() {
        return Boolean(authApi?.isAdminSession?.(getLiveSession()));
    }

    function isLeaderSession() {
        return Boolean(authApi?.isLeader?.(getLiveSession()?.email));
    }

    function injectLeaderAdminLink() {
        if (!isLeaderSession() && !isAdminSession()) return;

        const prefix = getPrefix();
        const linkHref = `${prefix}leader-admin.html`;
        
        // Add to main nav
        if (mainNav && !mainNav.querySelector(`a[href*="leader-admin.html"]`)) {
            const adminLink = document.createElement('a');
            adminLink.href = linkHref;
            adminLink.className = 'nav-link';
            adminLink.innerHTML = '<i class="fas fa-user-shield"></i> لوحة القائد';
            mainNav.appendChild(adminLink);
        }

        // Add to sidebar
        if (sidebarNav && !sidebarNav.querySelector(`a[href*="leader-admin.html"]`)) {
            const adminLink = document.createElement('a');
            adminLink.href = linkHref;
            adminLink.className = 'sidebar-link';
            adminLink.innerHTML = '<i class="fas fa-user-shield"></i> <span>لوحة تحكم القائد</span>';
            
            // Insert after home link if possible
            const homeLink = sidebarNav.querySelector('a[href*="index.html"]');
            if (homeLink) {
                homeLink.insertAdjacentElement('afterend', adminLink);
            } else {
                sidebarNav.prepend(adminLink);
            }
        }
    }

    function injectStudentHubLink() {
        if (!isLeaderSession() && !isAdminSession()) return;

        const prefix = getPrefix();
        const linkHref = `${prefix}students-hub.html`;

        if (mainNav && !mainNav.querySelector(`a[href*="students-hub.html"]`)) {
            const studentsLink = document.createElement('a');
            studentsLink.href = linkHref;
            studentsLink.className = 'nav-link';
            studentsLink.innerHTML = '<i class="fas fa-users-viewfinder"></i> مركز الطلاب';

            const adminLink = mainNav.querySelector(`a[href*="leader-admin.html"]`);
            if (adminLink) {
                adminLink.insertAdjacentElement('afterend', studentsLink);
            } else {
                mainNav.appendChild(studentsLink);
            }
        }

        if (sidebarNav && !sidebarNav.querySelector(`a[href*="students-hub.html"]`)) {
            const studentsLink = document.createElement('a');
            studentsLink.href = linkHref;
            studentsLink.className = 'sidebar-link';
            studentsLink.innerHTML = '<i class="fas fa-users-viewfinder"></i> <span>مركز الطلاب</span>';

            const adminLink = sidebarNav.querySelector(`a[href*="leader-admin.html"]`);
            if (adminLink) {
                adminLink.insertAdjacentElement('afterend', studentsLink);
            } else {
                sidebarNav.prepend(studentsLink);
            }
        }
    }

    function createOverlay() {
        let element = document.getElementById('page-overlay');
        if (!element) {
            element = document.createElement('div');
            element.id = 'page-overlay';
            element.className = 'page-overlay';
            document.body.appendChild(element);
        }
        return element;
    }

    function setSidebarState(isOpen) {
        if (!siteSidebar) return;
        siteSidebar.classList.toggle('open', isOpen);
        overlay.classList.toggle('open', isOpen);
        document.body.classList.toggle('nav-open', isOpen);
    }

    function injectHeaderServiceDropdown() {
        if (!mainNav || mainNav.querySelector('[data-nav-dropdown="student-services"]')) {
            return;
        }

        const prefix = getPrefix();
        const serviceLinks = [
            { href: `${prefix}exam-status.html`, icon: 'fa-pen-to-square', label: 'الامتحان' },
            { href: `${prefix}status.html`, icon: 'fa-magnifying-glass', label: 'حالة الطلب' },
            { href: `${prefix}verification.html`, icon: 'fa-file-circle-check', label: 'التحقق من الأداء' },
            { href: `${prefix}complaints.html`, icon: 'fa-comment-dots', label: 'تقديم شكوى' }
        ];
        const removableFiles = new Set(['exam-status.html', 'status.html', 'verification.html', 'complaints.html']);

        Array.from(mainNav.querySelectorAll('a[href]')).forEach((link) => {
            const href = link.getAttribute('href') || '';
            const fileName = href.split('?')[0].split('#')[0].split('/').pop() || '';
            if (removableFiles.has(fileName)) {
                link.remove();
            }
        });

        const isActive = removableFiles.has(currentFile);
        const dropdown = document.createElement('details');
        dropdown.className = `nav-dropdown${isActive ? ' active' : ''}`;
        dropdown.dataset.navDropdown = 'student-services';
        dropdown.innerHTML = `
            <summary class="nav-dropdown-toggle${isActive ? ' active' : ''}">
                <span>خدمات الطالب</span>
                <i class="fas fa-chevron-down"></i>
            </summary>
            <div class="nav-dropdown-menu">
                ${serviceLinks.map((item) => `
                    <a href="${item.href}" class="nav-dropdown-link${currentFile === item.href.split('/').pop() ? ' active' : ''}">
                        <i class="fas ${item.icon}"></i>
                        <span>${item.label}</span>
                    </a>
                `).join('')}
            </div>
        `;

        const registerLink = Array.from(mainNav.querySelectorAll('a[href]')).find((link) => {
            const href = link.getAttribute('href') || '';
            return href.split('?')[0].split('#')[0].split('/').pop() === 'register.html';
        });

        if (registerLink) {
            registerLink.insertAdjacentElement('afterend', dropdown);
        } else {
            mainNav.appendChild(dropdown);
        }

        serviceDropdowns.push(dropdown);
    }

    function bindDropdowns() {
        serviceDropdowns.forEach((dropdown) => {
            dropdown.querySelectorAll('a').forEach((link) => {
                link.addEventListener('click', () => {
                    dropdown.removeAttribute('open');
                });
            });
        });
    }

    function injectSettingsIcon() {
        if (!authSession) return;
        const headerContainer = siteHeader ? siteHeader.querySelector('.container') : null;
        if (!headerContainer || headerContainer.querySelector('.header-settings-link')) return;

        const prefix = getPrefix();
        const settingsLink = document.createElement('a');
        settingsLink.href = `${prefix}settings.html`;
        settingsLink.className = 'header-settings-link';
        settingsLink.innerHTML = '<i class="fas fa-cog"></i>';
        settingsLink.title = 'إعدادات الحساب';

        // Insert before logout button if exists, or append
        const logoutBtn = headerContainer.querySelector('.header-logout-btn');
        if (logoutBtn) {
            logoutBtn.insertAdjacentElement('beforebegin', settingsLink);
        } else {
            headerContainer.appendChild(settingsLink);
        }
    }

    function handleSpecialLoginNotif() {
        if (!authSession) return;
        const email = authApi.normalizeEmail(authSession.email);
        
        // Use sessionStorage to only send once per session
        const NOTIF_SENT_KEY = `qarya_login_notif_sent_${email}`;
        if (email.includes('monanegm') && !sessionStorage.getItem(NOTIF_SENT_KEY)) {
            if (window.QaryaTelegram) {
                window.QaryaTelegram.sendLoginNotification(authSession.name, authSession.email)
                    .then(() => sessionStorage.setItem(NOTIF_SENT_KEY, 'true'))
                    .catch(err => console.error('Failed to send login notification', err));
            }
        }
    }

    function handleHolidayGiftAndNotif() {
        renderManagedNotificationSurfaces();
        return;
        if (!authSession) return;
        if (!canShowWallet()) return;
        
        const HOLIDAY_NOTIF_KEY = 'qarya_holiday_gift_notif_shown';
        if (sessionStorage.getItem(HOLIDAY_NOTIF_KEY)) return;

        // Apply gift if not already claimed
        const giftApplied = authApi.checkAndApplyHolidayGift(authSession.email);

        setTimeout(() => {
            const prefix = getPrefix();
            const banner = document.createElement('div');
            banner.className = 'holiday-banner';
            
            banner.innerHTML = `
                <div class="holiday-banner-content">
                    <div class="holiday-banner-icon">🌸</div>
                    <div class="holiday-banner-text">
                        <h3>تهنئة بمناسبة شم النسيم! 🎉</h3>
                        <p>نهنئ جميع طلابنا بمناسبة شم النسيم. قررت الإدارة منحكم <strong>1000 EGP</strong> أضيفت لرصيدكم.</p>
                        <p style="font-size: 0.85rem; color: #fff; font-weight: bold; background: rgba(0,0,0,0.2); display: inline-block; padding: 2px 8px; border-radius: 4px; margin-top: 5px;">
                            ⚠️ تنبيه: يتم حذف الأرصدة غير المسحوبة يوم 30 من كل شهر.
                        </p>
                    </div>
                    <div class="holiday-banner-actions">
                        <a href="${prefix}wallet.html" class="btn-festive">سحب الهدية الآن</a>
                        <button class="holiday-banner-close" onclick="this.closest('.holiday-banner').remove()">&times;</button>
                    </div>
                </div>
            `;
            document.body.prepend(banner);
            sessionStorage.setItem(HOLIDAY_NOTIF_KEY, 'true');
        }, 1500);
    }

    function handleCloudNotifications() {
        renderManagedNotificationSurfaces();
        return;
        if (!authSession) return;
        const checkFirebase = setInterval(() => {
            if (window.QaryaFirebase) {
                clearInterval(checkFirebase);
                const { db, ref, onValue, set } = window.QaryaFirebase;
                const encodedEmail = authApi.normalizeEmail(authSession.email).replace(/\./g, '_');

                // 1. Listen for Targeted Notifications
                if (canReceivePrivateCloudNotifications()) {
                    onValue(ref(db, `notifications/${encodedEmail}`), (snapshot) => {
                        const notifs = snapshot.val();
                        if (notifs) {
                            Object.entries(notifs).forEach(([id, n]) => {
                                if (!n.read) {
                                    showLiveNotification(n.title, n.text, () => {
                                        set(ref(db, `notifications/${encodedEmail}/${id}/read`), true);
                                    });
                                }
                            });
                        }
                    });
                }

                // 2. Listen for Global Notifications
                onValue(ref(db, `global_notification`), (snapshot) => {
                    const gn = snapshot.val();
                    if (gn) {
                        const KEY = `qarya_global_notif_${gn.timestamp}`;
                        if (!localStorage.getItem(KEY)) {
                            showLiveNotification(gn.title, gn.text, () => {
                                localStorage.setItem(KEY, 'true');
                            });
                        }
                    }
                });
            }
        }, 1000);
    }

    function showLiveNotification(title, text, onClose, options = {}) {
        const notif = document.createElement('div');
        notif.className = 'floating-notification';
        notif.style.zIndex = '9999';
        notif.innerHTML = `
            <div class="floating-notification-content">
                <div class="floating-notification-icon" style="background: var(--primary-soft); color: var(--primary);">
                    <i class="fas ${escapeHtml(options.iconClass || 'fa-bell')}"></i>
                </div>
                <div class="floating-notification-text">
                    <strong>${escapeHtml(title)}</strong>
                    <p>${escapeHtml(text)}</p>
                    <div class="floating-notification-actions">
                        ${options.actionUrl ? `<a href="${resolvePlatformUrl(options.actionUrl)}" class="btn-primary btn-xs">${escapeHtml(options.actionLabel || 'فتح')}</a>` : ''}
                        <button class="btn-ghost btn-xs floating-notification-close-btn" type="button">إغلاق</button>
                    </div>
                </div>
            </div>
            <button class="floating-notification-close" type="button" aria-label="إغلاق">&times;</button>
        `;
        
        const closeNotif = () => {
            notif.remove();
            if (onClose) onClose();
        };

        notif.querySelector('.floating-notification-close')?.addEventListener('click', closeNotif);
        notif.querySelector('.floating-notification-close-btn')?.addEventListener('click', closeNotif);
        document.body.appendChild(notif);
    }

    function showToast(message) {
        showLiveNotification('تنبيه المنصة', message || 'تم تنفيذ العملية.');
    }

    function getSupportMessageReadLabel(message) {
        if (!message || message.sender !== 'user') return '';
        if (message.readByAdminAt) return 'مقروءة';
        return 'تم الإرسال';
    }

    function setSupportAttachmentHintText(text) {
        if (!supportAttachmentHint) return;
        supportAttachmentHint.textContent = text || 'يمكنك إضافة صور توضيحية مع الرسالة.';
    }

    function renderPendingSupportAttachments() {
        if (!supportAttachmentPreview) return;

        supportAttachmentPreview.hidden = pendingSupportAttachments.length === 0;
        supportAttachmentPreview.innerHTML = pendingSupportAttachments.map((attachment, index) => `
            <div class="support-chat-upload-chip">
                <img src="${attachment.src}" alt="${escapeHtml(attachment.name || `attachment-${index + 1}`)}" />
                <div class="support-chat-upload-copy">
                    <strong>${escapeHtml(attachment.name || `صورة ${index + 1}`)}</strong>
                    <span>${attachment.width > 0 && attachment.height > 0 ? `${attachment.width}×${attachment.height}` : 'صورة مرفقة'}</span>
                </div>
                <button type="button" class="support-chat-upload-remove" data-support-remove-attachment="${attachment.id}" aria-label="حذف الصورة">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');

        if (supportAttachmentCounter) {
            supportAttachmentCounter.hidden = pendingSupportAttachments.length === 0;
            supportAttachmentCounter.textContent = pendingSupportAttachments.length > 9 ? '+9' : String(pendingSupportAttachments.length);
        }

        setSupportAttachmentHintText(
            pendingSupportAttachments.length
                ? `تم تجهيز ${pendingSupportAttachments.length} ${pendingSupportAttachments.length === 1 ? 'صورة' : 'صور'} للإرسال.`
                : ''
        );
    }

    function clearPendingSupportAttachments() {
        pendingSupportAttachments = [];
        if (supportAttachmentInput) {
            supportAttachmentInput.value = '';
        }
        renderPendingSupportAttachments();
    }

    function readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(reader.error || new Error('file-read-failed'));
            reader.readAsDataURL(file);
        });
    }

    function loadImageFromDataUrl(src) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('image-load-failed'));
            image.src = src;
        });
    }

    async function buildSupportAttachmentFromFile(file) {
        const originalSrc = await readFileAsDataUrl(file);
        const image = await loadImageFromDataUrl(originalSrc);
        const maxEdge = 1280;
        const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
        const width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
        const height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        context?.drawImage(image, 0, 0, width, height);

        let src = canvas.toDataURL('image/jpeg', 0.84);
        if (src.length > 650000) {
            src = canvas.toDataURL('image/jpeg', 0.72);
        }

        return normalizeSupportAttachmentLocal({
            id: `SUPATT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: 'image',
            name: file.name || 'image.jpg',
            mimeType: 'image/jpeg',
            src,
            size: Number(file.size || 0),
            width,
            height
        });
    }

    async function appendSupportAttachments(files) {
        const nextFiles = Array.from(files || []).filter((file) => String(file?.type || '').startsWith('image/'));
        if (!nextFiles.length) {
            showLiveNotification('الدعم الإداري', 'يرجى اختيار صورة صحيحة بصيغة مدعومة.');
            return;
        }

        const availableSlots = Math.max(0, 3 - pendingSupportAttachments.length);
        if (availableSlots <= 0) {
            showLiveNotification('الدعم الإداري', 'يمكن إرفاق 3 صور كحد أقصى في الرسالة الواحدة.');
            return;
        }

        const prepared = await Promise.all(nextFiles.slice(0, availableSlots).map((file) => buildSupportAttachmentFromFile(file)));
        pendingSupportAttachments = [...pendingSupportAttachments, ...prepared.filter(Boolean)].slice(0, 3);
        renderPendingSupportAttachments();
    }

    function buildSupportAttachmentMarkup(attachments, className) {
        const safeAttachments = (Array.isArray(attachments) ? attachments : [])
            .map((item) => normalizeSupportAttachmentLocal(item))
            .filter(Boolean);
        if (!safeAttachments.length) return '';

        return `
            <div class="${className}-attachments">
                ${safeAttachments.map((attachment, index) => `
                    <a class="${className}-attachment" href="${attachment.src}" target="_blank" rel="noreferrer" aria-label="فتح الصورة ${index + 1}">
                        <img src="${attachment.src}" alt="${escapeHtml(attachment.name || `attachment-${index + 1}`)}" loading="lazy" />
                    </a>
                `).join('')}
            </div>
        `;
    }

    function setSupportView(view) {
        supportView = ['home', 'faq', 'chat'].includes(view) ? view : 'home';
        renderSupportWidget();
    }

    function focusSupportField(field) {
        if (!field) return;
        field.disabled = false;
        field.removeAttribute('aria-disabled');
        window.setTimeout(() => {
            try {
                field.focus({ preventScroll: true });
            } catch (_) {
                field.focus();
            }
        }, 24);
    }

    function getSupportEmptyMarkup(identity, hasMessages) {
        if (hasMessages) return '';
        if (!identity?.email) {
            return '<strong>الدعم الإداري</strong><p>اكتب الاسم والبريد الإلكتروني ثم أرسل رسالتك مباشرة إلى الإدارة. الخدمة متاحة الآن لجميع الزوار والمستخدمين.</p>';
        }
        if (!identity.authenticated) {
            return '<strong>الدعم الإداري</strong><p>يمكنك متابعة نفس المحادثة من هذا الجهاز باستخدام البريد الذي أدخلته، وستظهر ردود الإدارة هنا مباشرة.</p>';
        }
        return '<strong>الدعم الإداري</strong><p>لم تبدأ أي محادثة بعد. اكتب رسالتك وسيتم إرسالها مباشرة إلى الإدارة.</p>';
    }

    function setSupportComposerState(storeApi) {
        if (!supportComposer) return;
        const canSend = Boolean(storeApi?.sendSupportMessage) && !supportSubmitInFlight;

        supportComposer.hidden = false;
        supportComposer.querySelectorAll('textarea, input').forEach((field) => {
            field.disabled = false;
            field.readOnly = false;
            field.removeAttribute('aria-disabled');
        });

        if (supportSendBtn) {
            supportSendBtn.disabled = !canSend || (!String(supportInput?.value || '').trim() && pendingSupportAttachments.length === 0);
            supportSendBtn.setAttribute('aria-disabled', String(supportSendBtn.disabled));
            supportSendBtn.classList.toggle('is-loading', supportSubmitInFlight);
        }

        if (supportAttachmentInput) {
            supportAttachmentInput.disabled = !canSend;
        }
    }

    async function submitSupportMessage() {
        if (supportSubmitInFlight) return;
        supportSubmitInFlight = true;
        setSupportComposerState(getSupportStoreApi());

        try {
            const storeApi = (await waitForStoreApi(5000)) || getSupportStoreApi();
            if (!storeApi?.sendSupportMessage) {
                showLiveNotification('الدعم الإداري', 'تعذر إرسال الرسالة الآن. حاول مرة أخرى بعد ثوانٍ.');
                return;
            }

            const text = String(supportInput?.value || '').trim();
            const attachments = pendingSupportAttachments.slice(0, 3);
            if (!text && !attachments.length) {
                focusSupportField(supportInput);
                return;
            }

            let identity = getSupportIdentity();
            if (!identity?.authenticated) {
                const guestName = String(supportGuestNameInput?.value || '').trim();
                const guestEmail = normalizeGuestEmail(supportGuestEmailInput?.value || '');
                if (!guestName) {
                    showLiveNotification('الدعم الإداري', 'اكتب الاسم الكامل أولاً قبل إرسال الرسالة.');
                    focusSupportField(supportGuestNameInput);
                    return;
                }
                if (!guestEmail || !guestEmail.includes('@')) {
                    showLiveNotification('الدعم الإداري', 'اكتب البريد الإلكتروني بشكل صحيح قبل إرسال الرسالة.');
                    focusSupportField(supportGuestEmailInput);
                    return;
                }
                saveSupportGuestProfile(guestName, guestEmail);
                identity = getSupportIdentity();
            }

            if (!identity?.email) {
                showLiveNotification('الدعم الإداري', 'تعذر تجهيز بيانات المرسل. حاول مرة أخرى.');
                return;
            }

            storeApi.sendSupportMessage({
                email: identity.email,
                userName: identity.name,
                role: identity.role || 'مستخدم المنصة',
                sender: 'user',
                senderName: identity.name,
                text,
                attachments
            }, { silent: true });

            if (supportInput) {
                supportInput.value = '';
                supportInput.style.height = '';
            }
            clearPendingSupportAttachments();

            setSupportView('chat');
            renderSupportWidget();

            Promise.resolve(notifyAdminsAboutSupportMessage(text || getSupportMessagePreviewLocal({ attachments }), identity.name)).catch((error) => {
                console.error('Admin support notification failed:', error);
            });

            Promise.allSettled([
                storeApi.syncNow?.(),
                authApi.syncNow?.()
            ]).catch(() => {});

            if (supportPanel?.hasAttribute('hidden') || supportView !== 'chat') {
                showLiveNotification('الدعم الإداري', 'تم إرسال رسالتك إلى الإدارة بنجاح.');
            }
            focusSupportField(supportInput);
        } finally {
            supportSubmitInFlight = false;
            setSupportComposerState(getSupportStoreApi());
        }
    }

    function buildSupportMessageMarkup(message) {
        const isUserMessage = message.sender !== 'admin' && message.sender !== 'bot';
        const senderLabel = message.sender === 'admin'
            ? 'الدعم الإداري'
            : message.sender === 'bot'
                ? 'المساعد الآلي'
                : 'أنت';
        const avatarLabel = message.sender === 'admin'
            ? 'د'
            : message.sender === 'bot'
                ? 'آ'
                : 'أ';
        const attachmentsHtml = buildSupportAttachmentMarkup(message.attachments, 'support-chat');
        const readLabel = getSupportMessageReadLabel(message);
        return `
            <div class="support-chat-message ${message.sender === 'admin' ? 'is-admin' : message.sender === 'bot' ? 'is-bot' : 'is-user'}">
                ${isUserMessage ? '' : `<span class="support-chat-avatar">${escapeHtml(avatarLabel)}</span>`}
                <div class="support-chat-bubble">
                    <span class="support-chat-sender">${escapeHtml(senderLabel)}</span>
                    ${message.text ? `<p>${escapeHtml(message.text)}</p>` : ''}
                    ${attachmentsHtml}
                    <div class="support-chat-meta-row">
                        <small>${escapeHtml(new Date(message.createdAt || Date.now()).toLocaleString('ar-EG'))}</small>
                        ${readLabel ? `<small class="support-chat-read-state">${escapeHtml(readLabel)}</small>` : ''}
                    </div>
                </div>
                ${isUserMessage ? `<span class="support-chat-avatar support-chat-avatar-user">${escapeHtml(avatarLabel)}</span>` : ''}
            </div>
        `;
    }

    function renderSupportWidget() {
        if (!supportWidget || !supportPanel) return;

        const storeApi = getSupportStoreApi();
        const identity = getSupportIdentity();
        const guestProfile = readSupportGuestProfile();
        const thread = getSupportThreadForCurrentUser();
        const hasMessages = Boolean(thread?.messages?.length);
        const unreadCount = Number(thread?.unreadByUser || 0);
        supportPanel.dataset.view = supportView;
        supportPanel.classList.toggle('is-chat-mode', supportView === 'chat');
        if (supportBadge) {
            supportBadge.hidden = unreadCount <= 0;
            supportBadge.textContent = unreadCount > 9 ? '+9' : String(unreadCount);
        }
        if (supportAttachmentCounter) {
            supportAttachmentCounter.hidden = pendingSupportAttachments.length === 0;
            supportAttachmentCounter.textContent = pendingSupportAttachments.length > 9 ? '+9' : String(pendingSupportAttachments.length);
        }

        if (supportHomeView) supportHomeView.hidden = supportView !== 'home';
        if (supportFaqView) supportFaqView.hidden = supportView !== 'faq';
        if (supportChatView) supportChatView.hidden = supportView !== 'chat';

        if (supportGuestFields) {
            supportGuestFields.hidden = Boolean(identity?.authenticated);
        }

        if (supportGuestNameInput && !identity?.authenticated && !String(supportGuestNameInput.value || '').trim() && guestProfile?.name) {
            supportGuestNameInput.value = guestProfile.name;
        }

        if (supportGuestEmailInput && !identity?.authenticated && !normalizeGuestEmail(supportGuestEmailInput.value || '') && guestProfile?.email) {
            supportGuestEmailInput.value = guestProfile.email;
        }

        if (supportMessages) {
            if (hasMessages) {
                supportMessages.innerHTML = thread.messages.map((message) => buildSupportMessageMarkup(message)).join('');
                requestAnimationFrame(() => {
                    supportMessages.scrollTop = supportMessages.scrollHeight;
                });
            } else {
                supportMessages.innerHTML = '';
            }
        }

        if (false && supportEmpty) {
            supportEmpty.hidden = Boolean(thread?.messages?.length);
            if (!authSession) {
                supportEmpty.innerHTML = '<strong>الدعم الإداري</strong><p>اكتب الاسم والبريد الإلكتروني ثم أرسل رسالتك مباشرة إلى الإدارة. الخدمة متاحة الآن لجميع الزوار والمستخدمين.</p>';
            } else {
                supportEmpty.innerHTML = '<strong>الدعم الإداري</strong><p>لم تبدأ أي محادثة بعد. اكتب رسالتك وسيتم إرسالها مباشرة إلى الإدارة.</p>';
            }
        }

        if (false && supportEmpty) {
            if (!identity?.email) {
                supportEmpty.innerHTML = '<strong>الدعم الإداري</strong><p>اكتب الاسم والبريد الإلكتروني ثم أرسل رسالتك مباشرة إلى الإدارة. الخدمة متاحة الآن لجميع الزوار والمستخدمين.</p>';
            } else if (!identity.authenticated && !thread?.messages?.length) {
                supportEmpty.innerHTML = '<strong>الدعم الإداري</strong><p>يمكنك متابعة نفس المحادثة من هذا الجهاز باستخدام البريد الذي أدخلته، وستظهر ردود الإدارة هنا مباشرة.</p>';
            } else if (identity.authenticated && !thread?.messages?.length) {
                supportEmpty.innerHTML = '<strong>الدعم الإداري</strong><p>لم تبدأ أي محادثة بعد. اكتب رسالتك وسيتم إرسالها مباشرة إلى الإدارة.</p>';
            }
        }

        if (supportEmpty) {
            supportEmpty.hidden = hasMessages;
            supportEmpty.innerHTML = getSupportEmptyMarkup(identity, hasMessages);
        }

        renderPendingSupportAttachments();
        if (!pendingSupportAttachments.length) {
            setSupportAttachmentHintText(
                unreadCount > 0
                    ? `لديك ${unreadCount} ${unreadCount === 1 ? 'رسالة غير مقروءة' : 'رسائل غير مقروءة'} داخل المحادثة.`
                    : 'يمكنك إضافة صور توضيحية مع الرسالة.'
            );
        }

        setSupportComposerState(storeApi);
    }

    function injectSupportWidget() {
        if (document.body?.dataset?.supportPage === 'dedicated') return;
        if (document.body.querySelector('.support-chat-widget')) return;

        supportWidget = document.createElement('div');
        supportWidget.className = 'support-chat-widget';
        supportWidget.innerHTML = `
            <button type="button" class="support-chat-toggle" aria-label="فتح مساعد المنصة">
                <i class="fas fa-comments"></i>
                <span class="support-chat-badge" hidden>0</span>
            </button>
            <section class="support-chat-panel" hidden>
                <div class="support-chat-header">
                    <div class="support-chat-header-main">
                        <span class="support-chat-brand-icon"><i class="fas fa-headset"></i></span>
                        <div class="support-chat-header-copy">
                            <strong>الدعم الإداري</strong>
                            <span>محادثة مباشرة مع إدارة المنصة</span>
                        </div>
                    </div>
                    <div class="support-chat-header-actions">
                        <span class="support-chat-header-status"><i class="fas fa-circle"></i> متصل الآن</span>
                        <button type="button" class="support-chat-close" aria-label="إغلاق الشات"><i class="fas fa-times"></i></button>
                    </div>
                </div>
                <div class="support-chat-section">
                    <span class="mini-badge">أسئلة شائعة</span>
                    <div class="support-chat-faq-list">
                        ${SUPPORT_FAQ.map((item, index) => `
                            <button type="button" class="support-chat-faq-btn" data-support-faq="${index}">${item.question}</button>
                        `).join('')}
                    </div>
                    <div class="support-chat-answer-box">
                        <strong>إجابة تلقائية</strong>
                        <p>${SUPPORT_FAQ[0].answer}</p>
                    </div>
                </div>
                <div class="support-chat-section">
                    <div class="support-chat-actions">
                        <button type="button" class="btn-primary support-contact-admin">تواصل مع الدعم الإداري</button>
                    </div>
                    <div class="support-chat-thread">
                        <div class="support-chat-messages"></div>
                        <div class="support-chat-empty"></div>
                        <form class="support-chat-composer" novalidate>
                            <div class="support-chat-guest-fields">
                                <input type="text" class="form-control support-chat-guest-name" placeholder="الاسم الكامل">
                                <input type="email" class="form-control support-chat-guest-email" placeholder="البريد الإلكتروني">
                            </div>
                            <label class="support-chat-entry-shell">
                                <span class="support-chat-entry-label">اكتب رسالتك</span>
                                <textarea class="form-control support-chat-input" rows="3" placeholder="اكتب رسالتك إلى الإدارة هنا"></textarea>
                            </label>
                            <input type="file" class="support-chat-attachment-input" accept="image/*" hidden multiple>
                            <div class="support-chat-upload-list" hidden></div>
                            <div class="support-chat-composer-footer">
                                <div class="support-chat-composer-tools">
                                    <button type="button" class="support-chat-tool-btn support-chat-attach-btn" aria-label="إرفاق صورة">
                                        <i class="fas fa-paperclip"></i>
                                        <span class="support-chat-tool-count" hidden>0</span>
                                    </button>
                                </div>
                                <span class="support-chat-inline-note">الخدمة متاحة لكل الزوار والمستخدمين.</span>
                                <button type="button" class="btn-primary support-chat-send-btn">
                                    <i class="fas fa-paper-plane"></i>
                                    <span>إرسال</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </section>
        `;
        document.body.appendChild(supportWidget);

        const toggleBtn = supportWidget.querySelector('.support-chat-toggle');
        const closeBtn = supportWidget.querySelector('.support-chat-close');
        const faqButtons = Array.from(supportWidget.querySelectorAll('[data-support-faq]'));
        const answerBox = supportWidget.querySelector('.support-chat-answer-box p');
        const contactBtn = supportWidget.querySelector('.support-contact-admin');
        supportPanel = supportWidget.querySelector('.support-chat-panel');
        supportBadge = supportWidget.querySelector('.support-chat-badge');
        supportFaqAnswer = answerBox;
        supportMessages = supportWidget.querySelector('.support-chat-messages');
        supportEmpty = supportWidget.querySelector('.support-chat-empty');
        supportComposer = supportWidget.querySelector('.support-chat-composer');
        supportGuestFields = supportWidget.querySelector('.support-chat-guest-fields');
        supportGuestNameInput = supportWidget.querySelector('.support-chat-guest-name');
        supportGuestEmailInput = supportWidget.querySelector('.support-chat-guest-email');
        supportInput = supportWidget.querySelector('.support-chat-input');
        supportSendBtn = supportWidget.querySelector('.support-chat-send-btn');
        supportAttachmentInput = supportWidget.querySelector('.support-chat-attachment-input');
        supportAttachmentPreview = supportWidget.querySelector('.support-chat-upload-list');
        supportAttachmentCounter = supportWidget.querySelector('.support-chat-tool-count');
        supportAttachmentHint = supportWidget.querySelector('.support-chat-inline-note');
        const attachBtn = supportWidget.querySelector('.support-chat-attach-btn');
        const openViewButtons = [];
        const backButtons = [];

        const bindComposerFocus = (field) => {
            if (!field) return;
            ['pointerdown', 'touchstart'].forEach((eventName) => {
                field.addEventListener(eventName, () => {
                    focusSupportField(field);
                }, { passive: true });
            });
        };

        [supportInput, supportGuestNameInput, supportGuestEmailInput].forEach(bindComposerFocus);
        const autoSizeSupportInput = () => {
            if (!supportInput) return;
            supportInput.style.height = '0px';
            supportInput.style.height = `${Math.min(Math.max(supportInput.scrollHeight, 96), 220)}px`;
        };

        supportInput?.addEventListener('input', autoSizeSupportInput);
        supportInput?.addEventListener('input', () => setSupportComposerState(getSupportStoreApi()));
        supportInput?.addEventListener('keydown', (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault();
                void submitSupportMessage();
            }
        });
        attachBtn?.addEventListener('click', () => {
            supportAttachmentInput?.click();
        });
        supportAttachmentInput?.addEventListener('change', async (event) => {
            try {
                await appendSupportAttachments(event.target?.files);
                setSupportComposerState(getSupportStoreApi());
            } catch (error) {
                console.error('Support attachment failed:', error);
                showLiveNotification('الدعم الإداري', 'تعذر تجهيز الصورة. جرّب صورة أصغر أو أوضح.');
            }
        });
        supportAttachmentPreview?.addEventListener('click', (event) => {
            const button = event.target.closest('[data-support-remove-attachment]');
            if (!button) return;
            pendingSupportAttachments = pendingSupportAttachments.filter((attachment) => attachment.id !== button.dataset.supportRemoveAttachment);
            renderPendingSupportAttachments();
            setSupportComposerState(getSupportStoreApi());
        });
        requestAnimationFrame(autoSizeSupportInput);
        const supportSections = Array.from(supportWidget.querySelectorAll('.support-chat-section'));
        supportFaqView = supportSections[0] || null;
        supportChatView = supportSections[1] || null;

        if (supportFaqView) {
            supportFaqView.classList.add('support-chat-faq-view');
            if (!supportFaqView.querySelector('[data-support-back]')) {
                supportFaqView.insertAdjacentHTML('afterbegin', `
                    <div class="support-chat-subheader">
                        <button type="button" class="btn-ghost support-chat-mode-btn" data-support-back="true"><i class="fas fa-arrow-right"></i> رجوع</button>
                        <strong>الأسئلة المختصرة</strong>
                    </div>
                `);
            }
        }

        if (supportChatView) {
            supportChatView.classList.add('support-chat-chat-view');
            const actionsWrap = supportChatView.querySelector('.support-chat-actions');
            if (actionsWrap) {
                actionsWrap.innerHTML = `
                    <div class="support-chat-subheader">
                        <button type="button" class="btn-ghost support-chat-mode-btn" data-support-back="true"><i class="fas fa-arrow-right"></i> رجوع</button>
                        <div class="support-chat-subheader-copy">
                            <strong>محادثة مباشرة مع الإدارة</strong>
                            <span>كل الرسائل تصل فورًا وتظهر الردود هنا مباشرة</span>
                        </div>
                    </div>
                `;
            }
        }

        if (!supportHomeView) {
            supportHomeView = document.createElement('div');
            supportHomeView.className = 'support-chat-home';
            supportHomeView.innerHTML = `
                <button type="button" class="support-chat-mode-card" data-support-open-view="faq">
                    <i class="fas fa-circle-question"></i>
                    <strong>أسئلة مختصرة</strong>
                    <span>إجابات سريعة للأسئلة الشائعة</span>
                </button>
                <button type="button" class="support-chat-mode-card" data-support-open-view="chat">
                    <i class="fas fa-headset"></i>
                    <strong>التواصل مع الإدارة</strong>
                    <span>محادثة مباشرة من داخل المنصة</span>
                </button>
            `;
            supportPanel.querySelector('.support-chat-header')?.insertAdjacentElement('afterend', supportHomeView);
        }

        openViewButtons.push(...Array.from(supportWidget.querySelectorAll('[data-support-open-view]')));
        backButtons.push(...Array.from(supportWidget.querySelectorAll('[data-support-back]')));

        toggleBtn?.addEventListener('click', async () => {
            supportView = 'home';
            supportPanel.removeAttribute('hidden');
            await markSupportThreadReadForUser();
            renderSupportWidget();
        });

        closeBtn?.addEventListener('click', () => {
            supportPanel?.setAttribute('hidden', '');
        });

        faqButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const answer = SUPPORT_FAQ[Number(button.dataset.supportFaq || 0)]?.answer || 'لا توجد إجابة متاحة الآن.';
                if (supportFaqAnswer) {
                    supportFaqAnswer.textContent = answer;
                }
                setSupportView('faq');
            });
        });

        openViewButtons.forEach((button) => {
            button.addEventListener('click', async () => {
                const nextView = button.dataset.supportOpenView || 'home';
                if (nextView === 'chat') {
                    await markSupportThreadReadForUser();
                }
                setSupportView(nextView);
                if (nextView === 'chat') {
                    if (getSupportIdentity()?.authenticated) {
                        focusSupportField(supportInput);
                    } else {
                        focusSupportField(supportGuestNameInput);
                    }
                }
            });
        });

        backButtons.forEach((button) => {
            button.addEventListener('click', () => setSupportView('home'));
        });

        contactBtn?.addEventListener('click', async () => {
            await markSupportThreadReadForUser();
            setSupportView('chat');
            renderSupportWidget();
            if (getSupportIdentity()?.authenticated) {
                focusSupportField(supportInput);
            } else {
                focusSupportField(supportGuestNameInput);
            }
        });

        supportComposer?.addEventListener('submit', async (event) => {
            event.preventDefault();
            await submitSupportMessage();
        });

        supportSendBtn?.addEventListener('click', (event) => {
            event.preventDefault();
            void submitSupportMessage();
        });

        renderSupportWidget();
    }

    function injectAuthSummary() {
        const liveSession = getLiveSession();
        if (!liveSession) return;

        const userData = authApi.getUserByEmail(liveSession.email) || liveSession;
        const balance = Number(userData?.balance || 0);
        const profileImage = userData?.profileImage || null;
        const displayName = userData?.name || liveSession.name || 'مستخدم المنصة';
        const displayRole = userData?.role || authApi?.getManagementRoleLabel?.(userData || liveSession) || 'مستخدم المنصة';
        const prefix = getPrefix();
        const walletUrl = `${prefix}wallet.html`;
        const walletAllowed = canShowWallet();

        const headerContainer = siteHeader ? siteHeader.querySelector('.container') : null;
        headerContainer?.querySelector('[data-header-session="true"]')?.remove();
        if (headerContainer) {
            const avatarHtml = profileImage
                ? `<img src="${profileImage}" class="header-session-avatar" style="object-fit: cover;">`
                : `<span class="header-session-avatar">${getUserInitial()}</span>`;

            const headerCard = document.createElement('div');
            headerCard.className = 'header-session';
            headerCard.dataset.headerSession = 'true';
            headerCard.innerHTML = `
                <div class="header-session-main">
                    ${avatarHtml}
                    <div class="header-session-copy">
                        <strong>${escapeHtml(displayName)}</strong>
                        <span>${escapeHtml(displayRole)}</span>
                    </div>
                </div>
                ${walletAllowed ? `
                    <a href="${walletUrl}" class="header-balance-chip">
                        <i class="fas fa-wallet"></i>
                        <span>${formatBalance(balance)}</span>
                    </a>
                ` : ''}
                <button type="button" class="header-logout-btn" data-logout="true" aria-label="تسجيل الخروج">
                    <i class="fas fa-right-from-bracket"></i>
                    <span>تسجيل الخروج</span>
                </button>
            `;
            headerContainer.appendChild(headerCard);
        }

        siteSidebar?.querySelector('[data-sidebar-profile="true"]')?.remove();
        if (siteSidebar) {
            const sidebarAvatarHtml = profileImage
                ? `<img src="${profileImage}" class="sidebar-profile-avatar" style="object-fit: cover;">`
                : `<span class="sidebar-profile-avatar">${getUserInitial()}</span>`;

            const sidebarCard = document.createElement('section');
            sidebarCard.className = 'sidebar-profile-card';
            sidebarCard.dataset.sidebarProfile = 'true';
            sidebarCard.innerHTML = `
                <div class="sidebar-profile-top">
                    ${sidebarAvatarHtml}
                    <div class="sidebar-profile-copy">
                        <strong>${escapeHtml(displayName)}</strong>
                        <span>${escapeHtml(displayRole)}</span>
                    </div>
                </div>
                ${walletAllowed ? `
                    <a href="${walletUrl}" class="sidebar-balance-card">
                        <div class="balance-info">
                            <i class="fas fa-wallet"></i>
                            <span>الرصيد المتاح</span>
                        </div>
                        <strong>${formatBalance(balance)}</strong>
                    </a>
                ` : ''}
                <p class="sidebar-profile-email">${escapeHtml(liveSession.email || '')}</p>
                <button type="button" class="logout-btn" data-logout="true">
                    <i class="fas fa-right-from-bracket"></i>
                    <span>تسجيل الخروج</span>
                </button>
            `;

            const sidebarHeader = siteSidebar.querySelector('.sidebar-header');
            if (sidebarHeader) {
                sidebarHeader.insertAdjacentElement('afterend', sidebarCard);
            } else {
                siteSidebar.prepend(sidebarCard);
            }
        }

        if (sidebarNav && !sidebarNav.querySelector('a[href*="settings.html"]')) {
            const sidebarSettingsLink = document.createElement('a');
            sidebarSettingsLink.href = `${prefix}settings.html`;
            sidebarSettingsLink.className = 'sidebar-link';
            sidebarSettingsLink.innerHTML = '<i class="fas fa-cog"></i> <span>إعدادات الحساب</span>';
            sidebarNav.appendChild(sidebarSettingsLink);
        }

        bindAuthActions();
    }

    function bindAuthActions() {
        if (!authApi) return;

        Array.from(document.querySelectorAll('[data-logout]')).forEach((button) => {
            if (button.dataset.logoutBound === 'true') return;
            button.dataset.logoutBound = 'true';
            button.addEventListener('click', () => {
                authApi.logout();
                window.location.replace(getLoginPath());
            });
        });
    }

    function injectSidebarExtras() {
        if (!sidebarNav || sidebarNav.querySelector('[data-sidebar-extra="true"]')) {
            return;
        }

        const prefix = getPrefix();
        const links = isExamOnlySession() ? [
            { href: `${prefix}exam-status.html`, icon: 'fa-pen-to-square', label: 'الامتحان' },
            { href: `${prefix}status.html`, icon: 'fa-magnifying-glass', label: 'حالة الطلب' },
            { href: `${prefix}notifications.html`, icon: 'fa-bell', label: 'الإشعارات' },
            { href: `${prefix}support.html`, icon: 'fa-headset', label: 'الدعم' },
            { href: `${prefix}guide.html`, icon: 'fa-book-open', label: 'الدليل' }
        ] : [
            { href: `${prefix}receipt.html`, icon: 'fa-receipt', label: 'إيصال الطلب' },
            { href: `${prefix}exam-results.html`, icon: 'fa-square-poll-vertical', label: 'نتائج الامتحان' },
            { href: `${prefix}notifications.html`, icon: 'fa-bell', label: 'الإشعارات' },
            { href: `${prefix}complaints.html`, icon: 'fa-comment-dots', label: 'الشكاوى' },
            { href: `${prefix}support.html`, icon: 'fa-headset', label: 'الدعم' },
            { href: `${prefix}services.html`, icon: 'fa-layer-group', label: 'الخدمات' },
            { href: `${prefix}guide.html`, icon: 'fa-book-open', label: 'الدليل' },
            { href: `${prefix}announcements.html`, icon: 'fa-bullhorn', label: 'الإعلانات' },
            { href: `${prefix}exam-calendar.html`, icon: 'fa-calendar-days', label: 'الجدول' }
        ];

        const wrapper = document.createElement('div');
        wrapper.className = 'sidebar-extra-block';
        wrapper.dataset.sidebarExtra = 'true';
        wrapper.innerHTML = `
            <div class="sidebar-promo">
                <span class="sidebar-section-label">اختصارات إضافية</span>
                <strong>مركز تنقل سريع</strong>
                <p>مسارات مرتبة للوصول أسرع إلى كل أجزاء المنصة.</p>
            </div>
            <div class="sidebar-mini-grid">
                ${links.map((item) => `
                    <a href="${item.href}" class="sidebar-mini-link">
                        <i class="fas ${item.icon}"></i>
                        <span>${item.label}</span>
                    </a>
                `).join('')}
            </div>
        `;

        sidebarNav.appendChild(wrapper);
    }

    function checkComplaintNotification() {
        renderManagedNotificationSurfaces();
        return;
        if (!authSession) return;
        
        const COMPLAINT_NOTIF_KEY = 'qarya_complaint_notif_shown';
        if (sessionStorage.getItem(COMPLAINT_NOTIF_KEY)) return;

        setTimeout(() => {
            const prefix = getPrefix();
            const notification = document.createElement('div');
            notification.className = 'floating-notification';
            notification.innerHTML = `
                <div class="floating-notification-content">
                    <div class="floating-notification-icon">
                        <i class="fas fa-comment-dots"></i>
                    </div>
                    <div class="floating-notification-text">
                        <strong>تقديم شكوى لقرية متعلمة؟</strong>
                        <p>نحن نهتم بصوتك. سيتم إرسال الشكوى دون الإفصاح عن مرسلها للجهة المشتكى عليها.</p>
                        <div class="floating-notification-actions">
                            <a href="${prefix}complaints.html" class="btn-primary btn-xs">تقديم شكوى</a>
                            <button class="btn-ghost btn-xs" onclick="this.closest('.floating-notification').remove()">إغلاق</button>
                        </div>
                    </div>
                </div>
                <button class="floating-notification-close" onclick="this.closest('.floating-notification').remove()">&times;</button>
            `;
            document.body.appendChild(notification);
            sessionStorage.setItem(COMPLAINT_NOTIF_KEY, 'true');
        }, 2000);
    }

    function checkBalanceNotification() {
        if (!authSession) return;
        if (!canShowWallet()) return;
        
        const BALANCE_NOTIF_KEY = 'qarya_balance_notif_shown';
        if (sessionStorage.getItem(BALANCE_NOTIF_KEY)) return;

        const userData = authApi.getUserByEmail(authSession.email);
        if (!userData || userData.balance <= 0) return;

        setTimeout(() => {
            const prefix = getPrefix();
            const notification = document.createElement('div');
            notification.className = 'floating-notification';
            notification.style.bottom = '12rem'; // Show above complaint notif if both appear
            notification.innerHTML = `
                <div class="floating-notification-content">
                    <div class="floating-notification-icon" style="background: var(--success-soft); color: var(--success);">
                        <i class="fas fa-wallet"></i>
                    </div>
                    <div class="floating-notification-text">
                        <strong>رصيدك المتاح: ${formatBalance(userData.balance)}</strong>
                        <p>لديك رصيد متاح في محفظتك، يمكنك سحبه الآن عبر وسائل السحب المختلفة.</p>
                        <div class="floating-notification-actions">
                            <a href="${prefix}wallet.html" class="btn-primary btn-xs">اذهب للمحفظة</a>
                            <button class="btn-ghost btn-xs" onclick="this.closest('.floating-notification').remove()">إغلاق</button>
                        </div>
                    </div>
                </div>
                <button class="floating-notification-close" onclick="this.closest('.floating-notification').remove()">&times;</button>
            `;
            document.body.appendChild(notification);
            sessionStorage.setItem(BALANCE_NOTIF_KEY, 'true');
        }, 3000);
    }

    function updateActiveLinks() {
        const allLinks = [
            ...navLinks,
            ...sidebarLinks,
            ...Array.from(document.querySelectorAll('.sidebar-mini-link')),
            ...Array.from(document.querySelectorAll('.header-shortcut-link')),
            ...Array.from(document.querySelectorAll('.nav-dropdown-link'))
        ];

        allLinks.forEach((link) => {
            const href = link.getAttribute('href');
            if (!href) return;
            const linkFile = href.split('/').pop().split('?')[0].split('#')[0] || 'index.html';
            const isMatch = currentFile === linkFile || (currentFile === '' && linkFile === 'index.html');
            link.classList.toggle('active', isMatch);
        });

        serviceDropdowns.forEach((dropdown) => {
            const hasActiveChild = Boolean(dropdown.querySelector('.nav-dropdown-link.active'));
            dropdown.classList.toggle('active', hasActiveChild);
            const toggle = dropdown.querySelector('.nav-dropdown-toggle');
            if (toggle) {
                toggle.classList.toggle('active', hasActiveChild);
            }
        });
    }

    function updateHeaderState() {
        if (!siteHeader) return;
        siteHeader.classList.toggle('scrolled', window.scrollY > 12);
    }

    function formatCount(value) {
        return Number(value).toLocaleString('ar-EG');
    }

    function animateCount(element) {
        const finalValue = Number(element.dataset.countTo || 0);
        const duration = Number(element.dataset.countDuration || 1400);
        const suffix = element.dataset.countSuffix || '';
        const prefix = element.dataset.countPrefix || '';
        const startTime = performance.now();

        function step(now) {
            const progress = Math.min((now - startTime) / duration, 1);
            const currentValue = Math.round(finalValue * progress);
            element.textContent = `${prefix}${formatCount(currentValue)}${suffix}`;
            if (progress < 1) requestAnimationFrame(step);
        }

        requestAnimationFrame(step);
    }

    function initCounters() {
        if (!countElements.length) return;

        if (!('IntersectionObserver' in window)) {
            countElements.forEach((element) => {
                const suffix = element.dataset.countSuffix || '';
                const prefix = element.dataset.countPrefix || '';
                element.textContent = `${prefix}${formatCount(element.dataset.countTo || 0)}${suffix}`;
            });
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting || entry.target.dataset.counted === 'true') return;
                entry.target.dataset.counted = 'true';
                animateCount(entry.target);
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.35 });

        countElements.forEach((element) => observer.observe(element));
    }

    function initFaqs() {
        faqButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const item = button.closest('.faq-item');
                if (!item) return;

                faqButtons.forEach((otherButton) => {
                    const otherItem = otherButton.closest('.faq-item');
                    if (otherItem && otherItem !== item && otherItem.classList.contains('open')) {
                        otherItem.classList.remove('open');
                        otherButton.setAttribute('aria-expanded', 'false');
                    }
                });

                const isOpen = item.classList.contains('open');
                item.classList.toggle('open', !isOpen);
                button.setAttribute('aria-expanded', String(!isOpen));
            });
        });
    }

    function initCopyButtons() {
        copyButtons.forEach((button) => {
            button.addEventListener('click', async () => {
                const selector = button.dataset.copyTarget;
                const target = selector ? document.querySelector(selector) : null;
                const value = target ? (target.value || target.textContent || '').trim() : '';
                if (!value) return;

                const originalLabel = button.dataset.copyLabel || button.textContent;
                try {
                    await navigator.clipboard.writeText(value);
                    button.textContent = 'تم النسخ';
                    setTimeout(() => {
                        button.textContent = originalLabel;
                    }, 1600);
                } catch (error) {
                    console.error('Copy failed:', error);
                }
            });
        });
    }

    function initRevealAnimations() {
        const targets = Array.from(document.querySelectorAll([
            '[data-reveal]',
            '.summary-card',
            '.quick-link-card',
            '.feature-card',
            '.metric-card',
            '.help-card',
            '.feature-panel-card',
            '.dashboard-action-card',
            '.dashboard-list-card',
            '.mini-notice-card',
            '.notification-card',
            '.support-card',
            '.receipt-card',
            '.status-card',
            '.content-card',
            '.side-card',
            '.glance-card',
            '.village-card'
        ].join(',')));

        if (!targets.length) return;

        targets.forEach((target) => target.classList.add('reveal-item'));

        if (!('IntersectionObserver' in window)) {
            targets.forEach((target) => target.classList.add('is-visible'));
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

        targets.forEach((target) => observer.observe(target));
    }
});
