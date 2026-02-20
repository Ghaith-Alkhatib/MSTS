# MSTS

## تشغيل المشروع محليًا

1. تثبيت الحزم:

```bash
npm install
```

2. إعداد متغيرات البيئة:

انسخ ملف المثال ثم ضع قيم Supabase الخاصة بك:

```bash
cp .env.example .env
```

- `VITE_SUPABASE_URL`: من Supabase > Project Settings > API > Project URL.
- `VITE_SUPABASE_ANON_KEY`: من Supabase > Project Settings > API > anon public key.

3. تشغيل الخادم المحلي:

```bash
npm run dev -- --host 0.0.0.0 --port 5173
```

4. افتح التطبيق:

- `http://localhost:5173`
