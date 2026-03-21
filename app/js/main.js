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
    const overlay = createOverlay();

    injectAuthSummary();
    injectSidebarExtras();
    updateActiveLinks();
    updateHeaderState();
    initCounters();
    initFaqs();
    initCopyButtons();
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

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            setSidebarState(false);
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
        if (!siteSidebar) {
            return;
        }

        siteSidebar.classList.toggle('open', isOpen);
        overlay.classList.toggle('open', isOpen);
        document.body.classList.toggle('nav-open', isOpen);
    }

    function getPrefix() {
        return window.location.pathname.includes('/pages/') ? './' : './pages/';
    }

    function getLoginPath() {
        return window.location.pathname.includes('/pages/') ? '../login.html' : './login.html';
    }

    function getUserInitial() {
        if (!authSession || !authSession.name) {
            return 'ق';
        }

        const parts = String(authSession.name).trim().split(/\s+/).filter(Boolean);
        return (parts[0] || 'ق').charAt(0);
    }

    function injectAuthSummary() {
        if (!authSession) {
            return;
        }

        const headerContainer = siteHeader ? siteHeader.querySelector('.container') : null;
        if (headerContainer && !headerContainer.querySelector('[data-header-session="true"]')) {
            const headerCard = document.createElement('div');
            headerCard.className = 'header-session';
            headerCard.dataset.headerSession = 'true';
            headerCard.innerHTML = `
                <span class="header-session-avatar">${getUserInitial()}</span>
                <div class="header-session-copy">
                    <strong>${authSession.name}</strong>
                    <span>${authSession.role || 'مستخدم المنصة'}</span>
                </div>
            `;

            const anchor = mainNav || sidebarToggle || headerContainer.lastElementChild;
            headerContainer.insertBefore(headerCard, anchor);
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

    function bindAuthActions() {
        if (!authApi) {
            return;
        }

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
        const wrapper = document.createElement('div');
        wrapper.className = 'sidebar-extra-block';
        wrapper.dataset.sidebarExtra = 'true';
        wrapper.innerHTML = `
            <span class="sidebar-section-label">صفحات إضافية</span>
            <div class="sidebar-mini-grid">
                <a href="${prefix}announcements.html" class="sidebar-mini-link">
                    <i class="fas fa-bullhorn"></i>
                    <span>لوحة الإعلانات</span>
                </a>
                <a href="${prefix}exam-calendar.html" class="sidebar-mini-link">
                    <i class="fas fa-calendar-days"></i>
                    <span>جدول الامتحانات</span>
                </a>
            </div>
        `;

        sidebarNav.appendChild(wrapper);
    }

    function updateActiveLinks() {
        const currentFile = window.location.pathname.split('/').pop() || 'index.html';
        const allLinks = [...navLinks, ...sidebarLinks, ...Array.from(document.querySelectorAll('.sidebar-mini-link'))];

        allLinks.forEach((link) => {
            const href = link.getAttribute('href');
            if (!href) {
                return;
            }

            const linkFile = href.split('/').pop() || 'index.html';
            const isMatch = currentFile === linkFile || (currentFile === '' && linkFile === 'index.html');
            link.classList.toggle('active', isMatch);
        });
    }

    function updateHeaderState() {
        if (!siteHeader) {
            return;
        }

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

            if (progress < 1) {
                requestAnimationFrame(step);
            }
        }

        requestAnimationFrame(step);
    }

    function initCounters() {
        if (!countElements.length) {
            return;
        }

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
                if (!entry.isIntersecting || entry.target.dataset.counted === 'true') {
                    return;
                }

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
                if (!item) {
                    return;
                }

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

                if (!value) {
                    return;
                }

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
});
