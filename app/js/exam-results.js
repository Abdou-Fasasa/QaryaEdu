document.addEventListener('DOMContentLoaded', () => {
    const authApi = window.QaryaAuth;
    const store = window.QaryaPlatformStore;
    if (!store) return;

    const form = document.getElementById('results-search-form');
    const input = document.getElementById('results-request-id');
    const panel = document.getElementById('exam-results-panel');
    const params = new URLSearchParams(window.location.search);
    const initialRequestId = String(params.get('requestId') || '').trim() || getSessionRequestId();

    if (initialRequestId && input) {
        input.value = initialRequestId;
        renderResults(initialRequestId);
    }

    if (form) {
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            renderResults(input.value.trim());
        });
    }

    function formatDate(value) {
        return value ? new Date(value).toLocaleString('ar-EG') : 'غير محدد';
    }

    function normalizeEmail(value) {
        return authApi?.normalizeEmail?.(value || '') || String(value || '').trim().toLowerCase();
    }

    function getSessionRequestId() {
        const session = authApi?.getSession?.();
        const user = session?.email ? (authApi.getUserByEmail?.(session.email) || session) : null;
        if (!user) return '';

        const userRequestId = String(user.requestId || user.applicationRequestId || '').trim();
        if (userRequestId) return userRequestId;

        const userEmail = normalizeEmail(user.email);
        const application = (store.getAllApplications?.() || []).find((item) => (
            normalizeEmail(item.studentEmail) === userEmail
            || (user.nationalId && String(item.nationalId || '').trim() === String(user.nationalId).trim())
        ));

        return String(application?.requestId || '').trim();
    }

    function getExamLevelLabel(level) {
        return level === 'senior' ? 'امتحان الكبار' : 'امتحان الطلاب';
    }

    function getRewardLabel(attempt) {
        if (!attempt?.passed) return 'لا توجد مكافأة';
        if (Number(attempt.rewardAmount || 0) > 0) {
            return `تمت إضافة ${Number(attempt.rewardAmount || 0).toLocaleString('en-US')} EGP`;
        }
        return 'ناجح، المكافأة بانتظار التأكيد';
    }

    function renderResults(requestId) {
        if (!panel) return;
        const summary = store.getExamSummary(requestId);

        if (!summary.application && !summary.hasAttempts) {
            panel.innerHTML = '<div class="empty-state"><i class="fas fa-square-poll-vertical"></i><h3>لا يوجد سجل مطابق</h3><p>يمكنك البحث برقم الطلب لعرض أحدث نتيجة أو سجل الامتحانات.</p></div>';
            return;
        }

        const latest = summary.latestAttempt;
        const attempts = summary.attempts;

        panel.innerHTML = `
            <article class="results-hero-card" data-reveal>
                <div>
                    <span class="mini-badge">نتائج الامتحان</span>
                    <h3>${summary.name}</h3>
                    <p>رقم الطلب: <strong>${summary.requestId}</strong></p>
                </div>
                <div class="results-score-orb ${latest?.passed ? 'is-pass' : 'is-pending'}">
                    <strong>${latest ? `${latest.percentage || 0}%` : '--'}</strong>
                    <span>${latest ? 'آخر نتيجة من 100%' : 'لا توجد محاولة مسجلة'}</span>
                </div>
            </article>
            <div class="results-summary-grid">
                <article class="summary-card is-primary" data-reveal>
                    <span class="summary-icon"><i class="fas fa-chart-line"></i></span>
                    <span class="summary-value">${latest ? `${latest.score || 0} / ${latest.total || 100}` : '--'}</span>
                    <p>أحدث درجة</p>
                </article>
                <article class="summary-card" data-reveal>
                    <span class="summary-icon"><i class="fas fa-layer-group"></i></span>
                    <span class="summary-value">${latest ? getExamLevelLabel(latest.examLevel) : '--'}</span>
                    <p>نوع الامتحان</p>
                </article>
                <article class="summary-card" data-reveal>
                    <span class="summary-icon"><i class="fas fa-clock"></i></span>
                    <span class="summary-value">${latest ? formatDate(latest.date) : '--'}</span>
                    <p>آخر وقت تسجيل</p>
                </article>
                <article class="summary-card" data-reveal>
                    <span class="summary-icon"><i class="fas fa-wallet"></i></span>
                    <span class="summary-value">${latest ? getRewardLabel(latest) : '--'}</span>
                    <p>مكافأة النجاح</p>
                </article>
            </div>
            <section class="content-card" data-reveal>
                <div class="card-heading">
                    <span class="mini-badge">سجل الامتحانات</span>
                    <h3>كل امتحان والتاريخ والنتيجة</h3>
                </div>
                <div class="results-history-list">
                    ${attempts.length ? attempts.map((attempt) => `
                        <article class="result-history-card">
                            <div class="dashboard-list-head">
                                <div>
                                    <strong>${getExamLevelLabel(attempt.examLevel)}</strong>
                                    <span>${formatDate(attempt.date)}</span>
                                </div>
                                <strong class="score-chip">${attempt.percentage || 0}%</strong>
                            </div>
                            <p>الدرجة: ${attempt.score || 0} من ${attempt.total || 100} - ${attempt.passed ? 'اجتياز' : 'أقل من نسبة الاجتياز'}.</p>
                            <p>التاريخ: ${formatDate(attempt.date)} - المكافأة: ${getRewardLabel(attempt)}.</p>
                        </article>
                    `).join('') : '<div class="empty-state compact"><p>لا توجد امتحانات مسجلة حتى الآن.</p></div>'}
                </div>
                <div class="dashboard-card-actions top-gap">
                    ${summary.application ? `<a href="./status.html?requestId=${encodeURIComponent(summary.application.requestId)}&nationalId=${encodeURIComponent(summary.application.nationalId || '')}" class="btn-ghost">حالة الطلب</a>` : ''}
                    <a href="./verification.html?requestId=${encodeURIComponent(summary.requestId)}" class="btn-ghost">سجل الامتحانات</a>
                </div>
            </section>
        `;
    }
});
