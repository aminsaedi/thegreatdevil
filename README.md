# شیطان بزرگ (The Great Devil)

مستندات دخالت‌های آمریکا در امور داخلی ایران از ۱۹۰۱ تا جنگ جاری ۲۰۲۶.

**سایت زنده:** https://thegreatdevil.com  
**مخزن:** https://github.com/aminsaedi/thegreatdevil

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
order: 1                  # ترتیب نمایش درون همان دوره (اجباری)
era_id: era-2020
era_title: "دهه ۲۰۲۰"
era_range: "ترور سلیمانی، بن‌بست هسته‌ای، تنش"
era_label: "۲۰۲۰–اکنون"
category: military
category_label: "نظامی"
featured: false
image: "/assets/images/events/example.jpg"
description: "خلاصه یک‌جمله‌ای برای کارت صفحه اصلی و متا تگ‌ها"
sources:
  - title: "Source title in English"
    url: "https://example.com/specific-article"   # لینک مستقیم مقاله، نه صفحه اصلی سایت
    publisher: "Publisher"
    year: 2026
    type: news            # declassified | official | archive | academic | ngo | journalism | news | reference
    type_label: "خبرگزاری"
---
توضیحات رویداد اینجا...
```

**نکته‌ها:**
- `order` در هر دوره (`era_id`) باید یکتا و به ترتیب زمانی باشد؛ صفحه اصلی رویدادها را بر اساس همین فیلد مرتب می‌کند.
- `url` منابع باید به مقاله مشخص اشاره کند، نه به صفحه اصلی خبرگزاری.

### دسته‌بندی‌ها (category)
- `coup`: کودتا
- `sanction`: تحریم
- `military`: نظامی
- `cyber`: سایبری
- `diplo`: دیپلماسی
- `intel`: اطلاعاتی
