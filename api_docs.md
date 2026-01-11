# API Documentation

## Base URL
The API is served at the root URL.

## Authentication
Routes protected by `JwtAuthGuard` require a Bearer Token in the `Authorization` header.
Example: `Authorization: Bearer <token>`

---

## Public Endpoints (Landing Page)

### Categories
**Base Path:** `/categories`

- `GET /categories`
  - **Description:** List all categories.
  - **Response:**
    ```json
    [
      { "id": "uuid", "name": "Minimalis", "color": "#ffffff" }
    ]
    ```

- `GET /categories/:id`
  - **Description:** Get category by ID.

### Sections
**Base Path:** `/sections`

- `GET /sections`
  - **Description:** List all master sections.
  - **Response:**
    ```json
    [
      { "id": "uuid", "label": "Akad Nikah", "key": "akad", "is_active": true }
    ]
    ```

### Template Designs
**Base Path:** `/template-design`

- `GET /template-design`
  - **Query Params:** `category` (slug, optional).
  - **Response:**
    ```json
    [
      {
        "id": 1,
        "name": "Elegant White",
        "slug": "elegant-white",
        "previewUrl": "http...",
        "thumbnailUrl": "http...",
        "isPremium": false,
        "price": 0
      }
    ]
    ```

- `GET /template-design/:id`
  - **Description:** Get template design by ID.

---

## Admin & Management
Protected by `JwtAuthGuard` and `AdminGuard`.

### Users
**Base Path:** `/admin/users`
- `GET /admin/users` - List users. Query params: `page`, `limit`, `q`.
- `GET /admin/users/:id` - Get user details.
- `POST /admin/users` - Create a new user.
- `PATCH /admin/users/:id` - Update a user.
- `DELETE /admin/users/:id` - Delete a user.

### Invitations (Admin view)
**Base Path:** `/admin/invitations`
- `GET /admin/invitations` - List all invitations.
- `GET /admin/invitations/:id` - Get invitation details.
- `PATCH /admin/invitations/:id` - Update invitation.
- `DELETE /admin/invitations/:id` - Delete invitation.

### Categories Management
**Base Path:** `/admin/categories`
- `GET /admin/categories` - List all categories.
- `POST /admin/categories` - Create category.
- `PATCH /admin/categories/:id` - Update category.
- `DELETE /admin/categories/:id` - Remove category.

### Template Designs Management
**Base Path:** `/template-design`
- `POST /template-design` - Create template.
- `PATCH /template-design/:id` - Update template.
- `DELETE /template-design/:id` - Remove template.

---

## Auth
**Base Path:** `/auth`

- `GET /auth/me`
  - **Guard:** `JwtAuthGuard`.
  - **Response:** `{ "id": 1, "name": "User", "email": "user@mail.com", ... }`

- `POST /auth/register`
  - **Body:** `{ "name": "User", "email": "user@mail.com", "password": "password" }`

- `POST /auth/login`
  - **Body:** `{ "email": "user@mail.com", "password": "password" }`
  - **Response:** `{ "access_token": "jwt_token..." }`

- `GET /auth/google` - Initiate Google OAuth.
- `GET /auth/google/redirect` - Google OAuth callback.

---

## User Dashboard
**Base Path:** `/dashboard`
**Guards:** `JwtAuthGuard`

- `GET /dashboard/stats`
  - **Description:** Get user dashboard statistics.
  - **Response:**
    ```json
    {
      "total_invitations": 5,
      "active_invitations": 1,
      "total_responses": 150,
      "rsvp_breakdown": {
        "attending": 120,
        "not_attending": 10,
        "pending": 20
      },
      "total_views": 1540
    }
    ```

- `GET /dashboard/activity`
  - **Description:** Get recent activity logs (views, RSVPs, wishes).
  - **Response:**
    ```json
    [
      {
        "id": 1,
        "invitation_title": "Romeo & Juliet",
        "guest_name": "Budi Santoso", // or null for anonymous
        "action": "viewed_invitation", // 'viewed_invitation', 'sent_rsvp', 'sent_wishes'
        "created_at": "2026-01-10T10:00:00.000Z"
      }
    ]
    ```

---

## User Profile
**Base Path:** `/user`
**Guards:** `JwtAuthGuard`

- `GET /user/me` - Get profile.
- `PATCH /user` - Update profile.

---

## User Invitations
**Base Path:** `/invitation`
**Guards:** `JwtAuthGuard` (except public routes)

