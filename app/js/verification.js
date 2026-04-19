document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('search-form');
    const requestInput = document.getElementById('request-id');
    const resultsContainer = document.getElementById('results-container');
    const resultsBody = document.getElementById('results-body');
    const noResult = document.getElementById('no-result');
    const studentSummary = document.getElementById('student-summary');
    const weekWindow = document.getElementById('week-window');

    const weekHelper = window.QaryaExamWeek;
    const examDays = weekHelper ? weekHelper.getCurrentExamDays() : [];
    const officialResults = weekHelper
        ? weekHelper.filterCurrentWeekResults(window.examResults || [])
        : (Array.isArray(window.examResults) ? window.examResults : []);

    if (weekWindow && examDays.length) {
        weekWindow.textContent = `${examDays[0].dateText} - ${examDays[2].dateText}`;
    }

    if (form) {
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            searchResult(normalizeRequestId(requestInput.value));
        });
    }

    const params = new URLSearchParams(window.location.search);
    const initialRequestId = normalizeRequestId(params.get('requestId') || '');
    if (initialRequestId) {
        requestInput.value = initialRequestId;
        searchResult(initialRequestId);
    }

    function normalizeRequestId(value) {
        return String(value || '').trim().toUpperCase();
    }

    function getAttempts(student) {
        return Array.isArray(student?.attempts) ? student.attempts : [];
    }

    function formatTime(dateString) {
        if (!dateString) return '--';
        const date = new Date(dateString);
        return date.toLocaleTimeString('ar-EG', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }

    function buildStatusBadge(attempt) {
        if (!attempt) {
            return '<span class="status-badge is-pending"><i class="fas fa-clock"></i> لا يوجد أداء هذا الأسبوع</span>';
        }

        const stateClass = attempt.status === 'passed' ? 'is-passed' : 'is-warning';
        const label = attempt.approved ? 'تم الأداء' : 'قيد المراجعة';
        return `<span class="status-badge ${stateClass}"><i class="fas fa-circle-check"></i> ${label}</span>`;
    }

    function buildSummary(student) {
        return `
            <div class="verification-student-head">
                <div>
                    <span class="mini-badge">بيانات الطلب</span>
                    <h3>${student.name}</h3>
                    <p>رقم الطلب: <strong>${student.requestId}</strong></p>
                </div>
                <div class="verification-student-meta">
                    <span><i class="fas fa-rotate"></i> يتم تفريغ سجل الأداء تلقائيًا مع بداية كل أسبوع جديد</span>
                    <span><i class="fas fa-file-circle-check"></i> الحالة العامة: ${student.overallStatus === 'accepted' ? 'مقبول' : 'قيد المراجعة'}</span>
                </div>
            </div>
        `;
    }

    function searchResult(requestId) {
        const student = officialResults.find((item) => normalizeRequestId(item.requestId) === requestId);

        if (!student) {
            if (resultsContainer) resultsContainer.style.display = 'none';
            if (studentSummary) studentSummary.innerHTML = '';
            if (noResult) noResult.style.display = 'grid';
            return;
        }

        if (noResult) noResult.style.display = 'none';
        if (resultsContainer) resultsContainer.style.display = 'block';
        if (studentSummary) studentSummary.innerHTML = buildSummary(student);

        const attempts = getAttempts(student);
        resultsBody.innerHTML = examDays.map((examDay) => {
            const attempt = attempts.find((entry) => String(entry?.date || '').slice(0, 10) === examDay.isoDate);
            const scoreText = attempt
                ? `<strong class="score-chip">${attempt.percentage}%</strong>`
                : '<span class="muted-chip">--</span>';
            const timeText = attempt
                ? `<span class="time-badge">${formatTime(attempt.date)}</span>`
                : '<span class="muted-chip">07:00 م - 08:00 م</span>';

            return `
                <tr>
                    <td>${examDay.label}</td>
                    <td><span class="date-text">${examDay.dateText}</span></td>
                    <td>${timeText}</td>
                    <td>${scoreText}</td>
                    <td>${buildStatusBadge(attempt)}</td>
                </tr>
            `;
        }).join('');
    }
});
