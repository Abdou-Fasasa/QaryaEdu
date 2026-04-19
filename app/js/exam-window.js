(() => {
    const EXAM_START_HOUR = 19;
    const EXAM_END_HOUR = 20;
    const EXAM_DAYS = [6, 0, 1];
    const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const DEFAULT_MANUAL_MINUTES = 60;

    function getEgyptNow() {
        return new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
    }

    function isExamDay(date) {
        return EXAM_DAYS.includes(date.getDay());
    }

    function getExamStart(date) {
        const examStart = new Date(date);
        examStart.setHours(EXAM_START_HOUR, 0, 0, 0);
        return examStart;
    }

    function getExamEnd(date) {
        const examEnd = new Date(date);
        examEnd.setHours(EXAM_END_HOUR, 0, 0, 0);
        return examEnd;
    }

    function getNextExamStart(date) {
        for (let i = 0; i <= 7; i += 1) {
            const candidate = new Date(date);
            candidate.setDate(candidate.getDate() + i);
            candidate.setHours(EXAM_START_HOUR, 0, 0, 0);
            if (isExamDay(candidate) && candidate > date) {
                return candidate;
            }
        }

        const fallback = new Date(date);
        fallback.setDate(fallback.getDate() + 1);
        fallback.setHours(EXAM_START_HOUR, 0, 0, 0);
        return fallback;
    }

    function formatCountdown(diff) {
        const totalSeconds = Math.max(0, Math.floor(diff / 1000));
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const parts = [];

        if (days > 0) parts.push(`${days} يوم`);
        parts.push(`${String(hours).padStart(2, '0')} ساعة`);
        parts.push(`${String(minutes).padStart(2, '0')} دقيقة`);
        parts.push(`${String(seconds).padStart(2, '0')} ثانية`);

        return parts.join('، ');
    }

    function formatNextSlot(date) {
        return `${DAY_NAMES[date.getDay()]} ${date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' })} - 07:00 مساءً`;
    }

    function normalizeSettings(settings = {}) {
        const mode = settings.examMode === 'open' || settings.examMode === 'closed' ? settings.examMode : 'default';
        const manualExamOpenedAt = String(settings.manualExamOpenedAt || '').trim();
        const manualExamEndsAt = String(settings.manualExamEndsAt || '').trim();
        const manualExamDurationMinutes = Math.max(5, Number(settings.manualExamDurationMinutes || DEFAULT_MANUAL_MINUTES));
        let resolvedManualEnd = manualExamEndsAt;

        if (!resolvedManualEnd && manualExamOpenedAt) {
            const openedAtDate = new Date(manualExamOpenedAt);
            if (!Number.isNaN(openedAtDate.getTime())) {
                openedAtDate.setMinutes(openedAtDate.getMinutes() + manualExamDurationMinutes);
                resolvedManualEnd = openedAtDate.toISOString();
            }
        }

        return {
            examMode: mode,
            examModeMessage: String(settings.examModeMessage || '').trim(),
            manualExamOpenedAt,
            manualExamEndsAt: resolvedManualEnd,
            manualExamDurationMinutes,
            updatedAt: String(settings.updatedAt || '').trim()
        };
    }

    function buildState(overrides = {}) {
        return {
            mode: 'default',
            open: false,
            manual: false,
            showCountdown: false,
            countdownTarget: null,
            countdownPrefix: '',
            todayText: '',
            nextText: '',
            accessText: '',
            bannerText: '',
            statusText: '',
            ...overrides
        };
    }

    function getExamWindowState(now = getEgyptNow(), rawSettings = {}) {
        const settings = normalizeSettings(rawSettings);
        const manualEnd = settings.manualExamEndsAt ? new Date(settings.manualExamEndsAt) : null;
        const manualOpenActive = settings.examMode === 'open'
            && manualEnd
            && !Number.isNaN(manualEnd.getTime())
            && manualEnd > now;

        if (manualOpenActive) {
            return buildState({
                mode: 'open',
                open: true,
                manual: true,
                showCountdown: true,
                countdownTarget: manualEnd,
                countdownPrefix: 'تم فتح الامتحان من الإدارة. المتبقي على الإغلاق',
                todayText: 'تم فتحه يدويًا',
                nextText: `يغلق عند ${manualEnd.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`,
                accessText: settings.examModeMessage || 'تم فتح الامتحان الآن بقرار من الإدارة.',
                bannerText: settings.examModeMessage || 'تم فتح الامتحان الآن من لوحة الإدارة.',
                statusText: 'تم فتح الامتحان'
            });
        }

        if (settings.examMode === 'closed') {
            return buildState({
                mode: 'closed',
                open: false,
                manual: true,
                showCountdown: false,
                todayText: 'متوقف الآن',
                nextText: 'بانتظار قرار الإدارة',
                accessText: settings.examModeMessage || 'الامتحان متوقف حاليًا.',
                bannerText: settings.examModeMessage || 'تم إيقاف الامتحان من لوحة الإدارة.',
                statusText: 'الامتحان متوقف'
            });
        }

        const examStartToday = getExamStart(now);
        const examEndToday = getExamEnd(now);
        const nextExamStart = getNextExamStart(now);
        const isOpen = isExamDay(now) && now >= examStartToday && now < examEndToday;

        if (isOpen) {
            return buildState({
                mode: 'default',
                open: true,
                showCountdown: true,
                countdownTarget: examEndToday,
                countdownPrefix: 'الامتحان مفتوح الآن. المتبقي على الإغلاق',
                todayText: `نعم، ${DAY_NAMES[now.getDay()]}`,
                nextText: 'يغلق 08:00 مساءً',
                accessText: 'الحقول متاحة الآن.',
                bannerText: 'الامتحان مفتوح الآن وفق الجدول الرسمي.',
                statusText: 'الامتحان مفتوح الآن'
            });
        }

        if (isExamDay(now) && now < examStartToday) {
            return buildState({
                mode: 'default',
                open: false,
                showCountdown: true,
                countdownTarget: examStartToday,
                countdownPrefix: 'متبقٍ على فتح امتحان اليوم',
                todayText: 'يبدأ 07:00 مساءً',
                nextText: formatNextSlot(examStartToday),
                accessText: 'الامتحان لم يبدأ بعد.',
                bannerText: 'يوجد امتحان اليوم لكنه لم يبدأ بعد.',
                statusText: 'بانتظار فتح امتحان اليوم'
            });
        }

        if (isExamDay(now) && now >= examEndToday) {
            return buildState({
                mode: 'default',
                open: false,
                showCountdown: true,
                countdownTarget: nextExamStart,
                countdownPrefix: 'انتهى امتحان اليوم. المتبقي على أقرب موعد',
                todayText: 'انتهى امتحان اليوم',
                nextText: formatNextSlot(nextExamStart),
                accessText: 'تم إغلاق الحقول حتى الموعد التالي.',
                bannerText: 'انتهى امتحان اليوم وسيبدأ الموعد التالي وفق الجدول.',
                statusText: 'انتهى امتحان اليوم'
            });
        }

        return buildState({
            mode: 'default',
            open: false,
            showCountdown: true,
            countdownTarget: nextExamStart,
            countdownPrefix: 'لا يوجد امتحان اليوم. المتبقي على أقرب موعد',
            todayText: 'لا يوجد امتحانات اليوم',
            nextText: formatNextSlot(nextExamStart),
            accessText: 'لا توجد حقول كتابة لأن الامتحان غير متاح اليوم.',
            bannerText: 'لا يوجد امتحانات اليوم.',
            statusText: 'لا يوجد امتحانات اليوم'
        });
    }

    window.QaryaExamWindow = {
        EXAM_DAYS,
        DAY_NAMES,
        EXAM_START_HOUR,
        EXAM_END_HOUR,
        DEFAULT_MANUAL_MINUTES,
        getEgyptNow,
        isExamDay,
        getExamStart,
        getExamEnd,
        getNextExamStart,
        formatCountdown,
        formatNextSlot,
        normalizeSettings,
        getExamWindowState
    };
})();
