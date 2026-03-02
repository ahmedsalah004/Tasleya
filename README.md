# تسلية - سين جيم

لعبة **Seen Jeem** بواجهة عربية RTL (لوحة 5 فئات × 5 صفوف نقاط)، مبنية بـ **HTML/CSS/JS** بدون أي إطار عمل، ومجهزة للنشر على GitHub Pages تحت المسار `/Tasleya/`.

## إعداد بنك الأسئلة من Google Sheets

استخدم هذه الأعمدة في الورقة (يفضل بنفس الأسماء):

- `id`
- `category`
- `difficulty` (اختياري)
- `points` (اختياري، القيم القياسية: 200 / 400 / 600 / 800 / 1000)
- `question`
- `answer`
- `type` (`text` أو `image`)
- `image_url`
- `choice_a`
- `choice_b`
- `choice_c`
- `choice_d`

## نشر الورقة كـ CSV

1. افتح Google Sheet.
2. اختر **File → Share → Publish to web**.
3. اختر الشيت المطلوب والنوع **CSV**.
4. انسخ رابط CSV المنشور.

المشروع يستخدم ثابت `CSV_URL` داخل `script.js`، ويمكن استبداله برابطك المنشور عند الحاجة.

## رفع الصور داخل المستودع

ارفع الصور داخل مجلدات المشروع، مثل:

- `assets/flags`
- `assets/maps`
- `assets/famous`

مثال على مسار في عمود `image_url` داخل الشيت:

- `assets/flags/nepal.jpeg`
- `assets/maps/Italy map.svg`

## ملاحظة مهمة عن المسافات في أسماء الملفات

إذا كان اسم الملف يحتوي مسافات، اتركه كما هو في `image_url` (مثال: `assets/maps/Italy map.svg`).

الكود يستخدم `encodeURI` عند تحميل الصور، لذلك المسافات والأحرف الخاصة سيتم ترميزها تلقائياً بشكل صحيح على GitHub Pages.
