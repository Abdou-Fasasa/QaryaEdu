document.addEventListener('DOMContentLoaded', () => {
    const weekHelper = window.QaryaExamWeek;
    const weekDays = weekHelper ? weekHelper.getCurrentExamDays() : [];
    const weekWindow = document.getElementById('calendar-week-window');

    if (weekWindow && weekDays.length) {
        weekWindow.textContent = `${weekDays[0].dateText} - ${weekDays[2].dateText}`;
    }

    weekDays.forEach((day, index) => {
        const cardKey = ['saturday', 'sunday', 'monday'][index];
        const dateElement = document.getElementById(`day-${cardKey}-date`);
        const noteElement = document.getElementById(`day-${cardKey}-note`);

        if (dateElement) {
            dateElement.textContent = day.dateText;
        }

        if (noteElement) {
            noteElement.textContent = 'يبدأ هذا اليوم بسجل أسبوعي جديد ويتم تفريغ الأداء القديم تلقائيًا مع بداية الأسبوع التالي.';
        }
    });
});
