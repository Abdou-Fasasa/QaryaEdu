document.addEventListener('DOMContentLoaded', () => {
    const store = window.QaryaPlatformStore;
    const authApi = window.QaryaAuth;
    const session = authApi?.getSession?.();

    if (!store || !authApi || !session) return;

    const typeSelect = document.getElementById('notification-filter');
    const displaySelect = document.getElementById('notification-display-filter');
    const scopeSelect = document.getElementById('notification-scope-filter');
    const searchInput = document.getElementById('notification-search');
    const list = document.getElementById('notification-list');
    const count = document.getElementById('notification-count');
    const totalStat = document.getElementById('notification-stat-total');
    const privateStat = document.getElementById('notification-stat-private');
    const bannerStat = document.getElementById('notification-stat-banner');
    const floatingStat = document.getElementById('notification-stat-floating');
    const feedStat = document.getElementById('notification-stat-feed');
    const privateAllowed = Boolean(authApi.canReceivePrivateNotifications?.(session.email));
    const DISMISSED_NOTIFICATIONS_KEY = 'qaryaeduDismissedNotifications';

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatDate(value) {
        return value ? new Date(value).toLocaleString('ar-EG') : 'غير محدد';
    }

    function getTypeLabel(type, audience) {
        if (audience === 'private') return 'خاص';
        if (type === 'application') return 'الطلبات';
        if (type === 'exam') return 'الامتحانات';
        if (type === 'finance') return 'الماليات';
        if (type === 'support') return 'الدعم';
        return 'تحديث';
    }

    function getDisplayLabel(mode) {
        if (mode === 'banner') return 'ثابت';
        if (mode === 'floating') return 'عائم';
        return 'قائمة';
    }

    function getTypeIcon(type) {
        if (type === 'application') return 'fa-file-lines';
        if (type === 'exam') return 'fa-pen-to-square';
        if (type === 'finance') return 'fa-wallet';
        if (type === 'support') return 'fa-headset';
        return 'fa-bell';
    }

    function resolvePlatformUrl(url) {
        const value = String(url || '').trim();
        if (!value) return '';
        if (/^(https?:|mailto:|tel:|#|\/)/i.test(value)) return value;
        if (window.location.pathname.includes('/pages/')) {
            return value.startsWith('./') || value.startsWith('../') ? value : `./${value.replace(/^\.?\//, '')}`;
        }
        if (value.startsWith('./')) {
            return `./pages/${value.slice(2)}`;
        }
        if (value.startsWith('../')) {
            return value.replace(/^\.\.\//, './');
        }
        return `./pages/${value.replace(/^\.?\//, '')}`;
    }

    function getDismissedMap() {
        try {
            const parsed = JSON.parse(localStorage.getItem(DISMISSED_NOTIFICATIONS_KEY) || '{}');
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (error) {
            return {};
        }
    }

    function saveDismissedMap(map) {
        localStorage.setItem(DISMISSED_NOTIFICATIONS_KEY, JSON.stringify(map || {}));
    }

    function getDismissKey(note) {
        const version = String(note.updatedAt || note.createdAt || '').trim();
        return `${note.audience || 'global'}:${String(note.recipientEmail || 'all').toLowerCase()}:${note.id}:${version}`;
    }

    function getTimestamp(value) {
        const time = new Date(value || '').getTime();
        return Number.isFinite(time) && time > 0 ? time : 0;
    }

    function isActiveNotification(note) {
        if (!note) return false;
        const now = Date.now();
        const startAt = getTimestamp(note.startAt || note.createdAt);
        const endAt = getTimestamp(note.endAt);

        if (startAt && startAt > now) return false;
        if (endAt && endAt <= now) return false;
        return true;
    }

    function isSensitiveGlobalUserNotification(note) {
        if (!note || note.audience === 'private') return false;
        if (authApi.isAdminSession?.(session)) return false;

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

    function isDismissed(note) {
        return Boolean(getDismissedMap()[getDismissKey(note)]);
    }

    function dismissNotification(note) {
        const next = getDismissedMap();
        next[getDismissKey(note)] = new Date().toISOString();
        saveDismissedMap(next);
    }

    function getMergedNotifications() {
        const globalNotes = store.getNotifications().map((note) => ({
            ...note,
            audience: 'global',
            displayMode: note.displayMode || 'feed'
        }));

        const privateNotes = privateAllowed
            ? authApi.getPrivateNotifications(session.email).map((note) => ({
                ...note,
                audience: 'private',
                recipientEmail: session.email,
                displayMode: note.displayMode || 'feed'
            }))
            : [];

        return [...privateNotes, ...globalNotes]
            .filter((note) => isActiveNotification(note) && !isDismissed(note) && !isSensitiveGlobalUserNotification(note))
            .sort((a, b) => getTimestamp(b.updatedAt || b.createdAt) - getTimestamp(a.updatedAt || a.createdAt));
    }

    function matchesFilters(note) {
        const type = String(typeSelect?.value || '').trim();
        const display = String(displaySelect?.value || '').trim();
        const scope = String(scopeSelect?.value || '').trim();
        const query = String(searchInput?.value || '').trim().toLowerCase();
        const haystack = `${note.title || ''} ${note.body || ''} ${note.type || ''}`.toLowerCase();

        if (type && note.type !== type && note.audience !== type) return false;
        if (display && String(note.displayMode || 'feed') !== display) return false;
        if (scope && String(note.audience || 'global') !== scope) return false;
        if (query && !haystack.includes(query)) return false;
        return true;
    }

    function renderStats(notes) {
        if (totalStat) totalStat.textContent = notes.length.toLocaleString('ar-EG');
        if (privateStat) privateStat.textContent = notes.filter((note) => note.audience === 'private').length.toLocaleString('ar-EG');
        if (bannerStat) bannerStat.textContent = notes.filter((note) => note.displayMode === 'banner').length.toLocaleString('ar-EG');
        if (floatingStat) floatingStat.textContent = notes.filter((note) => note.displayMode === 'floating').length.toLocaleString('ar-EG');
        if (feedStat) feedStat.textContent = notes.filter((note) => (note.displayMode || 'feed') === 'feed').length.toLocaleString('ar-EG');
    }

    function buildNotificationCard(note) {
        const displayMode = String(note.displayMode || 'feed');
        const displayLabel = getDisplayLabel(displayMode);
        const typeLabel = getTypeLabel(note.type, note.audience);
        const actionLabel = note.actionLabel || 'فتح التفاصيل';
        const chipTone = displayMode === 'banner' ? 'is-warm' : displayMode === 'floating' ? 'is-soft' : '';

        return `
            <article class="notification-card reveal-item is-visible is-${displayMode}" role="button" tabindex="0" title="اضغط لإغلاق الإشعار" data-dismiss-notification="${note.id}" data-audience="${note.audience}" data-recipient="${note.recipientEmail || ''}" data-created-at="${note.createdAt || ''}" data-updated-at="${note.updatedAt || ''}">
                <div class="notification-card-head">
                    <div class="notification-card-copy">
                        <div class="notification-card-meta">
                            <span class="notification-chip"><i class="fas ${getTypeIcon(note.type)}"></i> ${escapeHtml(typeLabel)}</span>
                            <span class="notification-chip ${chipTone}"><i class="fas fa-layer-group"></i> ${escapeHtml(displayLabel)}</span>
                            ${note.sticky ? '<span class="notification-chip is-warm"><i class="fas fa-thumbtack"></i> مثبت</span>' : ''}
                        </div>
                        <h3>${escapeHtml(note.title)}</h3>
                    </div>
                    <button type="button" class="notification-close-btn" aria-label="إغلاق الإشعار" data-dismiss-notification="${note.id}" data-audience="${note.audience}" data-recipient="${note.recipientEmail || ''}" data-created-at="${note.createdAt || ''}" data-updated-at="${note.updatedAt || ''}"><i class="fas fa-xmark"></i></button>
                </div>
                <p class="notification-card-body">${escapeHtml(note.body)}</p>
                <div class="notification-card-footer">
                    <div class="dashboard-card-actions">
                        ${note.actionUrl ? `<a href="${resolvePlatformUrl(note.actionUrl)}" class="btn-ghost">${escapeHtml(actionLabel)}</a>` : ''}
                    </div>
                    <span class="notification-card-time">${escapeHtml(formatDate(note.createdAt))} - ${note.audience === 'private' ? 'إشعار خاص' : 'إشعار عام'}</span>
                </div>
            </article>
        `;
    }

    function render() {
        const allNotes = getMergedNotifications();
        const visibleNotes = allNotes.filter(matchesFilters);

        renderStats(allNotes);
        if (count) count.textContent = visibleNotes.length.toLocaleString('ar-EG');
        if (!list) return;

        if (!visibleNotes.length) {
            list.innerHTML = '<div class="empty-state"><i class="fas fa-bell-slash"></i><h3>لا توجد إشعارات مطابقة</h3><p>غيّر الفلاتر أو امسح البحث لعرض تنبيهات أكثر.</p></div>';
            return;
        }

        list.innerHTML = visibleNotes.map(buildNotificationCard).join('');
    }

    if (!privateAllowed) {
        typeSelect?.querySelector('option[value="private"]')?.remove();
        scopeSelect?.querySelector('option[value="private"]')?.remove();
    }

    [typeSelect, displaySelect, scopeSelect].forEach((element) => {
        element?.addEventListener('change', render);
    });
    searchInput?.addEventListener('input', render);

    function dismissFromElement(element) {
        if (!element) return;

        dismissNotification({
            id: element.dataset.dismissNotification,
            audience: element.dataset.audience || 'global',
            recipientEmail: element.dataset.recipient || '',
            createdAt: element.dataset.createdAt || '',
            updatedAt: element.dataset.updatedAt || ''
        });
        render();
    }

    list?.addEventListener('click', (event) => {
        const link = event.target.closest('a');
        const target = event.target.closest('[data-dismiss-notification]');
        if (!target) return;
        if (!link) {
            event.preventDefault();
        }
        dismissFromElement(target);
    });

    list?.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const target = event.target.closest('[data-dismiss-notification]');
        if (!target) return;
        event.preventDefault();
        dismissFromElement(target);
    });

    window.addEventListener(store.storeEventName || 'qarya:store-updated', render);
    window.addEventListener(authApi.storeEventName || 'qarya_auth_store_updated', render);
    render();
});
