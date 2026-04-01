document.addEventListener('DOMContentLoaded', () => {
    if (typeof locationData === 'undefined') {
        console.error('Location data not loaded!');
        return;
    }

    const STORAGE_KEY = 'qaryaeduApplications';
    const REAPPLY_WINDOW_MS = 72 * 60 * 60 * 1000;
    const LEADER_CODES = window.QaryaTelegram?.LEADER_CODES || ['Abdou200', 'Mohamed333', 'Reda456'];
    const platformStore = window.QaryaPlatformStore || null;
    const governorateSelect = document.getElementById('governorate');
    const citySelect = document.getElementById('city');
    const villageSelect = document.getElementById('village');
    const registerForm = document.getElementById('register-form');
    const registerResultDiv = document.getElementById('register-result');
    const leaderCodeInput = document.getElementById('leaderCode');

    if (leaderCodeInput && !leaderCodeInput.value) {
        leaderCodeInput.value = LEADER_CODES[0];
    }

    function getStoredApplications() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (error) {
            console.error('Failed to read applications from storage:', error);
            return [];
        }
    }

    function saveStoredApplications(applications) {
        if (platformStore?.saveStoredApplications) {
            platformStore.saveStoredApplications(applications);
            return;
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
    }

    function sortArabic(values) {
        return [...values].sort((first, second) => String(first).localeCompare(String(second), 'ar'));
    }

    function generateRequestId(existingApplications) {
        let requestId = '';
        const existingIds = new Set(existingApplications.map((application) => application.requestId));

        do {
            requestId = Math.random().toString(36).slice(2, 8).toUpperCase();
        } while (existingIds.has(requestId));

        return requestId;
    }

    function calculateAge(dateString) {
        if (!dateString) return null;
        const birthDate = new Date(dateString);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age -= 1;
        }
        return age;
    }

    function formatRemainingTime(milliseconds) {
        const totalMinutes = Math.max(1, Math.ceil(milliseconds / (60 * 1000)));
        const days = Math.floor(totalMinutes / (24 * 60));
        const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
        const minutes = totalMinutes % 60;
        const parts = [];
        if (days > 0) parts.push(`${days} يوم`);
        if (hours > 0) parts.push(`${hours} ساعة`);
        if (minutes > 0 && parts.length < 3) parts.push(`${minutes} دقيقة`);
        return parts.join(' و ');
    }

    function getLatestApplication(applications, nationalId) {
        return applications
            .filter((application) => application.nationalId === nationalId)
            .sort((first, second) => new Date(second.createdAt || 0).getTime() - new Date(first.createdAt || 0).getTime())[0] || null;
    }

    function displayError(message) {
        registerResultDiv.className = 'error-message';
        registerResultDiv.textContent = message;
        registerResultDiv.style.display = 'block';
    }

    function displaySuccess(application, replacedExisting) {
        const noteText = replacedExisting
            ? 'تم إنشاء طلب جديد بهذا الرقم القومي بعد انتهاء مدة الانتظار، وتم حذف الطلب السابق تلقائيًا.'
            : 'يمكنك الآن متابعة الحالة أو فتح الإيصال الاحترافي مباشرة.';

        registerResultDiv.className = 'result-panel';
        registerResultDiv.innerHTML = `
            <div class="card-heading">
                <span class="mini-badge">تم التسجيل</span>
                <h3>تم استلام الطلب بنجاح</h3>
                <p>احتفظ برقم الطلب التالي لاستخدامه في الاستعلام عن حالة الطلب أو فتح الإيصال.</p>
            </div>
            <div id="request-code-text" class="result-code">${application.requestId}</div>
            <div class="result-actions wrap-actions">
                <button type="button" class="btn-secondary" data-copy-target="#request-code-text" data-copy-label="نسخ رقم الطلب">نسخ رقم الطلب</button>
                <a href="./status.html?requestId=${encodeURIComponent(application.requestId)}&nationalId=${encodeURIComponent(application.nationalId)}" class="btn-ghost">حالة الطلب</a>
                <a href="./receipt.html?requestId=${encodeURIComponent(application.requestId)}" class="btn-ghost">الإيصال</a>
            </div>
            <p class="result-note">${noteText}</p>
        `;
        registerResultDiv.style.display = 'block';

        const copyButton = registerResultDiv.querySelector('[data-copy-target]');
        if (copyButton) {
            copyButton.addEventListener('click', async () => {
                const target = document.querySelector(copyButton.dataset.copyTarget || '');
                const value = target ? target.textContent.trim() : '';
                if (!value) return;
                const originalLabel = copyButton.dataset.copyLabel || copyButton.textContent;
                try {
                    await navigator.clipboard.writeText(value);
                    copyButton.textContent = 'تم النسخ';
                    setTimeout(() => {
                        copyButton.textContent = originalLabel;
                    }, 1600);
                } catch (error) {
                    console.error('Copy failed:', error);
                }
            });
        }
    }

    function resetDependentFields() {
        citySelect.innerHTML = '<option value="">اختر المركز...</option>';
        villageSelect.innerHTML = '<option value="">اختر القرية...</option>';
        citySelect.disabled = true;
        villageSelect.disabled = true;
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
        resetDependentFields();
        if (!governorate) return;
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

    function populateVillages(city) {
        villageSelect.innerHTML = '<option value="">اختر القرية...</option>';
        villageSelect.disabled = true;
        if (!city) return;

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

    if (governorateSelect) {
        populateGovernorates();
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async function (event) {
            event.preventDefault();
            registerResultDiv.style.display = 'none';
            registerResultDiv.className = '';
            registerResultDiv.innerHTML = '';

            if (platformStore?.refreshFromRemote) {
                await platformStore.refreshFromRemote({ force: true });
            }

            let applications = platformStore?.getStoredApplications
                ? platformStore.getStoredApplications()
                : getStoredApplications();
            const formData = new FormData(registerForm);
            const nationalId = String(formData.get('nationalId') || '').trim();
            const leaderCode = String(formData.get('leaderCode') || '').trim();
            const latestApplication = getLatestApplication(applications, nationalId);
            let replacedExisting = false;

            if (!LEADER_CODES.includes(leaderCode)) {
                displayError(`اختر كود قائد صحيح من الأكواد المعتمدة: ${LEADER_CODES.join(' - ')}.`);
                return;
            }

            if (latestApplication) {
                const latestCreatedAt = new Date(latestApplication.createdAt || 0).getTime();
                if (Number.isFinite(latestCreatedAt) && latestCreatedAt > 0) {
                    const elapsed = Date.now() - latestCreatedAt;
                    if (elapsed < REAPPLY_WINDOW_MS) {
                        const remainingTime = formatRemainingTime(REAPPLY_WINDOW_MS - elapsed);
                        displayError(`يوجد طلب مسجل بالفعل بهذا الرقم القومي. يمكن تقديم طلب جديد بعد ${remainingTime} فقط، وبعدها سيتم حذف الطلب السابق تلقائيًا.`);
                        return;
                    }
                }

                applications = applications.filter((application) => application.nationalId !== nationalId);
                replacedExisting = true;
            }

            const requestId = generateRequestId(applications);
            const application = {
                requestId,
                nationalId,
                status: 'pending',
                name: String(formData.get('name') || '').trim(),
                dob: String(formData.get('dob') || '').trim(),
                age: calculateAge(String(formData.get('dob') || '')),
                gender: String(formData.get('gender') || '').trim(),
                village: String(formData.get('village') || '').trim(),
                governorate: String(formData.get('governorate') || '').trim(),
                city: String(formData.get('city') || '').trim(),
                leaderCode,
                ageCategory: String(formData.get('ageCategory') || '').trim(),
                message: 'طلبك قيد المراجعة حاليًا وسيتم تحديث الحالة بعد الانتهاء من المراجعة.',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const updatedApplications = [application, ...applications];
            saveStoredApplications(updatedApplications);

            if (platformStore?.addNotification) {
                platformStore.addNotification({
                    title: `طلب جديد ${application.requestId}`,
                    body: `تم تسجيل طلب جديد باسم ${application.name} وهو الآن قيد المراجعة.`,
                    type: 'application',
                    actionUrl: './status.html?requestId=' + encodeURIComponent(application.requestId) + '&nationalId=' + encodeURIComponent(application.nationalId),
                    actionLabel: 'فتح حالة الطلب'
                });
            }

            if (platformStore?.syncNow) {
                await platformStore.syncNow();
            }

            try {
                if (window.QaryaTelegram?.sendRegistration) {
                    await window.QaryaTelegram.sendRegistration(application);
                }
            } catch (error) {
                console.error('Failed to submit registration update:', error);
            }

            displaySuccess(application, replacedExisting);
            registerForm.reset();
            if (leaderCodeInput) {
                leaderCodeInput.value = LEADER_CODES[0];
            }
            resetDependentFields();
        });
    }
});
