# Silver Crown iOS (SwiftUI)

Native SwiftUI client for Silver Crown PTI — driver + admin parity, Maintenance Log, and light/dark Settings.

## Requirements

- macOS with Xcode 16+
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`)
- Firebase iOS app registered with bundle id `com.trucking.silvercrown-`
- `GoogleService-Info.plist` in `SilverCrown/` (copied from repo root)

## Generate & run

```bash
cd apps/ios
xcodegen generate
open SilverCrown.xcodeproj
```

Select the **SilverCrown** scheme, pick an iPhone or iPad simulator, and Run.

Or from the repo root after generating:

```bash
pnpm ios
```

## Features

- Auth (email/password + invite code signup)
- Driver: load board, PTI wizard, maintenance log, profile/settings
- Admin: company loads (+ create), company PTIs, maintenance log, profile/settings
- Adaptive phone (`TabView`) vs iPad (`NavigationSplitView`) shells
- Appearance: System / Light / Dark in Settings

## Backend

Uses the same Firebase project as web/Expo. Deploy updated Firestore rules and indexes for `maintenanceLogs` before relying on Maintenance Log in production:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```
