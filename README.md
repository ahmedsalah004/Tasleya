# Tasleya - لوحة سين جيم

لعبة أسئلة بنمط **Seen Jeem** (لوحة 5×5) بواجهة عربية RTL، مناسبة للنشر على GitHub Pages.

## طريقة تجهيز ملف Google Sheet

1. أنشئ Google Sheet بالأعمدة التالية (يفضل نفس الأسماء):
   - `id`
   - `category`
   - `difficulty` (اختياري)
   - `points` (اختياري، القيم المفضلة: 200/400/600/800/1000)
   - `question`
   - `answer`
   - `type` (`text` أو `image`)
   - `image_url`
   - `choice_a`
   - `choice_b`
   - `choice_c`
   - `choice_d`

2. أضف الأسئلة. لو لم تضع `points` يمكن استخدام `difficulty` (سهل/متوسط/صعب أو easy/medium/hard).

## نشر Google Sheet كـ CSV

1. من Google Sheet اختر: **File → Share → Publish to web**.
2. اختر الورقة المطلوبة ثم الصيغة **CSV**.
3. انسخ الرابط الناتج.
4. افتح `script.js` وعدّل الثابت:

```js
const CSV_URL = "PUT_YOUR_PUBLISHED_CSV_URL_HERE";
```

## الصور داخل GitHub Pages

- ضع الصور داخل المستودع (مثال: `assets/flags/saudi arabia.png`).
- في عمود `image_url` اكتب المسار النسبي داخل المشروع، مثل:
  - `assets/flags/saudi arabia.png`
- الكود يحدد مسار GitHub Pages تلقائياً (`/Tasleya/`) ويستخدم `encodeURI` حتى تعمل الأسماء التي تحتوي مسافات.

## ملاحظات اللعبة

- اللوحة تتكون من 5 فئات × 5 صفوف نقاط (200 إلى 1000).
- كل خانة تُستخدم مرة واحدة فقط.
- زر **مساعدة (اختيارات)** متاح مرة واحدة فقط لكل اللعبة.
- زر **لعبة جديدة** يعيد:
  - توزيع الأسئلة بشكل عشوائي على الخانات
  - تصفير النقاط
  - إعادة تفعيل المساعدة
