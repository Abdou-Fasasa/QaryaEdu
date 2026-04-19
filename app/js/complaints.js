(() => {
    const authApi = window.QaryaAuth || null;
    const telegramApi = window.QaryaTelegram || null;
    const SUPPORT_GUEST_KEY = 'qaryaeduSupportGuestProfile';
    const STORE_READY_EVENT = 'qarya:platform-store-ready';
    const STORE_UPDATED_EVENT = 'qarya:store-updated';

    const faqButtons = Array.from(document.querySelectorAll('[data-support-faq-question]'));
    const answerCard = document.getElementById('support-answer-card');
    const answerTitle = document.getElementById('support-answer-title');
    const answerText = document.getElementById('support-answer-text');
    const threadState = document.getElementById('support-thread-state');
    const composeNote = document.getElementById('support-compose-note');
    const messagesEl = document.getElementById('support-page-messages');
    const emptyEl = document.getElementById('support-page-empty');
    const formEl = document.getElementById('support-page-form');
    const guestFieldsEl = document.getElementById('support-guest-fields');
    const guestNameEl = document.getElementById('support-guest-name');
    const guestEmailEl = document.getElementById('support-guest-email');
    const inputEl = document.getElementById('support-page-input');
    const sendBtn = document.getElementById('support-page-send-btn');

    const state = {
        sending: false,
        renderQueued: false,
        lastMessageKey: ''
    };

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function normalizeEmail(value) {
        return String(value || '').trim().toLowerCase();
    }

    function getStoreApi() {
        return window.QaryaPlatformStore || null;
    }

    async function waitForStoreApi(timeoutMs = 4500) {
        const store = getStoreApi();
        if (store) return store;

        return await new Promise((resolve) => {
            let settled = false;
            const finish = () => {
                if (settled) return;
                const readyStore = getStoreApi();
                if (!readyStore) return;
                settled = true;
                cleanup();
                resolve(readyStore);
            };
            const fallback = () => {
                if (settled) return;
                settled = true;
                cleanup();
                resolve(getStoreApi());
            };
            const cleanup = () => {
                window.removeEventListener(STORE_READY_EVENT, finish);
                if (timeoutId) window.clearTimeout(timeoutId);
            };
            const timeoutId = window.setTimeout(fallback, timeoutMs);
            window.addEventListener(STORE_READY_EVENT, finish, { once: true });
        });
    }

    function readGuestProfile() {
        try {
            const stored = JSON.parse(localStorage.getItem(SUPPORT_GUEST_KEY) || '{}');
            const name = String(stored?.name || '').trim();
            const email = normalizeEmail(stored?.email);
            return name && email ? { name, email } : null;
        } catch (error) {
            return null;
        }
    }

    function saveGuestProfile(name, email) {
        localStorage.setItem(SUPPORT_GUEST_KEY, JSON.stringify({
            name: String(name || '').trim(),
            email: normalizeEmail(email)
        }));
    }

    function getSession() {
        return authApi?.getSession?.() || null;
    }

    function getIdentity() {
        const session = getSession();
        if (session?.email) {
            const profile = authApi?.getUserByEmail?.(session.email) || session;
            return {
                authenticated: true,
                email: normalizeEmail(profile.email || session.email),
                name: String(profile.name || session.name || 'مستخدم المنصة').trim(),
                role: String(
                    profile.role
                    || authApi?.getManagementRoleLabel?.(profile)
                    || 'مستخدم المنصة'
                ).trim()
            };
        }

        const guest = readGuestProfile();
        if (!guest) {
            return {
                authenticated: false,
                email: '',
                name: '',
                role: 'زائر'
            };
        }

        return {
            authenticated: false,
            email: guest.email,
            name: guest.name,
            role: 'زائر'
        };
    }

    function getStoredThread(storeApi, identity = getIdentity()) {
        if (!storeApi?.getSupportThreadByEmail || !identity?.email) return null;
        return storeApi.getSupportThreadByEmail(identity.email) || null;
    }

    function getVisibleThread(storeApi, identity = getIdentity()) {
        const thread = getStoredThread(storeApi, identity);
        if (!thread) return null;
        if (thread.deletedForUser || thread.status === 'closed') return null;
        return thread;
    }

    function autoResizeInput() {
        if (!inputEl) return;
        inputEl.style.height = '0px';
        inputEl.style.height = `${Math.min(Math.max(inputEl.scrollHeight, 120), 260)}px`;
    }

    function scrollMessagesToBottom() {
        if (!messagesEl) return;
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function setSendingState(isSending) {
        state.sending = Boolean(isSending);
        if (sendBtn) {
            sendBtn.disabled = state.sending;
            sendBtn.classList.toggle('is-loading', state.sending);
        }
    }

    function setThreadState(primary, secondary) {
        if (!threadState) return;
        const strong = threadState.querySelector('strong');
        const small = threadState.querySelector('small');
        if (strong) strong.textContent = primary;
        if (small) small.textContent = secondary;
    }

    function getMessageSignature(messages) {
        const list = Array.isArray(messages) ? messages : [];
        const last = list[list.length - 1];
        return `${list.length}:${last?.id || ''}:${last?.createdAt || ''}`;
    }

    function buildMessageMarkup(message) {
        const sender = message?.sender === 'admin'
            ? 'admin'
            : message?.sender === 'bot'
                ? 'bot'
                : 'user';
        const senderLabel = sender === 'admin'
            ? 'الدعم الإداري'
            : sender === 'bot'
                ? 'المساعد الآلي'
                : 'أنت';
        const avatarLabel = sender === 'admin' ? 'د' : sender === 'bot' ? 'آ' : 'أ';
        const timeLabel = new Date(message?.createdAt || Date.now()).toLocaleString('ar-EG');

        return `
            <article class="support-chat-page-message is-${sender}">
                ${sender === 'user' ? '' : `<span class="support-chat-page-avatar">${escapeHtml(avatarLabel)}</span>`}
                <div class="support-chat-page-bubble">
                    <span class="support-chat-page-sender">${escapeHtml(senderLabel)}</span>
                    <p>${escapeHtml(message?.text || '')}</p>
                    <small>${escapeHtml(timeLabel)}</small>
                </div>
                ${sender === 'user' ? `<span class="support-chat-page-avatar support-chat-page-avatar-user">${escapeHtml(avatarLabel)}</span>` : ''}
            </article>
        `;
    }

    function showAnswer(question, answer) {
        if (!answerCard || !answerTitle || !answerText) return;
        answerCard.hidden = false;
        answerTitle.textContent = question;
        answerText.textContent = answer;
    }

    function getAdminRecipients() {
        if (!authApi?.getAllUsers) return [];
        return authApi.getAllUsers()
            .filter((user) => authApi.isAdminSession?.(user.email))
            .map((user) => normalizeEmail(user.email))
            .filter(Boolean);
    }

    async function notifyAdminsAboutSupportMessage(text, senderName) {
        const recipients = getAdminRecipients();
        if (!recipients.length || !authApi?.pushPrivateNotification) return;

        await Promise.all(recipients.map((email) => authApi.pushPrivateNotification(email, {
            title: `رسالة دعم جديدة من ${senderName || 'مستخدم المنصة'}`,
            body: text,
            type: 'support',
            actionUrl: './leader-admin.html',
            actionLabel: 'فتح لوحة الإدارة',
            displayMode: 'feed',
            sticky: false
        })));
    }

    async function markThreadReadForUser() {
        const storeApi = (await waitForStoreApi()) || getStoreApi();
        const identity = getIdentity();
        const thread = getVisibleThread(storeApi, identity);

        if (!storeApi?.markSupportThreadRead || !thread || Number(thread.unreadByUser || 0) <= 0) {
            return;
        }

        storeApi.markSupportThreadRead(identity.email, 'user');
        Promise.resolve(storeApi.syncNow?.()).catch(() => {});
    }

    function render() {
        const storeApi = getStoreApi();
        const identity = getIdentity();
        const storedThread = getStoredThread(storeApi, identity);
        const visibleThread = getVisibleThread(storeApi, identity);
        const messages = Array.isArray(visibleThread?.messages) ? visibleThread.messages : [];

        if (guestFieldsEl) {
            guestFieldsEl.hidden = Boolean(identity?.authenticated);
        }

        if (!identity?.authenticated) {
            const guest = readGuestProfile();
            if (guestNameEl && !String(guestNameEl.value || '').trim() && guest?.name) {
                guestNameEl.value = guest.name;
            }
            if (guestEmailEl && !normalizeEmail(guestEmailEl.value || '') && guest?.email) {
                guestEmailEl.value = guest.email;
            }
        }

        if (messagesEl) {
            messagesEl.innerHTML = messages.map((message) => buildMessageMarkup(message)).join('');
            messagesEl.hidden = messages.length === 0;

            const nextMessageKey = getMessageSignature(messages);
            if (nextMessageKey !== state.lastMessageKey && messages.length) {
                state.lastMessageKey = nextMessageKey;
                requestAnimationFrame(scrollMessagesToBottom);
            }
        }

        if (emptyEl) {
            emptyEl.hidden = messages.length > 0;
        }

        if (storedThread?.deletedForUser || storedThread?.status === 'closed') {
            setThreadState('ابدأ محادثة جديدة', 'تم إغلاق المحادثة السابقة ويمكنك إرسال رسالة جديدة الآن.');
            if (composeNote) {
                composeNote.textContent = 'أرسل رسالة جديدة وسيتم فتح محادثة جديدة مباشرة مع الإدارة.';
            }
        } else if (messages.length) {
            const unread = Number(visibleThread?.unreadByUser || 0);
            setThreadState(
                unread > 0 ? `${unread} ردود جديدة` : 'المحادثة نشطة',
                `آخر تحديث: ${new Date(visibleThread?.updatedAt || Date.now()).toLocaleString('ar-EG')}`
            );
            if (composeNote) {
                composeNote.textContent = 'الردود الجديدة ستظهر هنا تلقائيًا، ويمكنك متابعة نفس المحادثة من هذا الجهاز.';
            }
        } else if (identity?.authenticated) {
            setThreadState('جاهز للاستقبال', 'اكتب رسالتك وسيتم حفظها داخل المنصة مباشرة.');
            if (composeNote) {
                composeNote.textContent = 'بمجرد إرسال الرسالة ستبدأ محادثتك مع الإدارة من نفس الشاشة.';
            }
        } else {
            setThreadState('أدخل بياناتك أولًا', 'اكتب الاسم والبريد مرة واحدة فقط لبدء المحادثة ومتابعة الردود.');
            if (composeNote) {
                composeNote.textContent = 'الخدمة متاحة للزوار والمستخدمين، لكن يلزم اسم وبريد صحيحان قبل الإرسال.';
            }
        }

        autoResizeInput();
    }

    function queueRender() {
        if (state.renderQueued) return;
        state.renderQueued = true;
        requestAnimationFrame(() => {
            state.renderQueued = false;
            render();
            void markThreadReadForUser();
        });
    }

    async function handleSubmit(event) {
        event?.preventDefault();
        if (state.sending) return;

        const storeApi = (await waitForStoreApi(5000)) || getStoreApi();
        if (!storeApi?.sendSupportMessage) return;

        const text = String(inputEl?.value || '').trim();
        if (!text) {
            inputEl?.focus();
            return;
        }

        let identity = getIdentity();
        if (!identity?.authenticated) {
            const guestName = String(guestNameEl?.value || '').trim();
            const guestEmail = normalizeEmail(guestEmailEl?.value || '');

            if (!guestName) {
                guestNameEl?.focus();
                return;
            }

            if (!guestEmail || !guestEmail.includes('@')) {
                guestEmailEl?.focus();
                return;
            }

            saveGuestProfile(guestName, guestEmail);
            identity = getIdentity();
        }

        if (!identity?.email) return;

        setSendingState(true);

        try {
            storeApi.sendSupportMessage({
                email: identity.email,
                userName: identity.name,
                role: identity.role || 'مستخدم المنصة',
                sender: 'user',
                senderName: identity.name,
                text
            });

            if (inputEl) {
                inputEl.value = '';
            }

            queueRender();
            inputEl?.focus();

            Promise.resolve(storeApi.syncNow?.()).catch(() => {});
            Promise.resolve(authApi?.syncNow?.()).catch(() => {});
            Promise.resolve(notifyAdminsAboutSupportMessage(text, identity.name)).catch((error) => {
                console.error('Admin support notification failed:', error);
            });

            if (telegramApi?.sendComplaint) {
                Promise.resolve(telegramApi.sendComplaint({
                    trackingId: `CHAT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
                    studentName: identity.name,
                    email: identity.email,
                    type: 'دردشة مباشرة / دعم فني',
                    details: text,
                    createdAt: new Date().toISOString()
                })).catch(() => {});
            }
        } finally {
            setSendingState(false);
        }
    }

    faqButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const question = String(button.dataset.supportFaqQuestion || '').trim();
            const answer = String(button.dataset.supportFaqAnswer || '').trim();
            if (!question || !answer) return;

            showAnswer(question, answer);

            if (!String(inputEl?.value || '').trim()) {
                inputEl.value = `${question}\n`;
            }

            autoResizeInput();
            inputEl?.focus();
        });
    });

    inputEl?.addEventListener('input', autoResizeInput);
    inputEl?.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            void handleSubmit(event);
        }
    });

    formEl?.addEventListener('submit', handleSubmit);
    window.addEventListener(STORE_UPDATED_EVENT, queueRender);
    window.addEventListener(authApi?.storeEventName || 'qarya_auth_store_updated', queueRender);

    render();
    void waitForStoreApi().then(() => {
        queueRender();
    });
})();
