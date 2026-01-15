# API Journey: Undangan Online (End-to-End)

Dokumentasi ini menjelaskan alur integrasi frontend ke backend, mulai dari user register hingga tamu menerima undangan.

**Base URL:** `http://localhost:3000` (sesuaikan dengan environment)
**Auth:** Semua endpoint bertanda 🔒 butuh Header: `Authorization: Bearer <token>`

---

## 1. Authentication (User Masuk)

### A. Register
User baru mendaftar.
- **Endpoint:** `POST /auth/register`
- **Body:**
  ```json
  {
    "name": "Romeo",
    "email": "romeo@mail.com",
    "password": "password123"
  }
  ```

### B. Login
User masuk untuk mendapatkan Token.
- **Endpoint:** `POST /auth/login`
- **Body:**
  ```json
  {
    "email": "romeo@mail.com",
    "password": "password123"
  }
  ```
- **Response:**
  ```json
  {
    "access_token": "eyJhbGciOiJIUz..." // Simpan ini untuk request selanjutnya
  }
  ```

---

## 2. Pembuatan Undangan (Creation)

### A. Pilih Template (Opsional/Flow Awal)
User melihat daftar desain.
- **Endpoint:** `GET /template-design`
- **Response:** List template beserta harga (`price`) dan `id`.

### B. Create Invitation 🔒
User membuat draft undangan.
- **Endpoint:** `POST /invitation`
- **Body:**
  ```json
  {
    "title": "The Wedding of Romeo & Juliet",
    "slug": "romeo-juliet", 
    "templateDesignId": 1, // ID Template yg dipilih (Menentukan Harga nanti)
    "groomName": "Romeo",
    "brideName": "Juliet",
    // ...field lain sesuai entity
    "whatsappMessageTemplate": "Halo [GuestName], mohon hadir di: [Link]" // Template pesan WA
  }
  ```
- **Response:** Mengembalikan object Invitation (catat `id`-nya). Status awal `isActive: false`.

---

## 3. Pembayaran (Payment & Checkout) 🔒

*Fitur Baru: Dynamic Pricing & Auto-Activation*

### A. Create Transaction (Checkout)
User ingin mengaktifkan undangan/fitur premium.
- **Endpoint:** `POST /payment/create`
- **Body:**
  ```json
  {
    "invitation_id": 1 // ID Undangan dari langkah sebelumnya
  }
  ```
- **Logic Backend:**
  1. Backend mengecek harga dari `templateDesign` yang terhubung dengan undangan.
  2. Jika template premium (harga > 0), backend membuat transaksi ke Midtrans.
- **Response:**
  ```json
  {
    "token": "d35...", // Snap Token untuk memunculkan popup Midtrans
    "redirect_url": "https://app.sandbox.midtrans.com/...",
    "order_id": "INV-1-1736..."
  }
  ```

### B. Handling Payment (Frontend)
1. Frontend menggunakan Snap.js Midtrans dengan `token` dari response di atas.
2. Setelah user bayar sukses, Midtrans akan mengirim Webhook ke Backend.
3. **Auto-Update:** Backend otomatis mengubah status `invitation.isActive = true`.

---

## 4. Guest Management (Customer Panel) 🔒

*Fitur Baru: Update Status Tamu*

### A. List Tamu
Menampilkan tabel tamu di dashboard.
- **Endpoint:** `GET /guests/invitation/:invitationId`

### B. Tambah Tamu (Manual)
- **Endpoint:** `POST /guests`
- **Body:**
  ```json
  {
    "name": "Budi Santoso",
    "phoneNumber": "08123456789",
    "invitationId": 1
  }
  ```

### C. Update Tamu (Edit & Status) 🆕
Digunakan jika typo nama ATAU update status setelah kirim WA.
- **Endpoint:** `PATCH /guests/:id`
- **Body (Contoh Edit Nama):**
  ```json
  { "name": "Budi Hartono" }
  ```
- **Body (Contoh Update Status Kirim):**
  ```json
  { "statusSend": "sent" } // Kirim ini setelah user klik tombol Share WA
  ```

### D. Generate WhatsApp Link
Mengambil link & pesan custom untuk tombol "Kirim WA".
- **Endpoint:** `GET /guests/:id/share`
- **Response:**
  ```json
  {
    "url": "https://satuundangan.id/inv/romeo-juliet/budi-santoso",
    "waLink": "https://wa.me/62812...?text=Halo%20Budi...", // Frontend tinggal open link ini
    "message": "Halo Budi..." // Tampilkan ini jika user ingin copy manual
  }
  ```

---

## 5. Import Tamu (Excel) 🔒

### A. Upload Excel
- **Endpoint:** `POST /guests/import`
- **Body:** Form-Data
  - `file`: (File Excel .xlsx)
- **Format Excel:** Kolom `Name`, `Phone Number`, `Invitation ID` (Wajib).

---

## 6. Sisi Tamu (Public)

### A. Tamu Membuka Undangan
- **Endpoint:** `GET /invitation/slug/:invitationSlug/guest/:guestSlug`
- **Aksi:** Otomatis mencatat log `view` (bisa dilihat di dashboard user).

### B. Kirim Ucapan (RSVP)
- **Endpoint:** `POST /guest-messages`
- **Body:**
  ```json
  {
    "invitationId": 1,
    "guestName": "Budi Santoso",
    "message": "Happy Wedding!",
    "rsvpStatus": "hadir"
  }
  ```
