document.addEventListener('DOMContentLoaded', () => {
    const store = window.QaryaPlatformStore;
    if (!store) return;

    const select = document.getElementById('notification-filter');
    const list = document.getElementById('notification-list');
    const count = document.getElementById('notification-count');

    function formatDate(value) {
        return value ? new Date(value).toLocaleString('ar-EG') : 'غير محدد';
    }

    function render() {
        const type = select ? select.value : '';
        const notes = store.getNotifications().filter((note) => !type || note.type === type);

        if (count) count.textContent = notes.length.toLocaleString('ar-EG');
        if (!list) return;

        if (!notes.length) {
            list.innerHTML = '<div class="empty-state"><i class="fas fa-bell-slash"></i><h3>لا توجد إشعارات مطابقة</h3><p>جرّب تغيير نوع الإشعار أو عد لاحقًا.</p></div>';
            return;
        }

        list.innerHTML = notes.map((note) => `
            <article class="notification-card" data-reveal>
                <div class="dashboard-list-head">
                    <div>
                        <span class="mini-badge">${getTypeLabel(note.type)}</span>
                        <h3>${note.title}</h3>
                    </div>
                    <small>${formatDate(note.createdAt)}</small>
                </div>
                <p>${note.body}</p>
                ${note.actionUrl ? `<div class="dashboard-card-actions"><a href="${note.actionUrl}" class="btn-ghost">${note.actionLabel || 'فتح التفاصيل'}</a></div>` : ''}
            </article>
        `).join('');
    }

    function getTypeLabel(type) {
        if (type === 'application') return 'الطلبات';
        if (type === 'exam') return 'الامتحانات';
        if (type === 'finance') return 'الدفعات';
        return 'تحديث';
    }

    if (select) {
        select.addEventListener('change', render);
    }

    render();
});
