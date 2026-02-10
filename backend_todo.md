# Backend Development Requirements - SatuUndangan

## 🛠️ Data Handling & Logic

- [x] **Adjustment: Unified Event Logic (Akad & Resepsi)**
    - Pastikan API dapat menerima dan menyimpan data dengan benar saat user memilih untuk menyatukan Akad dan Resepsi.
    - Handle kondisi di mana field `waktu`, `maps`, dan `alamat` harus sinkron atau hanya merujuk pada satu entitas event jika digabung.
    - **Status**: Done. Logic added to `InvitationService`.

- [x] **Support: Menu Makanan & Love Story Data**
    - Pastikan skema database dan endpoint CRUD sudah mendukung field-field untuk Menu Makanan (list menu) dan Love Story (timeline/cerita).
    - **Status**: Done. Verified in `Invitation` entity and DTOs.

- [x] **Support: photoCoupleUrl field**
    - Pastikan skema database dan DTO mendukung field `photoCoupleUrl` (untuk foto utama pasangan/background).
    - Saat ini FE mengirimkan `photoCouple` dan `photoCoupleUrl` di root payload. Pastikan ini disimpan ke kolom `content` atau kolom yang sesuai.
    - **Status**: Done. Added `photoCoupleUrl` to `Invitation` entity and `CreateInvitationDto`. Included in `findBySlug` response.

## 💳 Payments & Transactions

- [x] **Payment Simulation Hook**
    - Sediakan mekanis atau endpoint untuk melakukan simulasi status pembayaran (Success/Pending/Failed).
    - Pastikan status undangan berubah secara otomatis setelah pembayaran berhasil disimulasikan.
    - **Status**: Done. Added `POST /payment/simulate` endpoint.

## 📊 Data Consistency

- [x] **Dashboard Integrity**
    - FE sudah menggunakan endpoint `GET /dashboard/stats`. Pastikan backend sudah mengimplementasikannya dengan data akurat.
    - **Status**: Done. Verified `DashboardService` implementation.