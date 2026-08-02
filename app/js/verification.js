document.addEventListener('DOMContentLoaded', async () => {
    const authApi = window.QaryaAuth || null;
    const store = window.QaryaPlatformStore || null;

    const form = document.getElementById('search-form');
    const requestInput = document.getElementById('request-id');
    const resultsContainer = document.getElementById('results-container');
    const resultsBody = document.getElementById('results-body');
    const noResult = document.getElementById('no-result');
    const studentSummary = document.getElementById('student-summary');
    const historyWindow = document.getElementById('history-window');

    if (store?.refreshFromRemote) {
        await store.refreshFromRemote({ force: true });
    }

    if (form) {
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            searchResult(normalizeRequestId(requestInput.value));
        });
    }

    const params = new URLSearchParams(window.location.search);
    const initialRequestId = normalizeRequestId(params.get('requestId') || getSessionRequestId());
    if (initialRequestId && requestInput) {
        requestInput.value = initialRequestId;
        searchResult(initialRequestId);
    }

    function normalizeRequestId(value) {
        return String(value || '').trim().toUpperCase();
    }

    function normalizeEmail(value) {
        return authApi?.normalizeEmail?.(value || '') || String(value || '').trim().toLowerCase();
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getSessionRequestId() {
        const session = authApi?.getSession?.();
        const user = session?.email ? (authApi.getUserByEmail?.(session.email) || session) : null;
        if (!user) return '';

        const directRequestId = normalizeRequestId(user.requestId || user.applicationRequestId);
        if (directRequestId) return directRequestId;

        const userEmail = normalizeEmail(user.email);
        const application = (store?.getAllApplications?.() || []).find((item) => (
            normalizeEmail(item.studentEmail) === userEmail
            || (user.nationalId && String(item.nationalId || '').trim() === String(user.nationalId).trim())
        ));

        return normalizeRequestId(application?.requestId);
    }

    function formatDate(value) {
        if (!value) return 'غير محدد';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? 'غير محدد' : date.toLocaleDateString('ar-EG');
    }

    function formatTime(value) {
        if (!value) return '--';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '--';
        return date.toLocaleTimeString('ar-EG', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
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

    function getStatusBadge(attempt) {
        if (!attempt) {
            return '<span class="status-badge is-pending"><i class="fas fa-clock"></i> لا توجد محاولة</span>';
        }
        return attempt.passed
            ? '<span class="status-badge is-passed"><i class="fas fa-circle-check"></i> ناجح</span>'
            : '<span class="status-badge is-warning"><i class="fas fa-triangle-exclamation"></i> أقل من 50%</span>';
    }

    function getStaticSummary(requestId) {
        const normalized = normalizeRequestId(requestId);
        const record = (Array.isArray(window.examResults) ? window.examResults : [])
            .find((item) => normalizeRequestId(item.requestId) === normalized);

        if (!record) {
            return {
                requestId: normalized,
                name: 'طالب المنصة',
                application: null,
                attempts: [],
                latestAttempt: null,
                hasAttempts: false
            };
        }

        const attempts = (Array.isArray(record.attempts) ? record.attempts : []).map((attempt) => ({
            requestId: normalized,
            name: record.name,
            examLevel: attempt.examLevel || 'senior',
            score: attempt.score,
            total: attempt.total,
            percentage: attempt.percentage,
            passed: attempt.status === 'passed' || attempt.passed === true,
            date: attempt.date,
            approved: attempt.approved !== false,
            source: 'official'
        })).sort((first, second) => new Date(second.date || 0).getTime() - new Date(first.date || 0).getTime());

        return {
            requestId: normalized,
            name: record.name || 'طالب المنصة',
            application: null,
            attempts,
            latestAttempt: attempts[0] || null,
            hasAttempts: attempts.length > 0
        };
    }

    function getSummary(requestId) {
        if (store?.getExamSummary) {
            return store.getExamSummary(requestId);
        }
        return getStaticSummary(requestId);
    }

    function buildSummary(summary) {
        const latest = summary.latestAttempt;
        const attemptsCount = summary.attempts.length;
        const latestText = latest
            ? `آخر نتيجة: ${Number(latest.percentage || 0)}% بتاريخ ${formatDate(latest.date)}`
            : 'لا توجد محاولات مسجلة حتى الآن';

        if (historyWindow) {
            historyWindow.textContent = attemptsCount
                ? `${attemptsCount.toLocaleString('ar-EG')} امتحان مسجل - ${latestText}`
                : 'لا توجد محاولات مسجلة حتى الآن';
        }

        return `
            <div class="verification-student-head">
                <div>
                    <span class="mini-badge">بيانات الطالب</span>
                    <h3>${escapeHtml(summary.name || 'طالب المنصة')}</h3>
                    <p>رقم الطلب: <strong>${escapeHtml(summary.requestId)}</strong></p>
                </div>
                <div class="verification-student-meta">
                    <span><i class="fas fa-square-poll-vertical"></i> عدد الامتحانات: ${attemptsCount.toLocaleString('ar-EG')}</span>
                    <span><i class="fas fa-chart-line"></i> ${escapeHtml(latestText)}</span>
                </div>
            </div>
        `;
    }

    function renderAttempts(attempts) {
        if (!resultsBody) return;

        if (!attempts.length) {
            resultsBody.innerHTML = `
                <tr>
                    <td colspan="6"><span class="muted-chip">لا توجد امتحانات مسجلة لهذا الطلب حتى الآن.</span></td>
                </tr>
            `;
            return;
        }

        resultsBody.innerHTML = attempts.map((attempt) => `
            <tr>
                <td>${escapeHtml(getExamLevelLabel(attempt.examLevel))}</td>
                <td><span class="date-text">${escapeHtml(formatDate(attempt.date))}</span></td>
                <td><span class="time-badge">${escapeHtml(formatTime(attempt.date))}</span></td>
                <td><strong class="score-chip">${escapeHtml(String(attempt.percentage || 0))}%</strong></td>
                <td>${getStatusBadge(attempt)}</td>
                <td>${escapeHtml(getRewardLabel(attempt))}</td>
            </tr>
        `).join('');
    }

    function searchResult(requestId) {
        const normalized = normalizeRequestId(requestId);
        if (!normalized) return;

        const summary = getSummary(normalized);
        const hasRecord = Boolean(summary.application || summary.hasAttempts || summary.attempts.length);

        if (!hasRecord) {
            if (resultsContainer) resultsContainer.style.display = 'none';
            if (studentSummary) studentSummary.innerHTML = '';
            if (historyWindow) historyWindow.textContent = 'لا يوجد سجل لهذا الرقم';
            if (noResult) noResult.style.display = 'grid';
            return;
        }

        if (noResult) noResult.style.display = 'none';
        if (resultsContainer) resultsContainer.style.display = 'block';
        if (studentSummary) studentSummary.innerHTML = buildSummary(summary);
        renderAttempts(summary.attempts || []);
    }
});
