# تسلية - سين جيم

لعبة **تسلية** بواجهة عربية RTL وثيم داكن، مع فريقين وتبديل دور تلقائي، ولوحة 5 فئات × 5 صفوف نقاط ثابتة: **100 / 200 / 300 / 400 / 500**.

## إعداد Google Sheets (مصدر CSV)

الأعمدة المطلوبة في الشيت:

- `id` (اختياري)
- `category` (إجباري)
- `points` (إجباري: إحدى القيم 100 أو 200 أو 300 أو 400 أو 500)
- `question` (إجباري)
- `answer` (إجباري)
- `type` (`text` أو `image`)
- `image_url` (اختياري)
- `choice_a`, `choice_b`, `choice_c`, `choice_d` (اختيارية)

> ملاحظة: اللعبة تعتمد على `category` للهيدر، وعلى `points` فقط لتوزيع الخانات.

## نشر الشيت كـ CSV

1. افتح Google Sheet.
2. من القائمة: **File → Share → Publish to web**.
3. اختر الورقة المطلوبة، واختر الصيغة **CSV**.
4. انسخ رابط النشر.
5. حدّث قيمة `CSV_URL` داخل `script.js` بالرابط المنشور.

زر **لعبة جديدة** يعيد تحميل CSV من `CSV_URL` في كل مرة لبناء لوحة جديدة بشكل موثوق.

## رفع الصور داخل المشروع

أنشئ/استخدم هذه المجلدات داخل المستودع:

- `assets/flags`
- `assets/maps`
- `assets/people`

في عمود `image_url` داخل Google Sheets اكتب **المسار النسبي فقط**، مثل:

- `assets/flags/nepal.jpeg`
- `assets/maps/Italy map.svg`
- `assets/people/person one.png`

المسافات في أسماء الملفات مدعومة؛ الكود يستخدم `encodeURI` عند تكوين رابط الصورة.

## GitHub Pages (مسار /Tasleya/)

الكود يضبط المسار الأساسي تلقائياً:

- داخل GitHub Pages: `/Tasleya/`
- محلياً: `/`

ثم يحمّل الصورة من:

- `encodeURI(basePath + question.image_url)`

لذلك الروابط النسبية في `image_url` تعمل محلياً وعلى GitHub Pages.
