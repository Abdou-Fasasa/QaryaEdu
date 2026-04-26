document.addEventListener('DOMContentLoaded', async () => {
    const authApi = window.QaryaAuth;
    const store = window.QaryaPlatformStore;
    const session = authApi?.getSession?.();

    if (!authApi || !store || !session?.email) {
        window.location.href = '../login.html?next=pages/dashboard.html';
        return;
    }

    const elements = {
        welcome: document.getElementById('dashboard-welcome'),
        subtitle: document.getElementById('dashboard-subtitle'),
        roleBadge: document.getElementById('dashboard-role-badge'),
        statusBadge: document.getElementById('dashboard-status-badge'),
        notifications: document.getElementById('dashboard-stat-notifications'),
        support: document.getElementById('dashboard-stat-support'),
        balance: document.getElementById('dashboard-stat-balance'),
        exam: document.getElementById('dashboard-stat-exam'),
        highlightText: document.getElementById('dashboard-highlight-text'),
        highlightBadges: document.getElementById('dashboard-highlight-badges'),
        infoList: document.getElementById('dashboard-info-list'),
        focusList: document.getElementById('dashboard-focus-list'),
        routes: document.getElementById('dashboard-route-grid'),
        requestList: document.getElementById('dashboard-request-list'),
        activityList: document.getElementById('dashboard-activity-list')
    };

    function normalizeEmail(value) {
        return authApi.normalizeEmail?.(value || '') || String(value || '').trim().toLowerCase();
    }

    function formatDate(value) {
        if (!value) return 'غير متاح';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? 'غير متاح' : date.toLocaleString('ar-EG');
    }

    function formatMoney(value) {
        return `${Number(value || 0).toLocaleString('en-US')} EGP`;
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getRoleLabel(user) {
        return authApi.getManagementRoleLabel?.(user) || user?.role || 'مستخدم المنصة';
    }

    function getAllVisibleNotifications(email) {
        const globalNotes = store.getNotifications?.() || [];
        const privateNotes = authApi.canReceivePrivateNotifications?.(email)
            ? authApi.getPrivateNotifications?.(email) || []
            : [];

        return [...privateNotes, ...globalNotes].filter((note) => {
            const endAt = note?.endAt ? new Date(note.endAt).getTime() : 0;
            return !endAt || endAt > Date.now();
        });
    }

    function findApplication(user) {
        const normalizedEmail = normalizeEmail(user?.email);
        const applications = store.getAllApplications?.() || [];

        return applications.find((application) => (
            normalizeEmail(application.studentEmail) === normalizedEmail
            || String(application.requestId || '').trim() === String(user?.requestId || '').trim()
            || (user?.nationalId && String(application.nationalId || '').trim() === String(user.nationalId).trim())
        )) || null;
    }

    function getApplicationStatusLabel(application) {
        if (!application) return 'لم يتم ربط طلب بالحساب بعد';
        return store.getStatusLabel?.(application.status) || application.status || 'غير محدد';
    }

    function getExamSummary(application) {
        if (!application?.requestId) {
            return { label: 'لا توجد نتيجة', detail: 'لم يتم ربط طلب امتحان بالحساب.' };
        }

        const attempts = store.getExamHistoryByRequestId?.(application.requestId) || [];
        const latest = attempts[0] || null;
        if (!latest) {
            return { label: 'لم يبدأ بعد', detail: 'لا توجد محاولة امتحان مسجلة على هذا الطلب.' };
        }

        return {
            label: `${Number(latest.percentage || 0)}%`,
            detail: latest.passed ? 'آخر محاولة ناجحة.' : 'آخر محاولة تحتاج مراجعة.'
        };
    }

    function getSupportSummary(user) {
        const thread = store.getSupportThreadByEmail?.(user?.email) || null;
        if (!thread) {
            return {
                count: 0,
                unread: 0,
                status: 'لا توجد محادثة دعم',
                preview: 'يمكنك بدء محادثة جديدة مع الإدارة متى احتجت.'
            };
        }

        return {
            count: Array.isArray(thread.messages) ? thread.messages.length : 0,
            unread: Number(thread.unreadByUser || 0),
            status: thread.status === 'closed' ? 'المحادثة مغلقة' : 'المحادثة مفتوحة',
            preview: thread.lastMessagePreview || 'لا توجد معاينة متاحة'
        };
    }

    function getLatestTransaction(user) {
        const transactions = authApi.getTransactionsByEmail?.(user?.email) || [];
        return transactions[0] || null;
    }

    function getTransactionStatusLabel(transaction) {
        if (!transaction) return 'لا توجد حركة سحب';
        if (transaction.status === 'completed') return 'تم التنفيذ';
        if (transaction.status === 'rejected') return 'مرفوض';
        if (transaction.status === 'error') return 'خطأ في البيانات';
        return 'قيد المراجعة';
    }

    function buildRoutes(user, application, notificationCount, supportSummary) {
        const isAdmin = Boolean(authApi.isAdminSession?.(user) || authApi.isLeader?.(user?.email));
        const canWallet = Boolean(authApi.canAccessWallet?.(user?.email || user));

        const routes = [
            {
                href: './notifications.html',
                icon: 'fa-bell',
                title: 'الإشعارات',
                description: notificationCount ? `لديك ${notificationCount} إشعار نشط الآن.` : 'لا توجد إشعارات نشطة حالياً.',
                action: 'فتح المركز'
            },
            {
                href: './complaints.html',
                icon: 'fa-headset',
                title: 'الدعم والشات',
                description: supportSummary.unread ? `لديك ${supportSummary.unread} رسائل غير مقروءة.` : supportSummary.status,
                action: 'فتح الدعم'
            },
            {
                href: './status.html',
                icon: 'fa-file-lines',
                title: 'حالة الطلب',
                description: application ? `الطلب ${application.requestId} - ${getApplicationStatusLabel(application)}` : 'تحقق من حالة الطلب أو أكمل التسجيل أولاً.',
                action: 'فتح الطلب'
            },
            {
                href: './exam-status.html',
                icon: 'fa-pen-to-square',
                title: 'الامتحان',
                description: application?.examAccess === 'blocked' ? 'الامتحان موقوف على هذا الطلب حالياً.' : 'متابعة البوابة والدخول في الوقت المتاح.',
                action: 'فتح الامتحان'
            },
            {
                href: './settings.html',
                icon: 'fa-gear',
                title: 'الإعدادات',
                description: 'تعديل بيانات الحساب وتفضيلات الإشعارات والأمان.',
                action: 'فتح الإعدادات'
            }
        ];

        if (canWallet) {
            routes.splice(2, 0, {
                href: './wallet.html',
                icon: 'fa-wallet',
                title: 'المحفظة',
                description: `رصيدك الحالي ${formatMoney(user?.balance || 0)}.`,
                action: 'فتح المحفظة'
            });
        }

        if (isAdmin) {
            routes.unshift({
                href: './leader-admin.html',
                icon: 'fa-user-shield',
                title: 'لوحة الإدارة',
                description: 'الوصول المباشر إلى الطلاب والدعم والماليات والإشعارات.',
                action: 'فتح الإدارة'
            });
        }

        return routes;
    }

    function renderList(target, items) {
        if (!target) return;
        target.innerHTML = items.map((item) => `
            <li>
                <div>
                    <strong>${escapeHtml(item.title)}</strong>
                    <span>${escapeHtml(item.detail)}</span>
                </div>
                <small>${escapeHtml(item.meta)}</small>
            </li>
        `).join('');
    }

    function renderRoutes(routes) {
        if (!elements.routes) return;
        elements.routes.innerHTML = routes.map((route) => `
            <article class="dashboard-route-card">
                <i class="fas ${escapeHtml(route.icon)}"></i>
                <h3>${escapeHtml(route.title)}</h3>
                <p>${escapeHtml(route.description)}</p>
                <a href="${route.href}" class="btn-ghost">${escapeHtml(route.action)}</a>
            </article>
        `).join('');
    }

    async function render(forceRemote = false) {
        if (forceRemote) {
            await store.refreshFromRemote?.({ force: true });
            await authApi.refreshFromRemote?.({ force: true });
        }

        const liveSession = authApi.getSession?.() || session;
        const user = authApi.getUserByEmail?.(liveSession.email) || liveSession;
        const application = findApplication(user);
        const examSummary = getExamSummary(application);
        const supportSummary = getSupportSummary(user);
        const latestTransaction = getLatestTransaction(user);
        const notifications = getAllVisibleNotifications(user.email);
        const routes = buildRoutes(user, application, notifications.length, supportSummary);
        const isAdmin = Boolean(authApi.isAdminSession?.(user) || authApi.isLeader?.(user?.email));

        if (elements.welcome) elements.welcome.textContent = `أهلاً ${user.name || 'بك'}، هذه لوحة متابعتك الآن`;
        if (elements.subtitle) {
            elements.subtitle.textContent = isAdmin
                ? 'ملخص سريع للحساب مع اختصارات الإدارة والتنبيهات والدعم والماليات.'
                : 'ملخص سريع للحساب والطلب والامتحان والمحفظة والإشعارات من صفحة واحدة.';
        }
        if (elements.roleBadge) elements.roleBadge.textContent = getRoleLabel(user);
        if (elements.statusBadge) elements.statusBadge.textContent = application ? getApplicationStatusLabel(application) : 'بدون طلب مرتبط';
        if (elements.notifications) elements.notifications.textContent = notifications.length.toLocaleString('ar-EG');
        if (elements.support) elements.support.textContent = supportSummary.count.toLocaleString('ar-EG');
        if (elements.balance) elements.balance.textContent = formatMoney(user.balance || 0);
        if (elements.exam) elements.exam.textContent = examSummary.label;
        if (elements.highlightText) {
            elements.highlightText.textContent = application
                ? `الطلب ${application.requestId} حالته الآن: ${getApplicationStatusLabel(application)}.`
                : 'لا يوجد طلب مرتبط بهذا الحساب حتى الآن. يمكنك متابعة التسجيل أو ربط الطلب الحالي.';
        }

        if (elements.highlightBadges) {
            elements.highlightBadges.innerHTML = [
                `<span class="notification-chip"><i class="fas fa-bell"></i> ${escapeHtml(`${notifications.length} إشعار`)}</span>`,
                `<span class="notification-chip is-soft"><i class="fas fa-headset"></i> ${escapeHtml(`${supportSummary.unread} غير مقروء`)}</span>`,
                `<span class="notification-chip is-warm"><i class="fas fa-wallet"></i> ${escapeHtml(formatMoney(user.balance || 0))}</span>`
            ].join('');
        }

        if (elements.infoList) {
            elements.infoList.innerHTML = [
                `<span class="dashboard-info-pill">${escapeHtml(`آخر دخول: ${formatDate(user.lastLoginAt)}`)}</span>`,
                `<span class="dashboard-info-pill">${escapeHtml(`الطلب: ${application?.requestId || 'غير مرتبط'}`)}</span>`,
                `<span class="dashboard-info-pill">${escapeHtml(`الدعم: ${supportSummary.status}`)}</span>`,
                `<span class="dashboard-info-pill">${escapeHtml(`الامتحان: ${examSummary.detail}`)}</span>`
            ].join('');
        }

        renderList(elements.focusList, [
            {
                title: notifications.length ? 'مراجعة الإشعارات' : 'المركز هادئ الآن',
                detail: notifications.length ? 'توجد تنبيهات نشطة تحتاج متابعة من مركز الإشعارات.' : 'لا توجد تنبيهات عاجلة حالياً.',
                meta: 'الإشعارات'
            },
            {
                title: supportSummary.unread ? 'متابعة رسائل الدعم' : 'الدعم تحت السيطرة',
                detail: supportSummary.unread ? `لديك ${supportSummary.unread} رسالة غير مقروءة داخل محادثة الدعم.` : supportSummary.preview,
                meta: 'الدعم'
            },
            {
                title: latestTransaction ? getTransactionStatusLabel(latestTransaction) : 'لا توجد حركة سحب',
                detail: latestTransaction ? `${formatMoney(latestTransaction.amount)} - ${formatDate(latestTransaction.createdAt)}` : 'يمكنك فتح المحفظة لمتابعة الرصيد وطلبات السحب.',
                meta: 'الماليات'
            }
        ]);

        renderRoutes(routes);

        renderList(elements.requestList, [
            {
                title: application ? getApplicationStatusLabel(application) : 'لا يوجد طلب مرتبط',
                detail: application ? `رقم الطلب ${application.requestId}` : 'اربط الطلب الحالي بالحساب أو أكمل التسجيل.',
                meta: 'الحالة'
            },
            {
                title: application?.examAccess === 'blocked' ? 'الامتحان موقوف' : 'الامتحان متاح حسب الحالة',
                detail: application ? (store.getExamAccessLabel?.(application.examAccess) || application.examAccess || 'غير محدد') : 'لا توجد بيانات امتحان بعد.',
                meta: 'الامتحان'
            },
            {
                title: examSummary.label,
                detail: examSummary.detail,
                meta: 'آخر نتيجة'
            }
        ]);

        renderList(elements.activityList, [
            {
                title: latestTransaction ? getTransactionStatusLabel(latestTransaction) : 'بدون سحب',
                detail: latestTransaction ? `${formatMoney(latestTransaction.amount)} - ${latestTransaction.adminMessage || 'لا توجد رسالة إضافية.'}` : 'لا توجد عملية سحب مسجلة حتى الآن.',
                meta: 'المحفظة'
            },
            {
                title: supportSummary.status,
                detail: supportSummary.preview,
                meta: 'الدعم'
            },
            {
                title: `${notifications.length} إشعار نشط`,
                detail: notifications[0]?.title || 'لا توجد إشعارات تحتاج متابعة الآن.',
                meta: 'الإشعارات'
            }
        ]);
    }

    window.addEventListener(store.storeEventName || 'qarya:store-updated', () => { void render(false); });
    window.addEventListener(authApi.storeEventName || 'qarya_auth_store_updated', () => { void render(false); });
    void render(true);
});
