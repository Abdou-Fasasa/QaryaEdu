document.addEventListener('DOMContentLoaded', () => {
    if (typeof locationData === 'undefined') {
        console.error('Location data not loaded!');
        return;
    }

    const beniSuefEntries = locationData.filter((item) => item.governorate === 'بني سويف');
    const centersContainer = document.getElementById('beni-suef-centers');
    const summaryCenters = document.getElementById('beni-suef-summary-centers');
    const summaryVillages = document.getElementById('beni-suef-summary-villages');
    const summaryLeaders = document.getElementById('beni-suef-summary-leaders');

    if (!centersContainer) {
        return;
    }

    const groupedCenters = beniSuefEntries.reduce((map, entry) => {
        if (!map.has(entry.city)) {
            map.set(entry.city, []);
        }

        map.get(entry.city).push(entry);
        return map;
    }, new Map());

    if (summaryCenters) {
        summaryCenters.textContent = groupedCenters.size.toLocaleString('ar-EG');
    }

    if (summaryVillages) {
        summaryVillages.textContent = beniSuefEntries.length.toLocaleString('ar-EG');
    }

    if (summaryLeaders) {
        summaryLeaders.textContent = new Set(beniSuefEntries.map((entry) => entry.leader)).size.toLocaleString('ar-EG');
    }

    const sortedCenters = [...groupedCenters.keys()].sort((first, second) => first.localeCompare(second, 'ar'));

    centersContainer.innerHTML = sortedCenters.map((centerName) => {
        const entries = groupedCenters.get(centerName)
            .slice()
            .sort((first, second) => first.name.localeCompare(second.name, 'ar'));
        const applicantsTotal = entries.reduce((sum, entry) => sum + Number(entry.applicantsCount || 0), 0);
        const villagesMarkup = entries.map((entry) => `
            <li>
                <span>${entry.name}</span>
                <small>${entry.leader}</small>
            </li>
        `).join('');

        return `
            <article class="center-card">
                <div class="center-card-head">
                    <span class="mini-badge">مركز</span>
                    <h3>${centerName}</h3>
                    <p>${entries.length.toLocaleString('ar-EG')} قرية داخل المنصة لهذا المركز.</p>
                </div>
                <div class="center-meta">
                    <span><i class="fas fa-map"></i> ${entries.length.toLocaleString('ar-EG')} قرية</span>
                    <span><i class="fas fa-user-tie"></i> ${new Set(entries.map((entry) => entry.leader)).size.toLocaleString('ar-EG')} قائد</span>
                    <span><i class="fas fa-users"></i> ${applicantsTotal.toLocaleString('ar-EG')} مشاركة</span>
                </div>
                <ul class="center-village-list">
                    ${villagesMarkup}
                </ul>
            </article>
        `;
    }).join('');
});
