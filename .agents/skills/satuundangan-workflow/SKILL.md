---
name: satuundangan-workflow
description: >-
  Standard development, testing, build, and Git workflow procedures for SatuUndangan.
  Use this skill whenever building, running migrations, verifying code changes, or committing code.
---

# SatuUndangan Development & Workflow Guide

## 🚀 Daily Routine

### 1. Synchronizing with Remote
Always pull both repositories before starting work:
```powershell
# Frontend
cd "d:/Projects/Satu Undangan/satuundangan-frontend"; git pull origin development

# Backend
cd "d:/Projects/Satu Undangan/satuundangan-backend"; git pull origin development
```

### 2. Frontend Development & Build Verification
```powershell
# Dev Server
npm run dev

# Production Build Check (always run before committing)
npm run build
```

### 3. Backend Verification
```powershell
# Dev Server
npm run start:dev

# Unit Tests
npm run test

# E2E Tests
npm run test:e2e
```

### 4. Git Commits & Push
Follow Conventional Commits:
- `feat(studio): add auto crop ratio presets`
- `fix(invitation): fix private access token redirect`
- `refactor(template): optimize dynamic-theme observers`
- `chore: update dependencies`
