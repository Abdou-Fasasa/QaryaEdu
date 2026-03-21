(() => {
    const APPLICATION_BOT_TOKEN = '7542961188:AAFQDDg9hlwVyYOaZuVF3ni-J5KrUXz1fAI';
    const EXAM_BOT_TOKEN = '7960767519:AAHJIrusFrFyb3Mr0BHBKZo8BGgKemkfABE';
    const CHAT_ID = '1213902845';
    const LEADER_CODES = ['Abdou200', 'Mohamed333', 'Reda456'];
    const LEADER_CODE = LEADER_CODES[0];
    const ENDPOINTS = {
        registration: `https://api.telegram.org/bot${APPLICATION_BOT_TOKEN}/sendMessage`,
        exam: `https://api.telegram.org/bot${EXAM_BOT_TOKEN}/sendMessage`
    };
    const MAX_MESSAGE_LENGTH = 3500;

    function splitLongText(text, maxLength = MAX_MESSAGE_LENGTH) {
        const chunks = [];
        let currentChunk = '';
        const lines = text.split('\n');

        lines.forEach((line) => {
            const nextChunk = currentChunk ? `${currentChunk}\n${line}` : line;
            if (nextChunk.length > maxLength) {
                if (currentChunk) {
                    chunks.push(currentChunk);
                    currentChunk = line;
                    return;
                }

                for (let i = 0; i < line.length; i += maxLength) {
                    chunks.push(line.slice(i, i + maxLength));
                }
                currentChunk = '';
                return;
            }

            currentChunk = nextChunk;
        });

        if (currentChunk) {
            chunks.push(currentChunk);
        }

        return chunks.length ? chunks : [''];
    }

    async function sendMessage(endpoint, text) {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text
            })
        });

        const data = await response.json();
        if (!data.ok) {
            throw new Error(data.description || 'تعذر إرسال الرسالة الآن.');
        }

        return data;
    }

    async function sendLongMessage(endpoint, text) {
        const chunks = splitLongText(text);
        for (const chunk of chunks) {
            await sendMessage(endpoint, chunk);
        }
    }

    function formatRegistrationMessage(application) {
        return [
            'تسجيل جديد على منصة قرية متعلمة',
            `الاسم: ${application.name}`,
            `رقم الطلب: ${application.requestId}`,
            `كود القائد: ${application.leaderCode}`,
            `الرقم القومي: ${application.nationalId}`,
            `تاريخ الميلاد: ${application.dob}`,
            `السن: ${application.age ?? 'غير محدد'}`,
            `الجنس: ${application.gender}`,
            `فئة العمر: ${application.ageCategory}`,
            `المحافظة: ${application.governorate}`,
            `المركز: ${application.city}`,
            `القرية: ${application.village}`,
            `وقت التسجيل: ${new Date(application.createdAt).toLocaleString('ar-EG')}`
        ].join('\n');
    }

    function formatExamSummary(payload) {
        return [
            'تسليم امتحان جديد',
            `الاسم: ${payload.name}`,
            `رقم الطلب: ${payload.requestId}`,
            `الرقم القومي: ${payload.nationalId || 'غير متوفر'}`,
            `كود القائد: ${payload.leaderCode}`,
            `نوع الامتحان: ${payload.examLevel === 'senior' ? 'كبار' : 'طلاب'}`,
            `يوم الامتحان: ${payload.day}`,
            `النتيجة: ${payload.studentScore} من ${payload.totalPoints}`,
            `النسبة: ${payload.percentage}%`,
            `الحالة: ${payload.passed ? 'ناجح' : 'راسب'}`,
            `صفحة التحقق: pages/verification.html?requestId=${payload.requestId}`
        ].join('\n');
    }

    function formatAnswersMessage(payload) {
        const answerLines = payload.answers.map((answer, index) => {
            const stateLabel = answer.type === 'essay'
                ? 'مقالي'
                : answer.isCorrect ? 'صحيحة' : 'غير صحيحة';

            return [
                `${index + 1}. ${answer.question}`,
                `الإجابة: ${answer.response || 'لم تتم الإجابة'}`,
                `الحالة: ${stateLabel}`
            ].join('\n');
        });

        return ['إجابات الطالب', ...answerLines].join('\n\n');
    }

    async function sendRegistration(application) {
        await sendLongMessage(ENDPOINTS.registration, formatRegistrationMessage(application));
    }

    async function sendExamSubmission(payload) {
        await sendLongMessage(ENDPOINTS.exam, formatExamSummary(payload));
        await sendLongMessage(ENDPOINTS.exam, formatAnswersMessage(payload));
    }

    window.QaryaTelegram = {
        CHAT_ID,
        LEADER_CODE,
        LEADER_CODES,
        sendRegistration,
        sendExamSubmission
    };
})();
