document.addEventListener('DOMContentLoaded', () => {
    const STORAGE_KEY = 'qaryaeduApplications';
    const statusForm = document.getElementById('status-form');
    const resultBox = document.getElementById('status-result');
    const summaryState = document.getElementById('status-summary-state');
    const summaryRequest = document.getElementById('status-summary-request');
    const summaryVillage = document.getElementById('status-summary-village');

    const applications = Array.isArray(window.fixedApplications) ? window.fixedApplications : [];

    function getStoredApplications() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (error) {
            console.error('Failed to read applications from storage:', error);
            return [];
        }
    }

    function getAllApplications() {
        return [...getStoredApplications(), ...applications];
    }

    function getStatusLabel(status) {
        if (status === 'accepted') return 'مقبول';
        if (status === 'rejected') return 'مرفوض';
        return 'قيد المراجعة';
    }

    function updateSummary(application) {
        if (!summaryState || !summaryRequest || !summaryVillage) {
            return;
        }

        if (!application) {
            summaryState.textContent = '---';
            summaryRequest.textContent = '---';
            summaryVillage.textContent = '---';
            return;
        }

        summaryState.textContent = getStatusLabel(application.status || 'pending');
        summaryRequest.textContent = application.requestId || '---';
        summaryVillage.textContent = application.village || 'غير محدد';
    }

    function renderResult(application) {
        const status = application.status || 'pending';
        const message = application.message || 'طلبك قيد المراجعة حاليًا وسيتم تحديث الحالة بعد انتهاء المراجعة.';
        const ageText = application.age ? `${application.age} سنة` : 'غير محدد';
        const villageText = application.village || 'غير محدد';
        const governorateText = application.governorate || 'غير محدد';
        const cityText = application.city || 'غير محدد';
        const leaderCodeText = application.leaderCode || 'غير محدد';
        const createdAtText = application.createdAt
            ? new Date(application.createdAt).toLocaleString('ar-EG')
            : 'غير محدد';

        resultBox.innerHTML = `
            <div class="status-card ${status}">
                <h3>تفاصيل الطلب</h3>
                <div class="detail-row"><span>رقم الطلب:</span> <strong>${application.requestId}</strong></div>
                <div class="detail-row"><span>الاسم:</span> <strong>${application.name}</strong></div>
                <div class="detail-row"><span>السن:</span> <strong>${ageText}</strong></div>
                <div class="detail-row"><span>المحافظة:</span> <strong>${governorateText}</strong></div>
                <div class="detail-row"><span>المركز:</span> <strong>${cityText}</strong></div>
                <div class="detail-row"><span>القرية:</span> <strong>${villageText}</strong></div>
                <div class="detail-row"><span>كود القائد:</span> <strong>${leaderCodeText}</strong></div>
                <div class="detail-row"><span>وقت التسجيل:</span> <strong>${createdAtText}</strong></div>
                <div class="detail-row"><span>الحالة:</span> <span class="badge ${status}">${getStatusLabel(status)}</span></div>
                <div class="message-box">${message}</div>
            </div>
        `;
    }

    function submitLookup() {
        resultBox.innerHTML = '';
        resultBox.className = '';

        const requestId = document.getElementById('request-id').value.trim();
        const nationalId = document.getElementById('national-id').value.trim();
        const application = getAllApplications().find((app) => app.requestId === requestId && app.nationalId === nationalId);

        if (!application) {
            updateSummary(null);
            resultBox.innerHTML = '<div class="alert error">❌ لم يتم العثور على طلب بهذه البيانات. يرجى التأكد من صحة رقم الطلب والرقم القومي.</div>';
            return;
        }

        updateSummary(application);
        renderResult(application);
    }

    if (statusForm) {
        statusForm.addEventListener('submit', function (e) {
            e.preventDefault();
            submitLookup();
        });
    }

    const params = new URLSearchParams(window.location.search);
    const requestIdFromQuery = params.get('requestId');
    const nationalIdFromQuery = params.get('nationalId');

    if (requestIdFromQuery) {
        document.getElementById('request-id').value = requestIdFromQuery;
    }

    if (nationalIdFromQuery) {
        document.getElementById('national-id').value = nationalIdFromQuery;
    }

    if (requestIdFromQuery && nationalIdFromQuery) {
        submitLookup();
    } else {
        updateSummary(null);
    }
});
