# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**undangan-online-backend** is a NestJS REST API for a wedding invitation management platform (satuundangan.id). It handles invitation creation, payment processing via Midtrans, guest management, file uploads to Cloudflare R2, and admin master data.

## Commands

```bash
# Development
npm run start:dev       # Watch mode on port 3000
npm run start:debug     # With debugger attached

# Build & Production
npm run build
npm run start:prod      # Runs dist/main

# Testing
npm test                # Run unit tests
npm run test:watch      # Watch mode
npm run test:cov        # With coverage
npm run test:e2e        # E2E tests

# Code Quality
npm run lint            # ESLint with auto-fix
```

To run a single test file: `npx jest src/path/to/file.spec.ts`

## Architecture

### Module Structure

Each feature follows standard NestJS pattern: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.entity.ts`, `dto/`. Modules are registered in `src/app.module.ts`.

```
src/
├── auth/               # JWT + Google OAuth authentication
├── user/               # User profile management
├── invitation/         # Core invitation CRUD & publishing logic
├── template-design/    # Templates with sections & palette relations
├── category/           # Template categories
├── admin/              # Admin-only endpoints + master data entities
│   └── entities/       # section, audio, bank, palette-color
├── payment/            # Midtrans integration & webhooks
├── dashboard/          # Analytics stats & activity log
├── dashboard-user/guest/ # Guest management
├── guest-messages/     # RSVP & guest messages
├── modules/upload/     # Cloudflare R2 file uploads
└── common/decorators/  # @CurrentUser() decorator
```

### Authentication & Guards

- **JwtAuthGuard** — validates Bearer token, populates `req.user = { id, email }`
- **AdminGuard** — checks `user.isAdmin` in DB; must be used together with JwtAuthGuard
- **@CurrentUser()** — decorator to extract `req.user` in controllers
- Google OAuth via Passport; auto-creates user on first login and redirects to frontend with JWT

### Database

- **MySQL** via TypeORM with `synchronize: true` (no migrations — schema auto-syncs from entities)
- Entities use auto-discovery: `entities: [__dirname + '/**/*.entity.{js,ts}']`
- Master data tables are prefixed: `master_sections`, `master_audio`, `master_banks`, `master_palette_colors`
- Most master data entities use UUID PKs; user-facing entities use auto-increment integers

### Payment Flow

1. `POST /payment/create/:invitationId` — creates Midtrans Snap transaction; free templates auto-publish
2. Midtrans sends webhook to `POST /payment/notification` — verifies signature, updates status, publishes invitation on success
3. `POST /payment/simulate/:invitationId` — dev-only endpoint to test flow

### File Uploads

Single endpoint `POST /upload` (protected) — uploads to Cloudflare R2 (S3-compatible) and returns CDN URL via `R2_PUBLIC_URL`.

### Admin Endpoints

All `/admin/**` routes require both `JwtAuthGuard` and `AdminGuard`. Pagination uses `PaginationQueryDto` with `page`, `limit`, `q` (search) params.

### Key Conventions

- DTOs use `class-validator` decorators; Update DTOs extend `PartialType(CreateDto)`
- Global validation pipe: `whitelist: true`, `transform: true`
- Swagger docs at `/api-docs`; use `@ApiProperty()` on DTO fields
- CORS allows `localhost:5173`, `localhost:5174` (dev) and `satuundangan.id` domains (prod)

## Environment Variables

Required in `.env`:

```
DB_HOST, DB_NAME, DB_USERNAME, DB_PASSWORD, DB_PORT
JWT_SECRET
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL
MERCHANT_ID, SERVER_KEY, CLIENT_KEY          # Midtrans
R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_PUBLIC_URL, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
FRONTEND_URL, FRONTEND_URL_DEVELOPMENT, FRONTEND_URL_PRODUCTION
NODE_ENV
```
