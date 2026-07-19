# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

## Cursor Cloud specific instructions

pnpm monorepo (Silver Crown PTI). Services: `apps/web` (Vite admin, port 5173), `apps/mobile` (Expo 56 / Metro, port 8081), `packages/shared` (Firebase logic), `firebase/functions` (Cloud Functions) + Firebase emulators. Standard commands live in `README.md` and `package.json` scripts; the notes below are only the non-obvious caveats.

### Environment (`.env` is git-ignored — recreate it if missing)
Local dev runs against Firebase emulators and needs a repo-root `.env`. Without `*_USE_FIREBASE_EMULATORS=true` the apps throw "Missing Firebase config". Use these emulator values (projectId must match `firebase/seed.ts`, which hardcodes `silver-crown-pti` — NOT the `silver-crown-app` default in `.firebaserc`):

```
EXPO_PUBLIC_FIREBASE_PROJECT_ID=silver-crown-pti
VITE_FIREBASE_PROJECT_ID=silver-crown-pti
USE_FIREBASE_EMULATORS=true
VITE_USE_FIREBASE_EMULATORS=true
```
(API key etc. can be any dummy value in emulator mode.)

### Running services
- Emulators: start with the matching project and skip storage — `npx firebase emulators:start --only auth,firestore,functions --project silver-crown-pti`. The storage emulator fails with "Must supply 'target' in Storage configuration" because `firebase.json` uses the multi-bucket array form (needs deploy targets); omit it for local dev. `pnpm emulators` also assumes `firebase/emulator-data` exists for `--import`; on a clean checkout start without `--import`.
- Web admin: `pnpm dev:web` → http://localhost:5173 (login `admin@silvercrown.com` / `password123` after seeding).
- Mobile: `pnpm dev:mobile` (Metro on 8081). Full app run needs a device/simulator/Expo Go (not available headless); `curl` the manifest bundle URL (`/apps/mobile/index.bundle?platform=android`) to validate the JS graph compiles.

### Seeding (important gotcha)
`pnpm seed` uses the client SDK and is BLOCKED by `firestore.rules` (companies/users writes are `if false`) — it will fail with PERMISSION_DENIED. Seed via the Admin SDK against the emulators instead (bypasses rules, no real credentials needed):

```
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 pnpm seed:production
```

### Tests / lint
Run Jest from the repo root (`npx jest` / `pnpm test`) — the root `jest.config.js` supplies the ts-jest preset; running from a subdir fails to parse TS. `pnpm lint` (`pnpm -r lint`) errors because `apps/mobile` has no `lint` script; lint per package instead (`pnpm --filter @silver-crown/web lint`, `pnpm --filter @silver-crown/shared lint`, both `tsc --noEmit`). `firebase/functions` is a plain npm project outside the pnpm workspace — install its deps with `npm install --prefix firebase/functions` and build with `npm run build --prefix firebase/functions`.
