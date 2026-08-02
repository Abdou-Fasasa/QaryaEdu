document.addEventListener('DOMContentLoaded', () => {
    const store = window.QaryaPlatformStore;
    if (!store) return;

    const form = document.getElementById('receipt-search-form');
    const input = document.getElementById('receipt-request-id');
    const panel = document.getElementById('receipt-panel');
    const params = new URLSearchParams(window.location.search);
    const initialRequestId = String(params.get('requestId') || '').trim();

    if (initialRequestId && input) {
        input.value = initialRequestId;
        renderReceipt(initialRequestId);
    }

    if (form) {
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            renderReceipt(input.value.trim());
        });
    }

    document.addEventListener('click', (event) => {
        const printButton = event.target.closest('[data-print-receipt]');
        if (printButton) {
            window.print();
        }
    });

    function formatDate(value) {
        return value ? new Date(value).toLocaleString('ar-EG') : 'غير محدد';
    }

    function renderReceipt(requestId) {
        if (!panel) return;
        const application = store.getApplicationByRequestId(requestId);

        if (!application) {
            panel.innerHTML = '<div class="empty-state"><i class="fas fa-receipt"></i><h3>لا يوجد إيصال مطابق</h3><p>تأكد من كتابة رقم الطلب بشكل صحيح ثم أعد المحاولة.</p></div>';
            return;
        }

        panel.innerHTML = `
            <article class="receipt-card" data-reveal>
                <div class="receipt-head">
                    <div>
                        <span class="mini-badge">إيصال التسجيل</span>
                        <h3>${application.name}</h3>
                        <p>رقم الطلب: <strong>${application.requestId}</strong></p>
                    </div>
                    <div class="receipt-actions">
                        <button type="button" class="btn-secondary" data-print-receipt>طباعة الإيصال</button>
                        <a href="./status.html?requestId=${encodeURIComponent(application.requestId)}&nationalId=${encodeURIComponent(application.nationalId || '')}" class="btn-ghost">حالة الطلب</a>
                    </div>
                </div>
                <div class="receipt-grid">
                    <div class="receipt-item"><span>الرقم القومي</span><strong>${application.nationalId || 'غير محدد'}</strong></div>
                    <div class="receipt-item"><span>الحالة</span><strong>${store.getStatusLabel(application.status)}</strong></div>
                    <div class="receipt-item"><span>العمر</span><strong>${application.age ? `${application.age} سنة` : 'غير محدد'}</strong></div>
                    <div class="receipt-item"><span>كود القائد</span><strong>${application.leaderCode || 'غير محدد'}</strong></div>
                    <div class="receipt-item"><span>المحافظة</span><strong>${application.governorate || 'غير محدد'}</strong></div>
                    <div class="receipt-item"><span>المركز</span><strong>${application.city || 'غير محدد'}</strong></div>
                    <div class="receipt-item"><span>القرية</span><strong>${application.village || 'غير محدد'}</strong></div>
                    <div class="receipt-item"><span>وقت التسجيل</span><strong>${formatDate(application.createdAt)}</strong></div>
                </div>
                <div class="receipt-note">
                    <strong>ملاحظة</strong>
                    <p>${application.message || 'تم حفظ الطلب داخل المنصة.'}</p>
                </div>
            </article>
        `;
    }
});
