# دخالت‌های آمریکا در امور داخلی ایران

یک وبسایت استاتیک مستند با بیش از ۴۲ رویداد تاریخی از دخالت‌های آمریکا در امور ایران، از ۱۹۰۰ تا امروز.

**سایت زنده:** https://aminsaedi.github.io/iran-us-history/

## فناوری

- **Static Site Generator:** Jekyll 4
- **محتوا:** فایل‌های Markdown در پوشه `_events/`
- **Deploy:** GitHub Actions → GitHub Pages

## اضافه کردن رویداد جدید

یک فایل `.md` جدید در `_events/` بسازید:

```markdown
---
title: "عنوان رویداد"
year: "۱۳۹۹"
era_id: era-2020
era_title: "دهه ۲۰۲۰"
era_range: "ترور، تنش، حمله مستقیم"
era_label: "۲۰۲۰–اکنون"
category: military
category_label: "نظامی"
featured: false
image: "https://example.com/image.jpg"
---
توضیحات رویداد اینجا...
```

### دسته‌بندی‌ها (category)
- `coup` — کودتا
- `sanction` — تحریم
- `military` — نظامی
- `cyber` — سایبری
- `diplo` — دیپلماسی
- `intel` — اطلاعاتی
