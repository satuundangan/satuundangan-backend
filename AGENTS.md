# SatuUndangan Engineering Team Rules & Architecture Guide

Welcome to the SatuUndangan codebase! This repository contains both the frontend (Vue 3 + Vite + Tailwind CSS) and backend (NestJS + TypeScript + TypeORM + MySQL).

---

## 👥 Engineering Team Roles (Subagents)

When tackling tasks, you can delegate or assume the following specialized roles:
- **`frontend_engineer`**: Specialist in Vue 3 (Composition API, `<script setup>`), Tailwind CSS, Studio Editor, live preview sync, and invitation templates.
- **`backend_engineer`**: Specialist in NestJS, TypeORM, MySQL, Midtrans payment gateway, Auth (Google OAuth, Turnstile, TOTP), and access tokens.
- **`seo_strategist`**: Specialist in programmatic SEO, JSON-LD Schema markup, Indonesian wedding keyword clusters, dynamic OpenGraph, and Article CMS.
- **`qa_tester`**: Specialist in Vitest, Jest, Playwright, Puppeteer, user journey verification, and build regression testing.

---

## 🛠️ Tech Stack & Structure

```text
D:\Projects\Satu Undangan\
├── satuundangan-frontend/       # Vue 3 + Vite + Tailwind CSS + PrimeIcons / FontAwesome
│   ├── src/
│   │   ├── api/                 # Axios / API fetchers
│   │   ├── components/          # Reusable UI & modal components
│   │   ├── templates/           # Invitation templates & dynamic-theme.vue
│   │   ├── views/               # Pages (Home, StudioView, GuestsView, Blog, etc.)
│   │   └── utils/               # themeConfig, templateRegistry, seoRoutes
│   └── functions/               # Cloudflare Pages Functions (sitemap, _middleware)
└── satuundangan-backend/        # NestJS + TypeScript + TypeORM + MySQL
    ├── src/
    │   ├── invitation/          # Core invitation entity & access controllers
    │   ├── dashboard-user/guest # Guest list & private access tokens
    │   ├── payment/             # Midtrans Snap & webhook handlers
    │   ├── article/             # Blog & SEO CMS module
    │   └── sitemap/             # Automated XML sitemap generator
```

---

## ⚠️ Important Rules for Developers & Agents

1. **PowerShell Syntax**: Always chain commands using `;` (semicolon). **NEVER** use `&&` in Windows PowerShell.
2. **Template Architecture (`src/templates/*.vue`)**:
   - Every template uses `<script setup>` and MUST explicitly declare:
     ```javascript
     const props = defineProps({
       data: { type: Object, default: () => ({}) }
     })
     ```
   - Vue 3 does NOT auto-declare `props` variable in `<script setup>`.
3. **Build Integrity**:
   - Always run `npm run build` in `satuundangan-frontend` to verify no compile errors.
   - A chunk-size warning for `index-*.js` (>500kB) is expected.
4. **Git Workflow**:
   - Main development branch is `development`.
   - Use clean, conventional commit messages: `feat:`, `fix:`, `refactor:`, `chore:`.
   - Pull both FE and BE before starting new feature development.
