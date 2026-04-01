document.addEventListener('DOMContentLoaded', () => {
    const authApi = window.QaryaAuth || null;
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

    enforceAdminOnlyPages();
    prunePrivilegedLinks();
    injectHeaderServiceDropdown();
    injectAuthSummary();
    injectHeaderQuickLinks();
    injectSidebarExtras();
    updateActiveLinks();
    updateHeaderState();
    initCounters();
    initFaqs();
    initCopyButtons();
    initRevealAnimations();
    bindDropdowns();
    bindAuthActions();

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

    function getUserInitial() {
        if (!authSession || !authSession.name) return 'ق';
        const parts = String(authSession.name).trim().split(/\s+/).filter(Boolean);
        return (parts[0] || 'ق').charAt(0);
    }

    function isAdminSession() {
        return Boolean(authApi?.isAdminSession?.(authSession));
    }

    function isPrivilegedHref(href) {
        const cleanHref = String(href || '').split('?')[0].split('#')[0];
        const fileName = cleanHref.split('/').pop() || '';
        return fileName === 'dashboard.html' || fileName === 'admin-dashboard.html';
    }

    function enforceAdminOnlyPages() {
        if ((currentFile === 'dashboard.html' || currentFile === 'admin-dashboard.html') && !isAdminSession()) {
            window.location.replace(getHomePath());
        }
    }

    function prunePrivilegedLinks() {
        if (isAdminSession()) {
            return;
        }

        Array.from(document.querySelectorAll('a[href]')).forEach((anchor) => {
            if (!isPrivilegedHref(anchor.getAttribute('href'))) {
                return;
            }

            const card = anchor.closest('.quick-link-card, .dashboard-action-card, .feature-panel-card');
            const navItem = anchor.closest('.nav-link, .sidebar-link, .sidebar-mini-link, .header-shortcut-link');
            const target = card || navItem || anchor;
            if (target) {
                target.remove();
            }
        });
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
            { href: `${prefix}verification.html`, icon: 'fa-file-circle-check', label: 'التحقق من الأداء' }
        ];
        const removableFiles = new Set(['exam-status.html', 'status.html', 'verification.html']);

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

    function injectAuthSummary() {
        if (!authSession) return;

        const headerContainer = siteHeader ? siteHeader.querySelector('.container') : null;
        if (headerContainer && !headerContainer.querySelector('[data-header-session="true"]')) {
            const headerCard = document.createElement('div');
            headerCard.className = 'header-session';
            headerCard.dataset.headerSession = 'true';
            headerCard.innerHTML = `
                <div class="header-session-main">
                    <span class="header-session-avatar">${getUserInitial()}</span>
                    <div class="header-session-copy">
                        <strong>${authSession.name}</strong>
                        <span>${authSession.role || 'مستخدم المنصة'}</span>
                    </div>
                </div>
                <button type="button" class="header-logout-btn" data-logout="true" aria-label="تسجيل الخروج">
                    <i class="fas fa-right-from-bracket"></i>
                    <span>تسجيل الخروج</span>
                </button>
            `;

            headerContainer.appendChild(headerCard);
        }

        if (siteSidebar && !siteSidebar.querySelector('[data-sidebar-profile="true"]')) {
            const sidebarCard = document.createElement('section');
            sidebarCard.className = 'sidebar-profile-card';
            sidebarCard.dataset.sidebarProfile = 'true';
            sidebarCard.innerHTML = `
                <div class="sidebar-profile-top">
                    <span class="sidebar-profile-avatar">${getUserInitial()}</span>
                    <div class="sidebar-profile-copy">
                        <strong>${authSession.name}</strong>
                        <span>${authSession.role || 'مستخدم المنصة'}</span>
                    </div>
                </div>
                <p class="sidebar-profile-email">${authSession.email || ''}</p>
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
    }

    function injectHeaderQuickLinks() {
        const headerContainer = siteHeader ? siteHeader.querySelector('.container') : null;
        if (!headerContainer || headerContainer.querySelector('[data-header-shortcuts="true"]') || !isAdminSession()) {
            return;
        }

        const prefix = getPrefix();
        const shortcuts = [
            { href: `${prefix}dashboard.html`, icon: 'fa-table-columns', label: 'اللوحة' },
            { href: `${prefix}admin-dashboard.html`, icon: 'fa-shield-halved', label: 'الأدمن' }
        ];

        const wrapper = document.createElement('div');
        wrapper.className = 'header-quick-links';
        wrapper.dataset.headerShortcuts = 'true';
        wrapper.innerHTML = shortcuts.map((item) => `
            <a href="${item.href}" class="header-shortcut-link">
                <i class="fas ${item.icon}"></i>
                <span>${item.label}</span>
            </a>
        `).join('');

        const sessionCard = headerContainer.querySelector('[data-header-session="true"]');
        if (sessionCard) {
            sessionCard.insertAdjacentElement('beforebegin', wrapper);
        } else {
            headerContainer.appendChild(wrapper);
        }
    }

    function bindAuthActions() {
        if (!authApi) return;

        Array.from(document.querySelectorAll('[data-logout]')).forEach((button) => {
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
        const links = [
            { href: `${prefix}receipt.html`, icon: 'fa-receipt', label: 'إيصال الطلب' },
            { href: `${prefix}exam-results.html`, icon: 'fa-square-poll-vertical', label: 'نتائج الامتحان' },
            { href: `${prefix}notifications.html`, icon: 'fa-bell', label: 'الإشعارات' },
            { href: `${prefix}support.html`, icon: 'fa-headset', label: 'الدعم' },
            { href: `${prefix}services.html`, icon: 'fa-layer-group', label: 'الخدمات' },
            { href: `${prefix}guide.html`, icon: 'fa-book-open', label: 'الدليل' },
            { href: `${prefix}announcements.html`, icon: 'fa-bullhorn', label: 'الإعلانات' },
            { href: `${prefix}exam-calendar.html`, icon: 'fa-calendar-days', label: 'الجدول' }
        ];

        if (isAdminSession()) {
            links.unshift(
                { href: `${prefix}admin-dashboard.html`, icon: 'fa-shield-halved', label: 'لوحة الأدمن' },
                { href: `${prefix}dashboard.html`, icon: 'fa-table-columns', label: 'لوحة التحكم' }
            );
        }

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