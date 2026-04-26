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
    const imageInputEl = document.getElementById('support-page-image-input');
    const imageTriggerEl = document.getElementById('support-page-image-trigger');
    const imageUploadsEl = document.getElementById('support-page-uploads');
    const imageCountEl = document.getElementById('support-page-image-count');

    const state = {
        sending: false,
        renderQueued: false,
        lastMessageKey: '',
        pendingAttachments: []
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

    function normalizeAttachment(attachment = {}) {
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

    function getMessagePreview(message = {}) {
        const text = String(message.text || '').trim();
        if (text) return text;

        const attachments = (Array.isArray(message.attachments) ? message.attachments : [])
            .map((item) => normalizeAttachment(item))
            .filter(Boolean);
        if (!attachments.length) return '';
        if (attachments.length === 1) return 'تم إرفاق صورة واحدة.';
        return `تم إرفاق ${attachments.length} صور.`;
    }

    function readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(reader.error || new Error('file-read-failed'));
            reader.readAsDataURL(file);
        });
    }

    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('image-load-failed'));
            image.src = src;
        });
    }

    async function buildAttachmentFromFile(file) {
        const src = await readFileAsDataUrl(file);
        const image = await loadImage(src);
        const maxEdge = 1280;
        const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
        const width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
        const height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        context?.drawImage(image, 0, 0, width, height);

        let compressedSrc = canvas.toDataURL('image/jpeg', 0.84);
        if (compressedSrc.length > 650000) {
            compressedSrc = canvas.toDataURL('image/jpeg', 0.72);
        }

        return normalizeAttachment({
            id: `SUPATT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: 'image',
            name: file.name || 'image.jpg',
            mimeType: 'image/jpeg',
            src: compressedSrc,
            size: Number(file.size || 0),
            width,
            height
        });
    }

    function buildAttachmentsMarkup(attachments, baseClass) {
        const safeAttachments = (Array.isArray(attachments) ? attachments : [])
            .map((item) => normalizeAttachment(item))
            .filter(Boolean);
        if (!safeAttachments.length) return '';

        return `
            <div class="${baseClass}-attachments">
                ${safeAttachments.map((attachment, index) => `
                    <a class="${baseClass}-attachment" href="${attachment.src}" target="_blank" rel="noreferrer" aria-label="فتح الصورة ${index + 1}">
                        <img src="${attachment.src}" alt="${escapeHtml(attachment.name || `attachment-${index + 1}`)}" loading="lazy" />
                    </a>
                `).join('')}
            </div>
        `;
    }

    function getReadLabel(message) {
        if (message?.sender !== 'user') return '';
        return message.readByAdminAt ? 'مقروءة' : 'تم الإرسال';
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

    function renderPendingAttachments() {
        if (!imageUploadsEl) return;

        imageUploadsEl.hidden = state.pendingAttachments.length === 0;
        imageUploadsEl.innerHTML = state.pendingAttachments.map((attachment, index) => `
            <div class="support-chat-upload-chip">
                <img src="${attachment.src}" alt="${escapeHtml(attachment.name || `attachment-${index + 1}`)}" />
                <div class="support-chat-upload-copy">
                    <strong>${escapeHtml(attachment.name || `صورة ${index + 1}`)}</strong>
                    <span>${attachment.width > 0 && attachment.height > 0 ? `${attachment.width}×${attachment.height}` : 'صورة مرفقة'}</span>
                </div>
                <button type="button" class="support-chat-upload-remove" data-remove-attachment="${attachment.id}" aria-label="حذف الصورة">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');

        if (imageCountEl) {
            imageCountEl.hidden = state.pendingAttachments.length === 0;
            imageCountEl.textContent = state.pendingAttachments.length > 9 ? '+9' : String(state.pendingAttachments.length);
        }
    }

    function clearPendingAttachments() {
        state.pendingAttachments = [];
        if (imageInputEl) imageInputEl.value = '';
        renderPendingAttachments();
    }

    function setSendingState(isSending) {
        state.sending = Boolean(isSending);
        if (sendBtn) {
            sendBtn.disabled = state.sending || (!String(inputEl?.value || '').trim() && state.pendingAttachments.length === 0);
            sendBtn.classList.toggle('is-loading', state.sending);
        }
        if (imageInputEl) {
            imageInputEl.disabled = state.sending;
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
        const attachmentsHtml = buildAttachmentsMarkup(message?.attachments, 'support-chat-page');
        const readLabel = getReadLabel(message);

        return `
            <article class="support-chat-page-message is-${sender}">
                ${sender === 'user' ? '' : `<span class="support-chat-page-avatar">${escapeHtml(avatarLabel)}</span>`}
                <div class="support-chat-page-bubble">
                    <span class="support-chat-page-sender">${escapeHtml(senderLabel)}</span>
                    ${message?.text ? `<p>${escapeHtml(message.text)}</p>` : ''}
                    ${attachmentsHtml}
                    <div class="support-chat-page-meta-row">
                        <small>${escapeHtml(timeLabel)}</small>
                        ${readLabel ? `<small class="support-chat-page-read-state">${escapeHtml(readLabel)}</small>` : ''}
                    </div>
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
        const unread = Number(visibleThread?.unreadByUser || 0);

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
            setThreadState(
                unread > 0 ? `${unread} ردود جديدة` : 'المحادثة نشطة',
                `آخر تحديث: ${new Date(visibleThread?.updatedAt || Date.now()).toLocaleString('ar-EG')}`
            );
            if (composeNote) {
                composeNote.textContent = state.pendingAttachments.length
                    ? `تم تجهيز ${state.pendingAttachments.length} ${state.pendingAttachments.length === 1 ? 'صورة' : 'صور'} للإرسال.`
                    : (unread > 0
                        ? `لديك ${unread} ${unread === 1 ? 'رسالة غير مقروءة' : 'رسائل غير مقروءة'} داخل المحادثة.`
                        : 'يمكنك إرفاق الصور أو إرسال رسالة نصية، وستظهر حالة القراءة تلقائيًا.');
            }
        } else if (identity?.authenticated) {
            setThreadState('جاهز للاستقبال', 'اكتب رسالتك وسيتم حفظها داخل المنصة مباشرة.');
            if (composeNote) {
                composeNote.textContent = state.pendingAttachments.length
                    ? `تم تجهيز ${state.pendingAttachments.length} ${state.pendingAttachments.length === 1 ? 'صورة' : 'صور'} للإرسال.`
                    : 'أرسل النص أو الصور وستبدأ محادثتك مع الإدارة من نفس الشاشة.';
            }
        } else {
            setThreadState('أدخل بياناتك أولًا', 'اكتب الاسم والبريد مرة واحدة فقط لبدء المحادثة ومتابعة الردود.');
            if (composeNote) {
                composeNote.textContent = state.pendingAttachments.length
                    ? `تم تجهيز ${state.pendingAttachments.length} ${state.pendingAttachments.length === 1 ? 'صورة' : 'صور'} للإرسال بعد إدخال بياناتك.`
                    : 'الخدمة متاحة للزوار والمستخدمين، لكن يلزم اسم وبريد صحيحان قبل الإرسال.';
            }
        }

        autoResizeInput();
        renderPendingAttachments();
        setSendingState(state.sending);
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

    async function appendAttachments(files) {
        const validFiles = Array.from(files || []).filter((file) => String(file?.type || '').startsWith('image/'));
        if (!validFiles.length) return;

        const availableSlots = Math.max(0, 3 - state.pendingAttachments.length);
        if (availableSlots <= 0) {
            return;
        }

        const prepared = await Promise.all(validFiles.slice(0, availableSlots).map((file) => buildAttachmentFromFile(file)));
        state.pendingAttachments = [...state.pendingAttachments, ...prepared.filter(Boolean)].slice(0, 3);
        queueRender();
    }

    async function handleSubmit(event) {
        event?.preventDefault();
        if (state.sending) return;

        const storeApi = (await waitForStoreApi(5000)) || getStoreApi();
        if (!storeApi?.sendSupportMessage) return;

        const text = String(inputEl?.value || '').trim();
        const attachments = state.pendingAttachments.slice(0, 3);
        if (!text && !attachments.length) {
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
                text,
                attachments
            });

            if (inputEl) {
                inputEl.value = '';
            }
            clearPendingAttachments();

            queueRender();
            inputEl?.focus();

            Promise.resolve(storeApi.syncNow?.()).catch(() => {});
            Promise.resolve(authApi?.syncNow?.()).catch(() => {});
            Promise.resolve(notifyAdminsAboutSupportMessage(text || getMessagePreview({ attachments }), identity.name)).catch((error) => {
                console.error('Admin support notification failed:', error);
            });

            if (telegramApi?.sendComplaint) {
                Promise.resolve(telegramApi.sendComplaint({
                    trackingId: `CHAT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
                    studentName: identity.name,
                    email: identity.email,
                    type: 'دردشة مباشرة / دعم فني',
                    details: text || getMessagePreview({ attachments }),
                    createdAt: new Date().toISOString()
                })).catch(() => {});
            }
        } finally {
            setSendingState(false);
            queueRender();
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

    inputEl?.addEventListener('input', () => {
        autoResizeInput();
        setSendingState(state.sending);
    });
    inputEl?.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            void handleSubmit(event);
        }
    });

    imageTriggerEl?.addEventListener('click', () => {
        imageInputEl?.click();
    });
    imageInputEl?.addEventListener('change', async (event) => {
        try {
            await appendAttachments(event.target?.files);
        } catch (error) {
            console.error('Support attachment failed:', error);
        }
    });
    imageUploadsEl?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-remove-attachment]');
        if (!button) return;
        state.pendingAttachments = state.pendingAttachments.filter((attachment) => attachment.id !== button.dataset.removeAttachment);
        queueRender();
    });

    formEl?.addEventListener('submit', handleSubmit);
    window.addEventListener(STORE_UPDATED_EVENT, queueRender);
    window.addEventListener(STORE_READY_EVENT, queueRender);
    window.addEventListener(authApi?.storeEventName || 'qarya_auth_store_updated', queueRender);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            void markThreadReadForUser();
            queueRender();
        }
    });

    queueRender();
})();
