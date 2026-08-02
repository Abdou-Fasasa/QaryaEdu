document.addEventListener('DOMContentLoaded', () => {
    const quickGrid = document.querySelector('.quick-links-grid');
    if (!quickGrid || document.getElementById('services-search-panel')) return;

    const cards = Array.from(document.querySelectorAll('.quick-link-card, .feature-panel-card, .help-card'));
    if (!cards.length) return;

    const panel = document.createElement('section');
    panel.className = 'section-shell section-tight';
    panel.id = 'services-search-panel';
    panel.innerHTML = `
        <div class="container">
            <div class="service-search-bar">
                <div class="service-search-input">
                    <i class="fas fa-magnifying-glass"></i>
                    <input type="text" id="services-search-input" placeholder="ابحث داخل الخدمات والروابط السريعة..." />
                </div>
                <span class="inline-pill" id="services-search-count"><i class="fas fa-layer-group"></i> عدد النتائج: ${cards.length.toLocaleString('ar-EG')}</span>
            </div>
        </div>
    `;
    quickGrid.closest('.section-shell').insertAdjacentElement('beforebegin', panel);

    const input = document.getElementById('services-search-input');
    const count = document.getElementById('services-search-count');

    function render() {
        const query = String(input.value || '').trim().toLowerCase();
        let visibleCount = 0;

        cards.forEach((card) => {
            const text = card.textContent.toLowerCase();
            const isVisible = query ? text.includes(query) : true;
            card.style.display = isVisible ? '' : 'none';
            if (isVisible) visibleCount += 1;
        });

        count.innerHTML = `<i class="fas fa-layer-group"></i> عدد النتائج: ${visibleCount.toLocaleString('ar-EG')}`;
    }

    input.addEventListener('input', render);
});