- `POST /invitation`
  - **Description:** Create a new invitation.
  - **Restriction:** `isCustomMusic: true` requires `templateDesignId` linked to a Premium template.
  - **Body:**
    ```json
    {
      "title": "Undangan Pernikahan",
      "slug": "romeo-juliet", // Optional
      "coupleName": "Romeo & Juliet",
      "groomName": "Romeo",
      "brideName": "Juliet",
      "templateDesignId": 1,
      "isPublished": true,
      "quoteSource": "bebas",
      "quoteText": "Love is in the air",
      "musicChoice": "default.mp3",
      "isCustomMusic": false,
      "bridePhotoUrl": "http://...",
      "whatsappMessageTemplate": "Halo [GuestName], mohon kehadirannya di: [Link]",
      "loveStory": [
        { "title": "First Meet", "content": "...", "date": "2020-01-01" }
      ],
      "akadLocation": {
        "mapUrl": "http...",
        "description": "Masjid...",
        "dateTime": "2026-02-01T08:00:00.000Z"
      },
      "resepsiLocation": {
        "mapUrl": "http...",
        "description": "Hotel...",
        "dateTime": "2026-02-01T11:00:00.000Z"
      },
      "menu": { "title": "Buffet", "items": ["Nasi Goreng", "Sate"] },
      "galleryImages": ["url1", "url2"],
      "socialMedia": { "instagram": "..." },
      "parents": { "brideParents": "...", "groomParents": "..." },
      "enableGuestMessage": true
    }
    ```

- `GET /invitation` - List my invitations.
- `GET /invitation/:id` - Get my invitation details.
- `PATCH /invitation/:id` - Update invitation (Body same as POST, partial).
- `DELETE /invitation/:id` - Delete invitation.

- `GET /invitation/slug/:slug`
  - **Access:** **PUBLIC**
  - **Behavior:** Auto-increments `views` and logs 'viewed_invitation' activity.
  - **Response:**
    ```json
    {
      "id": 1,
      "title": "Undangan Romeo",
      "slug": "romeo-juliet",
      "template_slug": "elegant-white",
      "content": { ... }, // Full invitation details
      "is_premium": false,
      "is_active": true
    }
    ```

- `GET /invitation/slug/:invitationSlug/guest/:guestSlug`
  - **Access:** **PUBLIC**
  - **Behavior:** Logs 'viewed_invitation' activity for the specific guest.
  - **Response:** `{ "invitation": {...}, "guest": {...} }`

---

## Guests
**Base Path:** `/guests`

- `POST /guests`
  - **Body:** `{ "name": "Budi", "invitationId": 1, "phoneNumber": "0812..." }`
  - **Response:** Guest object.

- `GET /guests/invitation/:invitationId`
  - **Description:** List guests for an invitation.

- `POST /guests/import`
  - **Body:** Multipart form `file` (Excel).

- `GET /guests/:id/share`
  - **Description:** Get WhatsApp share link using the custom template.
  - **Response:**
    ```json
    {
      "url": "https://satuundangan.id/inv/slug/guest-slug",
      "waLink": "https://wa.me/6281...?text=Halo%20Budi...",
      "message": "Halo Budi, mohon kehadirannya di: https://..."
    }
    ```

- `POST /guests/:id/check-in`
  - **Guard:** `JwtAuthGuard` (Only invitation owner/admin).
  - **Description:** Mark guest as present (e.g. via QR Scan).
  - **Response:**
    ```json
    {
      "success": true,
      "message": "Tamu Budi berhasil Check-in",
      "check_in_time": "2026-01-10T12:00:00.000Z"
    }
    ```

---

## Guest Messages
**Base Path:** `/guest-messages`

- `POST /guest-messages`
  - **Access:** **PUBLIC**
  - **Body:**
    ```json
    {
      "invitationId": 1,
      "guestName": "Budi",
      "message": "Selamat ya!",
      "rsvpStatus": "hadir", // 'hadir', 'tidak_hadir', 'pending'
      "totalGuests": 2,
      "guestId": 123 // Optional, link to Guest entity
    }
    ```
  - **Response:** `{ "success": true, "data": { ... } }`

- `GET /guest-messages/invitation/:invitationId` - Get messages list.

---

## Payment
**Base Path:** `/payment`

- `POST /payment/create`
  - **Body:** `{ "invitation_id": 1 }`
  - **Response:** `{ "token": "...", "redirect_url": "...", "order_id": "..." }`

- `POST /payment/notification` - Midtrans Webhook.

---

## Upload
**Base Path:** `/upload`

- `POST /upload`
  - **Body:** Multipart form `file`.
  - **Response:** `{ "url": "..." }`
