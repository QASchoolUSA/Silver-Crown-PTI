# Silver Crown PTI

Full-stack trucking Pre-Trip Inspection (PTI) platform with a mobile driver app and web admin dashboard, powered by Firebase.

## Architecture

```
apps/mobile/     Expo 56 React Native driver/admin mobile app
apps/web/        Vite + React admin dashboard
packages/shared/ Firebase services, types, theme, PTI constants
firebase/        Security rules, Cloud Functions, seed script
```

## Prerequisites

- Node.js 20+
- pnpm 9+
- Firebase CLI (`npm i -g firebase-tools`)

## Firebase Configuration

All Firebase credentials live in the **repo root** [`.env`](.env):

- `EXPO_PUBLIC_*` — used by the mobile app via [`apps/mobile/app.config.js`](apps/mobile/app.config.js)
- `VITE_*` — used by the web admin (Vite `envDir` points to repo root)
- `USE_FIREBASE_EMULATORS` — set to `true` only for local emulator development

For **iOS native builds**, place [`GoogleService-Info.plist`](GoogleService-Info.plist) in the repo root. It is referenced from [`apps/mobile/app.config.js`](apps/mobile/app.config.js) as `ios.googleServicesFile`.

Copy [`.env.example`](.env.example) to `.env` and fill in values from Firebase Console → Project settings.

## Quick Start (Local with Emulators)

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Build Cloud Functions**
   ```bash
   cd firebase/functions && npm install && npm run build && cd ../..
   ```

3. **Start Firebase emulators** (in one terminal; set `USE_FIREBASE_EMULATORS=true` in `.env` first)
   ```bash
   pnpm emulators
   ```

4. **Seed demo data** (in another terminal, after emulators are running)
   ```bash
   pnpm seed
   ```

5. **Start mobile app**
   ```bash
   pnpm dev:mobile
   ```

6. **Start web admin**
   ```bash
   pnpm dev:web
   ```

## Demo Accounts (after seeding)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@silvercrown.com | password123 |
| Driver | driver1@silvercrown.com | password123 |
| Driver | driver2@silvercrown.com | password123 |

**Invite codes:** `ADMIN001` (admin), `DRIVER01` (driver)

## Firebase Production Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication** (Email/Password)
3. Create **Firestore** database
4. Enable **Storage** in Firebase Console
5. Deploy rules and functions:
   ```bash
   firebase deploy --only firestore:rules,storage,functions
   ```
6. Copy your Firebase config to `.env` (see `.env.example`)
7. Set `USE_FIREBASE_EMULATORS=false` and `VITE_USE_FIREBASE_EMULATORS=false`
8. **Seed demo users** (requires Admin credentials — `firebase login` alone is not enough):
   ```bash
   # Download service account key from Firebase Console → Project settings → Service accounts
   # Save as firebase/service-account.json, then:
   pnpm seed:production
   ```
   Or use Google Cloud CLI: `gcloud auth application-default login` then `pnpm seed:production`

## Features

### Mobile (Driver)
- Login / Sign up with company invite code
- Load board — view loads assigned to you
- PTI wizard — 10-step inspection with photos and signature
- Inspection history with PDF export

### Mobile (Admin)
- View all company loads with driver filter
- View all inspections with driver/truck filters

### Web Admin Dashboard
- Dashboard with stats
- Load management — create, assign drivers, search/filter
- Inspection viewer with filters and PDF download
- Driver list
- Invite code generation (driver/admin roles)

## Testing

```bash
pnpm test
```

Run tests against emulators:
```bash
pnpm emulators:exec "pnpm test"
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev:mobile` | Start Expo mobile app |
| `pnpm dev:web` | Start Vite web admin |
| `pnpm test` | Run Jest unit tests |
| `pnpm emulators` | Start Firebase emulators |
| `pnpm seed` | Seed demo data into emulators |
