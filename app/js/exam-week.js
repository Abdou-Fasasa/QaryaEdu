(() => {
    function getEgyptNow() {
        const now = new Date();
        return new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
    }

    function cloneDate(date) {
        return new Date(date.getTime());
    }

    function getCycleStart(baseDate = getEgyptNow()) {
        const start = cloneDate(baseDate);
        start.setHours(0, 0, 0, 0);

        const day = start.getDay();
        let offset = 0;

        if (day === 6) {
            offset = 0;
        } else if (day === 0) {
            offset = -1;
        } else if (day === 1) {
            offset = -2;
        } else {
            offset = 6 - day;
        }

        start.setDate(start.getDate() + offset);
        return start;
    }

    function toDateKey(date) {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Africa/Cairo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(date);
    }

    function formatDateText(date) {
        return new Intl.DateTimeFormat('ar-EG', {
            timeZone: 'Africa/Cairo',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).format(date);
    }

    function getCurrentExamDays(baseDate = getEgyptNow()) {
        const start = getCycleStart(baseDate);
        const labels = ['السبت', 'الأحد', 'الاثنين'];

        return labels.map((label, index) => {
            const date = cloneDate(start);
            date.setDate(start.getDate() + index);
            return {
                label,
                isoDate: toDateKey(date),
                dateText: formatDateText(date)
            };
        });
    }

    function filterCurrentWeekResults(results, baseDate = getEgyptNow()) {
        const days = getCurrentExamDays(baseDate);
        const allowedKeys = new Set(days.map((day) => day.isoDate));

        return (Array.isArray(results) ? results : []).map((student) => {
            const attempts = Array.isArray(student?.attempts) ? student.attempts : [];
            return {
                ...student,
                attempts: attempts.filter((attempt) => allowedKeys.has(String(attempt?.date || '').slice(0, 10)))
            };
        });
    }

    window.QaryaExamWeek = {
        getEgyptNow,
        getCurrentExamDays,
        filterCurrentWeekResults
    };
})();
