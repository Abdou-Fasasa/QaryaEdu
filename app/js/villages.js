document.addEventListener('DOMContentLoaded', () => {
    if (typeof locationData === 'undefined') {
        console.error('Location data not loaded!');
        return;
    }

    const governorateSelect = document.getElementById('governorate-select');
    const citySelect = document.getElementById('city-select');
    const villageSelect = document.getElementById('village-select');
    const leaderSearch = document.getElementById('leader-search');
    const villageList = document.getElementById('village-list');
    const summaryGovernorates = document.getElementById('summary-governorates');
    const summaryVillages = document.getElementById('summary-villages');
    const summaryVillagesCard = document.getElementById('summary-villages-card');
    const summaryLeaders = document.getElementById('summary-leaders');
    const summaryTopRating = document.getElementById('summary-top-rating');
    const resultCount = document.getElementById('filter-result-count');

    function sortArabic(values) {
        return [...values].sort((first, second) => String(first).localeCompare(String(second), 'ar'));
    }

    function setOverview() {
        const governoratesCount = new Set(locationData.map((item) => item.governorate)).size;
        const villagesCount = locationData.length;
        const leadersCount = new Set(locationData.map((item) => item.leader)).size;
        const topRating = Math.max(...locationData.map((item) => item.rating));

        if (summaryGovernorates) summaryGovernorates.textContent = governoratesCount.toLocaleString('ar-EG');
        if (summaryVillages) summaryVillages.textContent = villagesCount.toLocaleString('ar-EG');
        if (summaryVillagesCard) summaryVillagesCard.textContent = villagesCount.toLocaleString('ar-EG');
        if (summaryLeaders) summaryLeaders.textContent = leadersCount.toLocaleString('ar-EG');
        if (summaryTopRating) summaryTopRating.textContent = `${topRating.toLocaleString('ar-EG')} / 5`;
    }

    function updateResultCount(count) {
        if (!resultCount) {
            return;
        }

        resultCount.innerHTML = `<i class="fas fa-filter"></i> عدد النتائج: ${count.toLocaleString('ar-EG')}`;
    }

    function renderVillages(data) {
        villageList.innerHTML = '';
        updateResultCount(data.length);

        if (data.length === 0) {
            villageList.innerHTML = '<p class="no-results">لا توجد نتائج مطابقة للبحث الحالي.</p>';
            return;
        }

        data.forEach((item) => {
            const card = document.createElement('div');
            card.className = 'village-card';

            const stars = Array.from({ length: 5 }, (_, index) => (
                index < item.rating ? '<i class="fas fa-star filled"></i>' : '<i class="far fa-star"></i>'
            )).join('');

            card.innerHTML = `
                <div class="card-header">
                    <h3>${item.name}</h3>
                    <span class="governorate-badge">${item.governorate}</span>
                </div>
                <div class="card-body">
                    <p class="leader"><i class="fas fa-user-tie"></i> القائد: ${item.leader}</p>
                    <div class="village-tags">
                        <span><i class="fas fa-location-dot"></i> ${item.city}</span>
                        <span><i class="fas fa-star"></i> تقييم ${item.rating}/5</span>
                    </div>
                    <div class="stats-row">
                        <div class="stat" title="عدد المتقدمين">
                            <i class="fas fa-users"></i> ${item.applicantsCount}
                        </div>
                        <div class="stat" title="الشباب">
                            <i class="fas fa-user-graduate"></i> ${item.youthCount}
                        </div>
                        <div class="stat" title="الأطفال">
                            <i class="fas fa-child"></i> ${item.childrenCount}
                        </div>
                    </div>
                    <div class="rating">
                        ${stars}
                    </div>
                </div>
            `;
            villageList.appendChild(card);
        });
    }

    function populateGovernorates() {
        const uniqueGovernorates = sortArabic(new Set(locationData.map((item) => item.governorate)));
        uniqueGovernorates.forEach((governorate) => {
            const option = document.createElement('option');
            option.value = governorate;
            option.textContent = governorate;
            governorateSelect.appendChild(option);
        });
    }

    function populateCities(governorate) {
        citySelect.innerHTML = '<option value="">جميع المدن</option>';
        villageSelect.innerHTML = '<option value="">جميع القرى والأحياء</option>';
        citySelect.disabled = true;
        villageSelect.disabled = true;

        if (governorate) {
            const uniqueCities = sortArabic(new Set(locationData
                .filter((item) => item.governorate === governorate)
                .map((item) => item.city)));

            uniqueCities.forEach((city) => {
                const option = document.createElement('option');
                option.value = city;
                option.textContent = city;
                citySelect.appendChild(option);
            });
            citySelect.disabled = false;
        }

        filterData();
    }

    function populateVillages(city) {
        villageSelect.innerHTML = '<option value="">جميع القرى والأحياء</option>';
        villageSelect.disabled = true;

        if (city) {
            const villages = locationData
                .filter((item) => item.city === city && item.governorate === governorateSelect.value)
                .sort((first, second) => first.name.localeCompare(second.name, 'ar'));

            villages.forEach((village) => {
                const option = document.createElement('option');
                option.value = village.name;
                option.textContent = village.name;
                villageSelect.appendChild(option);
            });
            villageSelect.disabled = false;
        }

        filterData();
    }

    function filterData() {
        const selectedGov = governorateSelect.value;
        const selectedCity = citySelect.value;
        const selectedVillage = villageSelect.value;
        const searchTerm = leaderSearch.value.trim().toLowerCase();

        const filtered = locationData
            .filter((item) => {
                const matchGov = selectedGov ? item.governorate === selectedGov : true;
                const matchCity = selectedCity ? item.city === selectedCity : true;
                const matchVillage = selectedVillage ? item.name === selectedVillage : true;
                const matchLeader = searchTerm ? item.leader.toLowerCase().includes(searchTerm) : true;

                return matchGov && matchCity && matchVillage && matchLeader;
            })
            .sort((first, second) => first.name.localeCompare(second.name, 'ar'));

        renderVillages(filtered);
    }

    if (governorateSelect) {
        governorateSelect.addEventListener('change', function () {
            populateCities(this.value);
        });
    }

    if (citySelect) {
        citySelect.addEventListener('change', function () {
            populateVillages(this.value);
        });
    }

    if (villageSelect) {
        villageSelect.addEventListener('change', filterData);
    }

    if (leaderSearch) {
        leaderSearch.addEventListener('input', filterData);
    }

    setOverview();
    populateGovernorates();
    renderVillages(locationData.slice().sort((first, second) => first.name.localeCompare(second.name, 'ar')));
});
