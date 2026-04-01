document.addEventListener('DOMContentLoaded', () => {
    const authApi = window.QaryaAuth;
    const store = window.QaryaPlatformStore;
    if (!authApi || !store) return;

    const session = authApi.getSession();
    const metrics = store.getDashboardMetrics();
    const notifications = store.getNotifications().slice(0, 4);
    const quickActions = document.getElementById('dashboard-quick-actions');
    const applicationsList = document.getElementById('dashboard-latest-applications');
    const examsList = document.getElementById('dashboard-latest-exams');
    const notificationsList = document.getElementById('dashboard-notifications');

    setText('dashboard-user-name', session?.name || 'مستخدم المنصة');
    setText('dashboard-user-role', session?.role || 'مستخدم المنصة');
    setText('dashboard-total-applications', formatNumber(metrics.totalApplications));
    setText('dashboard-pending-applications', formatNumber(metrics.pendingApplications));
    setText('dashboard-accepted-applications', formatNumber(metrics.acceptedApplications));
    setText('dashboard-total-exams', formatNumber(metrics.totalExamAttempts));

    renderQuickActions();
    renderApplications();
    renderExams();
    renderNotifications();

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    }

    function formatNumber(value) {
        return Number(value || 0).toLocaleString('ar-EG');
    }

    function formatDate(value) {
        if (!value) return 'غير محدد';
        return new Date(value).toLocaleString('ar-EG');
    }

    function renderQuickActions() {
        if (!quickActions) return;

        const actions = [
            { href: './register.html', icon: 'fa-user-plus', title: 'تسجيل طلب جديد', text: 'ابدأ إرسال الطلبات الجديدة والحصول على رقم الطلب مباشرة.' },
            { href: './status.html', icon: 'fa-magnifying-glass', title: 'متابعة حالة الطلب', text: 'استعلم عن أي طلب واعرض حالته وتسلسله الزمني الكامل.' },
            { href: './receipt.html', icon: 'fa-receipt', title: 'إيصال الطلب', text: 'اعرض نسخة احترافية قابلة للطباعة من بيانات التسجيل.' },
            { href: './exam-results.html', icon: 'fa-square-poll-vertical', title: 'نتائج الامتحان', text: 'راجع أحدث نتيجة ومحاولات الأداء السابقة لكل طلب.' },
            { href: './notifications.html', icon: 'fa-bell', title: 'مركز الإشعارات', text: 'كل التنبيهات والمستجدات الرسمية في مكان واحد.' },
            { href: './support.html', icon: 'fa-headset', title: 'الدعم والمساعدة', text: 'حلول سريعة للأسئلة الشائعة ومشكلات الاستخدام.' }
        ];

        if (store.canAccessAdmin(session)) {
            actions.unshift({ href: './admin-dashboard.html', icon: 'fa-shield-halved', title: 'لوحة الأدمن', text: 'إدارة الطلبات والموافقات ومتابعة النشاط الكامل للمنصة.' });
        }

        quickActions.innerHTML = actions.map((action) => `
            <a href="${action.href}" class="dashboard-action-card" data-reveal>
                <span class="dashboard-action-icon"><i class="fas ${action.icon}"></i></span>
                <h3>${action.title}</h3>
                <p>${action.text}</p>
            </a>
        `).join('');
    }

    function renderApplications() {
        if (!applicationsList) return;
        const applications = metrics.latestApplications;
        if (!applications.length) {
            applicationsList.innerHTML = '<div class="empty-state compact"><i class="fas fa-folder-open"></i><p>لا توجد طلبات حديثة.</p></div>';
            return;
        }

        applicationsList.innerHTML = applications.map((application) => `
            <article class="dashboard-list-card" data-reveal>
                <div class="dashboard-list-head">
                    <div>
                        <strong>${application.name || 'بدون اسم'}</strong>
                        <span>${application.requestId}</span>
                    </div>
                    <span class="badge ${application.status || 'pending'}">${store.getStatusLabel(application.status)}</span>
                </div>
                <p>${application.governorate || 'غير محدد'} - ${application.city || 'غير محدد'} - ${application.village || 'غير محدد'}</p>
                <div class="dashboard-card-actions">
                    <a href="./status.html?requestId=${encodeURIComponent(application.requestId)}&nationalId=${encodeURIComponent(application.nationalId || '')}" class="btn-ghost">حالة الطلب</a>
                    <a href="./receipt.html?requestId=${encodeURIComponent(application.requestId)}" class="btn-ghost">الإيصال</a>
                </div>
            </article>
        `).join('');
    }

    function renderExams() {
        if (!examsList) return;
        const exams = metrics.latestExamAttempts;
        if (!exams.length) {
            examsList.innerHTML = '<div class="empty-state compact"><i class="fas fa-clipboard-check"></i><p>لا توجد محاولات امتحان مسجلة بعد.</p></div>';
            return;
        }

        examsList.innerHTML = exams.map((attempt) => `
            <article class="dashboard-list-card" data-reveal>
                <div class="dashboard-list-head">
                    <div>
                        <strong>${attempt.name || 'طالب المنصة'}</strong>
                        <span>${attempt.requestId}</span>
                    </div>
                    <strong class="score-chip">${attempt.percentage || 0}%</strong>
                </div>
                <p>نوع الامتحان: ${attempt.examLevel === 'senior' ? 'الكبار' : 'المرحلة الابتدائية'} - ${formatDate(attempt.date)}</p>
                <div class="dashboard-card-actions">
                    <a href="./exam-results.html?requestId=${encodeURIComponent(attempt.requestId)}" class="btn-ghost">تفاصيل النتيجة</a>
                    <a href="./verification.html?requestId=${encodeURIComponent(attempt.requestId)}" class="btn-ghost">التحقق من الأداء</a>
                </div>
            </article>
        `).join('');
    }

    function renderNotifications() {
        if (!notificationsList) return;
        if (!notifications.length) {
            notificationsList.innerHTML = '<div class="empty-state compact"><i class="fas fa-bell-slash"></i><p>لا توجد إشعارات حالية.</p></div>';
            return;
        }

        notificationsList.innerHTML = notifications.map((note) => `
            <article class="mini-notice-card" data-reveal>
                <span class="mini-badge">${getTypeLabel(note.type)}</span>
                <h3>${note.title}</h3>
                <p>${note.body}</p>
                <div class="dashboard-card-actions">
                    <small>${formatDate(note.createdAt)}</small>
                    ${note.actionUrl ? `<a href="${note.actionUrl}" class="btn-ghost">${note.actionLabel || 'فتح'}</a>` : ''}
                </div>
            </article>
        `).join('');
    }

    function getTypeLabel(type) {
        if (type === 'exam') return 'الامتحانات';
        if (type === 'finance') return 'الدفعات';
        if (type === 'application') return 'الطلبات';
        return 'تحديث';
    }
});
