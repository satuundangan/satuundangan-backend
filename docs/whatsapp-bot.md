# WhatsApp Bot Gratis

Bot ini memakai WhatsApp Cloud API resmi dari Meta tanpa provider pihak ketiga. Biaya dari sisi aplikasi SatuUndangan tidak ada, tetapi penggunaan WhatsApp tetap mengikuti pricing dan free tier Meta.

## Endpoint

- Webhook verification: `GET /whatsapp/webhook`
- Incoming message webhook: `POST /whatsapp/webhook`

Di Meta Developer Dashboard, isi callback URL dengan:

```text
https://api.satuundangan.id/whatsapp/webhook
```

Subscribe field webhook `messages`.

## Environment

Tambahkan variable berikut di environment backend:

```bash
WHATSAPP_WEBHOOK_VERIFY_TOKEN=token-rahasia-yang-sama-dengan-dashboard-meta
WHATSAPP_ACCESS_TOKEN=token-cloud-api-dari-meta
WHATSAPP_PHONE_NUMBER_ID=phone-number-id-dari-meta
WHATSAPP_GRAPH_API_VERSION=v23.0
WHATSAPP_BOT_USER_EMAIL=whatsapp-bot@satuundangan.local
WHATSAPP_BOT_DEFAULT_TEMPLATE_SLUG=dark-elegant
WHATSAPP_BOT_DEFAULT_TEMPLATE_ID=
FRONTEND_URL=https://www.satuundangan.id
```

`WHATSAPP_BOT_DEFAULT_TEMPLATE_ID` opsional. Jika diisi, bot akan memakai template itu. Jika kosong, bot mencari template dengan slug `WHATSAPP_BOT_DEFAULT_TEMPLATE_SLUG`, lalu fallback ke template gratis pertama yang published.

## Flow Chat

User ketik `mulai`, lalu bot meminta:

1. Nama mempelai pria.
2. Nama mempelai wanita.
3. Tanggal dan jam acara, contoh `20-12-2026 09:00`.
4. Lokasi acara.
5. Link Google Maps, bisa `-`.
6. Orang tua mempelai wanita, bisa `-`.
7. Orang tua mempelai pria, bisa `-`.
8. Quote pembuka, bisa `-`.
9. Konfirmasi `ya`.

Setelah konfirmasi, backend membuat undangan gratis dengan `isPublished=true` dan mengirim link publik:

```text
https://www.satuundangan.id/{slug}
```

## Catatan Operasional

- Bot hanya membalas pesan dalam service window WhatsApp. Untuk pesan di luar window, perlu template message yang disetujui Meta.
- Bot menyimpan session per nomor WhatsApp di tabel `whatsapp_bot_sessions`.
- Ketik `mulai`, `start`, `reset`, atau `ulang` untuk mengulang dari awal.
- Ketik `help` atau `bantuan` untuk instruksi singkat.
