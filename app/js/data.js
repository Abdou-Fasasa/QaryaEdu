// Egyptian location data with leaders
const locationData = [
    // --- القاهرة ---
    { governorate: "القاهرة", city: "المعادي", name: "حي المعادي", leader: "أحمد حسام الدين طه", rating: 5, applicantsCount: 120, youthCount: 70, childrenCount: 50 },
    { governorate: "القاهرة", city: "شبرا", name: "شبرا الخيمة", leader: "فاطمة الزهراء علي محمد", rating: 4, applicantsCount: 80, youthCount: 40, childrenCount: 40 },
    { governorate: "القاهرة", city: "التجمع الخامس", name: "حي اللوتس", leader: "يوسف خالد منصور", rating: 5, applicantsCount: 90, youthCount: 50, childrenCount: 40 },
    { governorate: "القاهرة", city: "حلوان", name: "قرية كفر العلو", leader: "مريم علي إبراهيم", rating: 3, applicantsCount: 65, youthCount: 30, childrenCount: 35 },
    { governorate: "القاهرة", city: "مدينة نصر", name: "حي الزهراء", leader: "خالد نبيل عبد الرحمن", rating: 4, applicantsCount: 105, youthCount: 60, childrenCount: 45 },

    // --- الجيزة ---
    { governorate: "الجيزة", city: "الهرم", name: "المنطقة الأثرية", leader: "سارة محمود علي السيد", rating: 4, applicantsCount: 95, youthCount: 55, childrenCount: 40 },
    { governorate: "الجيزة", city: "الدقي", name: "حي الدقي", leader: "محمود يوسف إبراهيم", rating: 5, applicantsCount: 70, youthCount: 35, childrenCount: 35 },
    { governorate: "الجيزة", city: "أوسيم", name: "قرية برطس", leader: "حسين محمد أحمد", rating: 3, applicantsCount: 55, youthCount: 25, childrenCount: 30 },
    { governorate: "الجيزة", city: "البدرشين", name: "قرية سقارة", leader: "إيناس سعيد توفيق", rating: 4, applicantsCount: 40, youthCount: 18, childrenCount: 22 },
    
    // --- الإسكندرية ---
    { governorate: "الإسكندرية", city: "المنتزة", name: "حي سيدي بشر", leader: "ياسمين محمد كمال", rating: 3, applicantsCount: 60, youthCount: 25, childrenCount: 35 },
    { governorate: "الإسكندرية", city: "العجمي", name: "حي العجمي", leader: "علي مصطفى عبد اللطيف", rating: 4, applicantsCount: 88, youthCount: 50, childrenCount: 38 },
    { governorate: "الإسكندرية", city: "برج العرب", name: "قرية بهيج", leader: "نورا فؤاد عثمان", rating: 3, applicantsCount: 30, youthCount: 10, childrenCount: 20 },
    
    // --- الشرقية ---
    { governorate: "الشرقية", city: "الزقازيق", name: "حي القومية", leader: "أشرف كمال محمد", rating: 5, applicantsCount: 115, youthCount: 60, childrenCount: 55 },
    { governorate: "الشرقية", city: "بلبيس", name: "مدينة بلبيس", leader: "هدى سعيد جابر", rating: 4, applicantsCount: 90, youthCount: 50, childrenCount: 40 },
    { governorate: "الشرقية", city: "أبو حماد", name: "قرية الأسدية", leader: "طارق عبد الله مرسي", rating: 3, applicantsCount: 45, youthCount: 20, childrenCount: 25 },

    // --- الدقهلية ---
    { governorate: "الدقهلية", city: "المنصورة", name: "حي توريل", leader: "إياد زكريا حسين", rating: 5, applicantsCount: 110, youthCount: 60, childrenCount: 50 },
    { governorate: "الدقهلية", city: "السنبلاوين", name: "قرية ميت غمر", leader: "حازم أحمد علي", rating: 4, applicantsCount: 75, youthCount: 40, childrenCount: 35 },
    { governorate: "الدقهلية", city: "طلخا", name: "مدينة طلخا", leader: "منى جمال الصاوي", rating: 4, applicantsCount: 85, youthCount: 45, childrenCount: 40 },

    // --- المنوفية ---
    { governorate: "المنوفية", city: "شبين الكوم", name: "قرية كفر البتانون", leader: "هاني محمود إمام", rating: 4, applicantsCount: 55, youthCount: 25, childrenCount: 30 },
    { governorate: "المنوفية", city: "تلا", name: "قرية كفر ربيع", leader: "سالي هشام فوزي", rating: 3, applicantsCount: 35, youthCount: 15, childrenCount: 20 },

    // --- الغربية ---
    { governorate: "الغربية", city: "المحلة الكبرى", name: "قرية محلة روح", leader: "مصطفى كامل مصطفى", rating: 3, applicantsCount: 55, youthCount: 25, childrenCount: 30 },
    { governorate: "الغربية", city: "طنطا", name: "حي سيجر", leader: "كريم ناصر إبراهيم", rating: 5, applicantsCount: 100, youthCount: 55, childrenCount: 45 },

    // --- القليوبية ---
    { governorate: "القليوبية", city: "بنها", name: "مدينة بنها", leader: "يوسف أيمن السيد", rating: 4, applicantsCount: 85, youthCount: 45, childrenCount: 40 },
    { governorate: "القليوبية", city: "قليوب", name: "قرية بلقس", leader: "نورهان مجدي سالم", rating: 3, applicantsCount: 40, youthCount: 20, childrenCount: 20 },

    // --- كفر الشيخ ---
    { governorate: "كفر الشيخ", city: "دسوق", name: "قرية شباس عمير", leader: "نوران علي عبد العزيز", rating: 3, applicantsCount: 45, youthCount: 20, childrenCount: 25 },
    { governorate: "كفر الشيخ", city: "الرياض", name: "قرية الروس", leader: "فهد محمد جودة", rating: 4, applicantsCount: 30, youthCount: 15, childrenCount: 15 },
    
    // --- البحيرة ---
    { governorate: "البحيرة", city: "دمنهور", name: "مدينة دمنهور", leader: "منال محمد عبد الحميد", rating: 5, applicantsCount: 70, youthCount: 40, childrenCount: 30 },
    { governorate: "البحيرة", city: "أبو حمص", name: "قرية الأبقعين", leader: "سعد زغلول محمود", rating: 3, applicantsCount: 50, youthCount: 25, childrenCount: 25 },
    
    // --- الفيوم ---
    { governorate: "الفيوم", city: "طامية", name: "قرية كفر عميرة", leader: "علياء مصطفى جلال", rating: 3, applicantsCount: 40, youthCount: 15, childrenCount: 25 },
    { governorate: "الفيوم", city: "الفيوم", name: "حي الجامعة", leader: "هشام إبراهيم عبد الحميد", rating: 4, applicantsCount: 60, youthCount: 30, childrenCount: 30 },

    // --- المنيا ---
    { governorate: "المنيا", city: "ملوي", name: "مدينة ملوي", leader: "زينب كمال حسني", rating: 4, applicantsCount: 40, youthCount: 15, childrenCount: 25 },
    { governorate: "المنيا", city: "المنيا الجديدة", name: "حي البهنسا", leader: "حسين جابر محمد", rating: 3, applicantsCount: 35, youthCount: 10, childrenCount: 25 },
    
    // --- أسيوط ---
    { governorate: "أسيوط", city: "أبنوب", name: "مدينة أبنوب", leader: "نورهان فتحي عثمان", rating: 5, applicantsCount: 55, youthCount: 30, childrenCount: 25 },
    { governorate: "أسيوط", city: "أسيوط الجديدة", name: "حي الزهور", leader: "ماجد عصام خليل", rating: 4, applicantsCount: 45, youthCount: 20, childrenCount: 25 },
    
    // --- سوهاج ---
    { governorate: "سوهاج", city: "جرجا", name: "قرية الزهايرة", leader: "علاء الدين فتحي", rating: 4, applicantsCount: 60, youthCount: 30, childrenCount: 30 },
    { governorate: "سوهاج", city: "سوهاج", name: "حي الكوثر", leader: "أمل سامي رزق", rating: 5, applicantsCount: 75, youthCount: 40, childrenCount: 35 },
    
    // --- قنا ---
    { governorate: "قنا", city: "نقادة", name: "قرية الحمران", leader: "طارق سليم حسين", rating: 4, applicantsCount: 60, youthCount: 30, childrenCount: 30 },
    { governorate: "قنا", city: "قوص", name: "مدينة قوص", leader: "فداء حسن عبد العليم", rating: 3, applicantsCount: 40, youthCount: 20, childrenCount: 20 },
    
    // --- الأقصر ---
    { governorate: "الأقصر", city: "الأقصر الجديدة", name: "حي الكرنك", leader: "عمران أحمد البيه", rating: 4, applicantsCount: 75, youthCount: 45, childrenCount: 30 },
    { governorate: "الأقصر", city: "إسنا", name: "قرية توماس", leader: "نزار أيمن محمد", rating: 5, applicantsCount: 35, youthCount: 15, childrenCount: 20 },
    { governorate: "الأقصر", city: "القرنة", name: "قرية الطارف", leader: "يحيى عبد الصبور محمد", rating: 3, applicantsCount: 30, youthCount: 15, childrenCount: 15 },
    
    // --- أسوان ---
    { governorate: "أسوان", city: "إدفو", name: "مدينة إدفو", leader: "هاجر عادل فؤاد", rating: 4, applicantsCount: 65, youthCount: 40, childrenCount: 25 },
    { governorate: "أسوان", city: "كوم أمبو", name: "قرية المنشية", leader: "صلاح الدين مراد", rating: 4, applicantsCount: 55, youthCount: 30, childrenCount: 25 },

    // --- البحر الأحمر ---
    { governorate: "البحر الأحمر", city: "الغردقة", name: "حي الدهار", leader: "هشام علي السيد", rating: 5, applicantsCount: 40, youthCount: 25, childrenCount: 15 },
    { governorate: "البحر الأحمر", city: "مرسى علم", name: "منطقة القلعان", leader: "دعاء كمال حامد", rating: 4, applicantsCount: 15, youthCount: 10, childrenCount: 5 },
    
    // --- السويس ---
    { governorate: "السويس", city: "عتاقة", name: "حي عتاقة", leader: "نادية رشوان محمود", rating: 3, applicantsCount: 30, youthCount: 15, childrenCount: 15 },
    
    // --- الإسماعيلية ---
    { governorate: "الإسماعيلية", city: "فايد", name: "حي الشجاعة", leader: "ريم عادل مصطفى", rating: 4, applicantsCount: 40, youthCount: 20, childrenCount: 20 },
    
    // --- بورسعيد ---
    { governorate: "بورسعيد", city: "بور فؤاد", name: "حي العرب", leader: "سيف الدين محمد علي", rating: 5, applicantsCount: 35, youthCount: 18, childrenCount: 17 },
    
    // --- شمال سيناء ---
    { governorate: "شمال سيناء", city: "العريش", name: "مدينة العريش", leader: "حازم إبراهيم سلامة", rating: 4, applicantsCount: 35, youthCount: 20, childrenCount: 15 },

    // --- جنوب سيناء ---
    { governorate: "جنوب سيناء", city: "دهب", name: "مدينة دهب", leader: "وائل سمير أمين", rating: 5, applicantsCount: 20, youthCount: 10, childrenCount: 10 },
    { governorate: "جنوب سيناء", city: "شرم الشيخ", name: "حي الرويسات", leader: "عبير فوزي توفيق", rating: 4, applicantsCount: 25, youthCount: 15, childrenCount: 10 },
    
    // --- مطروح ---
    { governorate: "مطروح", city: "مرسى مطروح", name: "حي العوام", leader: "جمال إبراهيم زكريا", rating: 3, applicantsCount: 25, youthCount: 15, childrenCount: 10 },
    
    // --- الوادي الجديد ---
    { governorate: "الوادي الجديد", city: "الخارجة", name: "حي الوفاء", leader: "سامي يوسف حسين", rating: 4, applicantsCount: 20, youthCount: 10, childrenCount: 10 },
    
    // --- دمياط ---
    { governorate: "دمياط", city: "فارسكور", name: "مدينة فارسكور", leader: "أحمد عبد الوهاب سليمان", rating: 4, applicantsCount: 50, youthCount: 25, childrenCount: 25 }
];
