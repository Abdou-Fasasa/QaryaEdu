document.addEventListener('DOMContentLoaded', () => {
    const store = window.QaryaPlatformStore;
    const authApi = window.QaryaAuth;
    const session = authApi?.getSession?.();

    if (!store || !authApi || !session) return;

    const select = document.getElementById('notification-filter');
    const list = document.getElementById('notification-list');
    const count = document.getElementById('notification-count');
    const privateAllowed = Boolean(authApi.canReceivePrivateNotifications?.(session.email));
    const DISMISSED_NOTIFICATIONS_KEY = 'qaryaeduDismissedNotifications';

    function formatDate(value) {
        return value ? new Date(value).toLocaleString('ar-EG') : 'غير محدد';
    }

    function getTypeLabel(type, audience) {
        if (audience === 'private') return 'خاص';
        if (type === 'application') return 'الطلبات';
        if (type === 'exam') return 'الامتحانات';
        if (type === 'finance') return 'الدفعات';
        if (type === 'support') return 'الدعم';
        return 'تحديث';
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
            audience: 'global'
        }));

        const privateNotes = privateAllowed
            ? authApi.getPrivateNotifications(session.email).map((note) => ({
                ...note,
                audience: 'private',
                recipientEmail: session.email
            }))
            : [];

        return [...privateNotes, ...globalNotes]
            .filter((note) => isActiveNotification(note) && !isDismissed(note) && !isSensitiveGlobalUserNotification(note))
            .sort((a, b) => getTimestamp(b.updatedAt || b.createdAt || 0) - getTimestamp(a.updatedAt || a.createdAt || 0));
    }

    function render() {
        const type = select ? select.value : '';
        const notes = getMergedNotifications().filter((note) => (
            !type
            || note.type === type
            || note.audience === type
        ));

        if (count) count.textContent = notes.length.toLocaleString('ar-EG');
        if (!list) return;

        if (!notes.length) {
            list.innerHTML = '<div class="empty-state"><i class="fas fa-bell-slash"></i><h3>لا توجد إشعارات مطابقة</h3><p>جرّب تغيير نوع الإشعار أو عد لاحقًا.</p></div>';
            return;
        }

        list.innerHTML = notes.map((note) => `
            <article class="notification-card reveal-item is-visible">
                <div class="dashboard-list-head">
                    <div>
                        <span class="mini-badge">${getTypeLabel(note.type, note.audience)}</span>
                        <h3>${note.title}</h3>
                    </div>
                    <small>${formatDate(note.createdAt)}</small>
                </div>
                <p>${note.body}</p>
                <div class="dashboard-card-actions">
                    ${note.actionUrl ? `<a href="${resolvePlatformUrl(note.actionUrl)}" class="btn-ghost">${note.actionLabel || 'فتح التفاصيل'}</a>` : ''}
                    <button type="button" class="btn-ghost" data-dismiss-notification="${note.id}" data-audience="${note.audience}" data-recipient="${note.recipientEmail || ''}">إخفاء</button>
                </div>
            </article>
        `).join('');
    }

    if (select) {
        const privateOption = select.querySelector('option[value="private"]');
        if (!privateAllowed) {
            privateOption?.remove();
        }
        select.addEventListener('change', render);
    }

    list?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-dismiss-notification]');
        if (!button) return;
        dismissNotification({
            id: button.dataset.dismissNotification,
            audience: button.dataset.audience || 'global',
            recipientEmail: button.dataset.recipient || '',
            sticky: false
        });
        render();
    });

    window.addEventListener(store.storeEventName || 'qarya:store-updated', render);
    window.addEventListener(authApi.storeEventName || 'qarya_auth_store_updated', render);
    render();
});
