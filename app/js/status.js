document.addEventListener('DOMContentLoaded', () => {
    const authApi = window.QaryaAuth || null;
    const store = window.QaryaPlatformStore;
    const statusForm = document.getElementById('status-form');
    const resultBox = document.getElementById('status-result');
    const summaryState = document.getElementById('status-summary-state');
    const summaryRequest = document.getElementById('status-summary-request');
    const summaryVillage = document.getElementById('status-summary-village');

    if (!store) {
        console.error('Platform store is not available.');
        return;
    }

    let activeRequestId = '';
    let activeNationalId = '';

    function updateSummary(application) {
        if (!summaryState || !summaryRequest || !summaryVillage) return;

        if (!application) {
            summaryState.textContent = '---';
            summaryRequest.textContent = '---';
            summaryVillage.textContent = '---';
            return;
        }

        summaryState.textContent = store.getStatusLabel(application.status || 'pending');
        summaryRequest.textContent = application.requestId || '---';
        summaryVillage.textContent = application.village || 'غير محدد';
    }

    function formatDate(value) {
        return value ? new Date(value).toLocaleString('ar-EG') : 'غير محدد';
    }

    function renderTimeline(application) {
        const timeline = store.buildApplicationTimeline(application);
        return `
            <div class="application-timeline">
                ${timeline.map((step) => `
                    <article class="timeline-stage ${step.state}">
                        <span class="timeline-stage-dot"></span>
                        <div>
                            <h4>${step.title}</h4>
                            <small>${step.date ? formatDate(step.date) : 'بانتظار التحديث'}</small>
                            <p>${step.text}</p>
                        </div>
                    </article>
                `).join('')}
            </div>
        `;
    }

    function renderResult(application) {
        const status = application.status || 'pending';
        const message = application.message || 'طلبك قيد المراجعة حاليًا وسيتم تحديث الحالة بعد انتهاء المراجعة.';
        const ageText = application.age ? `${application.age} سنة` : 'غير محدد';
        const latestExam = store.getLatestExamAttempt(application.requestId);
        const examStateText = latestExam
            ? `${latestExam.percentage || 0}% - ${formatDate(latestExam.date)}`
            : (status === 'accepted' ? 'الطلب جاهز لدخول الامتحان في الموعد الرسمي.' : 'لا توجد نتيجة امتحان حتى الآن.');

        resultBox.innerHTML = `
            <div class="status-card ${status}" data-reveal>
                <div class="dashboard-list-head">
                    <div>
                        <span class="mini-badge">تفاصيل الطلب</span>
                        <h3>${application.name}</h3>
                    </div>
                    <span class="badge ${status}">${store.getStatusLabel(status)}</span>
                </div>
                <div class="detail-grid">
                    <div class="detail-row"><span>رقم الطلب:</span> <strong>${application.requestId}</strong></div>
                    <div class="detail-row"><span>الرقم القومي:</span> <strong>${application.nationalId}</strong></div>
                    <div class="detail-row"><span>السن:</span> <strong>${ageText}</strong></div>
                    <div class="detail-row"><span>المحافظة:</span> <strong>${application.governorate || 'غير محدد'}</strong></div>
                    <div class="detail-row"><span>المركز:</span> <strong>${application.city || 'غير محدد'}</strong></div>
                    <div class="detail-row"><span>القرية:</span> <strong>${application.village || 'غير محدد'}</strong></div>
                    <div class="detail-row"><span>كود القائد:</span> <strong>${application.leaderCode || 'غير محدد'}</strong></div>
                    <div class="detail-row"><span>وقت التسجيل:</span> <strong>${formatDate(application.createdAt)}</strong></div>
                    <div class="detail-row"><span>آخر نتيجة:</span> <strong>${examStateText}</strong></div>
                </div>
                <div class="message-box">${message}</div>
                <div class="dashboard-card-actions wrap-actions top-gap">
                    <a href="./receipt.html?requestId=${encodeURIComponent(application.requestId)}" class="btn-ghost">الإيصال</a>
                    <a href="./exam-results.html?requestId=${encodeURIComponent(application.requestId)}" class="btn-ghost">نتائج الامتحان</a>
                </div>
            </div>
            <section class="content-card top-gap" data-reveal>
                <div class="card-heading">
                    <span class="mini-badge">التسلسل الزمني</span>
                    <h3>مسار الطلب خطوة بخطوة</h3>
                </div>
                ${renderTimeline(application)}
            </section>
        `;
    }

    function showNotFound() {
        updateSummary(null);
        resultBox.innerHTML = '<div class="alert error">❌ لم يتم العثور على طلب بهذه البيانات. يرجى التأكد من صحة رقم الطلب والرقم القومي.</div>';
    }

    function submitLookup() {
        resultBox.innerHTML = '';
        resultBox.className = '';

        activeRequestId = document.getElementById('request-id').value.trim();
        activeNationalId = document.getElementById('national-id').value.trim();
        const application = store.getApplicationByRequestAndNationalId(activeRequestId, activeNationalId);

        if (!application) {
            showNotFound();
            return;
        }

        updateSummary(application);
        renderResult(application);
    }

    if (statusForm) {
        statusForm.addEventListener('submit', function (event) {
            event.preventDefault();
            submitLookup();
        });
    }

    const params = new URLSearchParams(window.location.search);
    const requestIdFromQuery = params.get('requestId');
    const nationalIdFromQuery = params.get('nationalId');

    if (requestIdFromQuery) document.getElementById('request-id').value = requestIdFromQuery;
    if (nationalIdFromQuery) document.getElementById('national-id').value = nationalIdFromQuery;

    window.addEventListener(store.storeEventName || 'qarya:store-updated', () => {
        if (activeRequestId && activeNationalId) {
            submitLookup();
        }
    });

    if (requestIdFromQuery && nationalIdFromQuery) {
        submitLookup();
    } else {
        updateSummary(null);
    }
});