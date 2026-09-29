---
name: smart-seo-engine
description: >-
  Comprehensive SEO & Growth playbook for SatuUndangan (satuundangan.id).
  Use this skill when optimizing search rankings, creating high-intent wedding articles,
  generating JSON-LD schemas, auditing OpenGraph tags, or designing programmatic SEO landing pages.
---

# Smart SEO Engine for SatuUndangan (`satuundangan.id`)

This skill provides the SEO and growth blueprint specifically optimized for the Indonesian digital wedding invitation market.

---

## 🎯 High-Intent Keyword Clusters (Indonesian Market)

### Cluster 1: Core Transactional (High Intent)
- `undangan pernikahan digital` (Volume: High | Intent: Transactional)
- `undangan pernikahan online gratis`
- `buat undangan pernikahan digital langsung jadi`
- `website undangan pernikahan murah`
- `undangan pernikahan aesthetic gratis`

### Cluster 2: Template & Theme Specific
- `template undangan pernikahan islami syar'i`
- `undangan digital anime wedding (Naruto / Kimi No Na Wa / One Piece)`
- `template undangan adat sunda / jawa / batak digital`
- `undangan pernikahan minimalis elegan pastel`
- `undangan pernikahan tema kucing clay art (Meowly Married)`

### Cluster 3: Programmatic & Informational Content (Top of Funnel)
- `contoh teks kata mutiara undangan pernikahan kristen alkitab`
- `ayat alquran untuk undangan pernikahan ar-rum 21`
- `susunan panitia pernikahan dan rundown acara akad resepsi`
- `lagu romantis pengiring undangan pernikahan terpopuler`
- `kalkulator budget pernikahan sederhana 50 juta`
- `doa restu pernikahan ucapan selamat menikah islami`

---

## 🏗️ Technical SEO Implementation Checklist

### 1. JSON-LD Schema Markup
Always include structured data on respective pages:

#### A. Homepage (`WebApplication` + `Organization`)
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "SatuUndangan",
  "url": "https://satuundangan.id",
  "description": "Platform pembuatan undangan pernikahan digital aesthetic, instan, dengan fitur RSVP, QRIS, dan musik latar.",
  "applicationCategory": "LifestyleApplication",
  "operatingSystem": "All",
  "offers": {
    "@type": "AggregateOffer",
    "priceCurrency": "IDR",
    "lowPrice": "0",
    "highPrice": "149000"
  }
}
</script>
```

#### B. Blog Articles (`Article` or `BlogPosting`)
Include in `src/views/BlogDetail.vue`:
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "{{ article.title }}",
  "image": "{{ article.coverImage }}",
  "author": {
    "@type": "Organization",
    "name": "Tim Editorial SatuUndangan"
  },
  "publisher": {
    "@type": "Organization",
    "name": "SatuUndangan",
    "logo": {
      "@type": "ImageObject",
      "url": "https://satuundangan.id/assets/images/logo_satuundangan.png"
    }
  },
  "datePublished": "{{ article.createdAt }}",
  "dateModified": "{{ article.updatedAt }}"
}
</script>
```

#### C. Published Wedding Invitation (`Event` schema)
For public invitations:
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "Pernikahan {{ brideName }} & {{ groomName }}",
  "startDate": "{{ akadDateTime }}",
  "endDate": "{{ resepsiDateTime }}",
  "eventAttendanceMode": "https://schema.org/MixedEventAttendanceMode",
  "eventStatus": "https://schema.org/EventScheduled",
  "location": {
    "@type": "Place",
    "name": "{{ locationName }}",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "{{ city }}",
      "addressCountry": "ID"
    }
  }
}
</script>
```

---

## ⚡ Indexing & Robots Policy

- **Public Landing & Templates**: `index, follow`
- **Blog Articles & Categories**: `index, follow`
- **Published Invitations (`isGuestPublic: true`)**: `index, follow` (optional by user preference)
- **Private Invitations (`isGuestPublic: false`)**: **`noindex, nofollow`**
- **Studio Editor & Draft Previews (`/studio`, `/inv/:slug/preview`)**: **`noindex, nofollow`**
- **User Dashboard (`/dashboard/*`)**: **`noindex, nofollow`**

---

## 📈 Programmatic Landing Page Ideas to Expand
1. `/tema/[category]` — Directory of invitation designs (e.g. `/tema/islami`, `/tema/anime`, `/tema/minimalis`).
2. `/contoh-undangan/[slug]` — Interactive public showcase with high aesthetic value.
3. `/quotes` — Searchable catalog of wedding verses and quotes (Islamic, Christian, Catholic, Hindu, General).
