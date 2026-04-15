# Satu Undangan API Documentation ✨

Dokumentasi ini berisi daftar endpoint, struktur request (DTO), dan gambaran response dari backend Satu Undangan.

## Base URL
`https://api.satuundangan.id` (Production)
`http://localhost:3000` (Local Development)

---

## 🔐 Authentication & User
Base Path: `/auth` & `/user`

### 1. Register User
*   **Endpoint:** `POST /auth/register`
*   **Body:**
    ```json
    {
      "name": "John Doe",
      "email": "john@example.com",
      "password": "password123"
    }
    ```

### 2. Login User
*   **Endpoint:** `POST /auth/login`
*   **Body:**
    ```json
    {
      "email": "john@example.com",
      "password": "password123"
    }
    ```
*   **Response:** `{ "access_token": "JWT_TOKEN_HERE" }`

### 3. Get My Profile
*   **Endpoint:** `GET /auth/me` atau `GET /user/me`
*   **Header:** `Authorization: Bearer <token>`

### 4. Update Profile
*   **Endpoint:** `PATCH /user`
*   **Header:** `Authorization: Bearer <token>`
*   **Body:** `{ "name": "New Name", "avatar": "URL_IMAGE" }`

---

## 💌 Invitations (User Side)
Base Path: `/invitation`

### 1. Create Invitation
*   **Endpoint:** `POST /invitation`
*   **Body:**
    ```json
    {
      "title": "The Wedding of A & B",
      "slug": "wedding-a-b",
      "groomName": "Groom Name",
      "brideName": "Bride Name",
      "templateName": "botanical-watercolor",
      "content": { ... },
      "is_published": false
    }
    ```

### 2. List My Invitations
*   **Endpoint:** `GET /invitation`
*   **Query Params:** `page`, `limit`, `q` (search)

### 3. Get Invitation by Slug (Public)
*   **Endpoint:** `GET /invitation/slug/:slug`

### 4. Get Invitation with Guest (Public)
*   **Endpoint:** `GET /invitation/slug/:invitationSlug/guest/:guestSlug`

---

## 📊 Dashboard
Base Path: `/dashboard`

### 1. Get Dashboard Statistics
*   **Endpoint:** `GET /dashboard/stats`
*   **Header:** `Authorization: Bearer <token>`
*   **Response:**
    ```json
    {
      "totalInvitations": 5,
      "totalGuests": 150,
      "totalMessages": 45,
      "recentActivities": [...]
    }
    ```

---

## 🎨 Master Data (Public)
### 1. Master Categories
*   **Endpoint:** `GET /categories`
### 2. Master Sections (Fitur)
*   **Endpoint:** `GET /sections` (Hanya yang aktif)

---

## 💬 Guest Messages
Base Path: `/guest-messages`

### 1. Create Message
*   **Endpoint:** `POST /guest-messages`
*   **Body:**
    ```json
    {
      "invitationId": 1,
      "guestName": "Budi",
      "message": "Selamat ya!",
      "rsvpStatus": "hadir",
      "totalGuest": 2
    }
    ```

---

## 💳 Payment & Promo
### 1. Validate Promo
*   **Endpoint:** `POST /promo/validate`
*   **Body:** `{ "code": "DISKON50", "invitation_id": 1 }`

### 2. Create Payment Transaction
*   **Endpoint:** `POST /payment/create`
*   **Body:** `{ "invitation_id": 1, "promo_code": "OPTIONAL" }`
*   **Response:** Midtrans Snap URL & Token.

---

## 🛡️ Admin Panel (Admin Only)
Base Path: `/admin`
Header Wajib: `Authorization: Bearer <ADMIN_TOKEN>`

### 👥 Users Management
*   `GET /admin/users` - List Users (Search & Pagination)
*   `POST /admin/users` - Create Admin/User
*   `PATCH /admin/users/:id` - Update User/Admin
*   `DELETE /admin/users/:id` - Delete User

### 📝 Templates Management
*   `GET /admin/template-designs` - List Templates
*   `POST /admin/template-designs`
    ```json
    {
      "name": "Botanical",
      "slug": "botanical-watercolor",
      "category": "Romantic",
      "price": 50000,
      "previewUrl": "...",
      "thumbnailUrl": "...",
      "isPremium": true,
      "isActive": true,
      "sections": [{ "sectionId": "UUID", "order": 1, "is_enabled": true }]
    }
    ```

### ⚙️ Master Sections (Fitur)
*   `GET /admin/sections?q=search`
*   `POST /admin/sections` - `{ "label": "Text", "key": "keyName", "is_active": true }`
*   `PATCH /admin/sections/:id`
*   `DELETE /admin/sections/:id`

### 🎵 Audio & 🏦 Banks
*   `GET /admin/audio` / `POST /admin/audio`
*   `GET /admin/banks` / `POST /admin/banks`

### 🎟️ Promo Codes
*   `GET /admin/promo-codes`
*   `POST /admin/promo-codes`
    ```json
    {
      "code": "PROMO10",
      "discount_type": "percentage",
      "discount_value": 10,
      "max_uses": 100,
      "is_active": true
    }
    ```

---

## 📁 File Upload
*   **Endpoint:** `POST /upload` (Multipart Form Data)
*   **Key:** `file`
*   **Response:** `{ "fileUrl": "..." }`
