# Silver Crown iOS (SwiftUI)

Native SwiftUI client for Silver Crown PTI — driver + admin parity, Maintenance Log, and light/dark Settings.

## Requirements

- macOS with Xcode 16+
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`)
- Firebase iOS app registered with bundle id `com.trucking.silvercrown-`
- `GoogleService-Info.plist` in `SilverCrown/` (copied from repo root)

## Generate & run

`SilverCrown.xcodeproj` is **committed** so Xcode Cloud / TestFlight can find it.
Regenerate locally after changing `project.yml`:

```bash
cd apps/ios
xcodegen generate
open SilverCrown.xcodeproj
```

Select the **SilverCrown** scheme, pick an iPhone or iPad simulator, and Run.

Or from the repo root:

```bash
pnpm ios
```

After regenerating, commit any `project.pbxproj` / `Package.resolved` changes before pushing a TestFlight build.

## TestFlight / “Preparing build for App Store Connect failed”

Xcode Cloud often shows that one-liner with almost no detail. Check in this order:

1. **Email** to the Apple Developer account — ASC usually sends `ITMS-…` validation errors there.
2. **App Store Connect → Xcode Cloud → your build → See all logs** (expand Archive / Post-Actions).
3. **Reproduce locally for a real message:**
   ```bash
   cd apps/ios
   xcodebuild -scheme SilverCrown -destination 'generic/platform=iOS' \
     -configuration Release archive -archivePath /tmp/SilverCrown.xcarchive
   ```
   Then in Xcode: **Organizer → Archives → Distribute App → App Store Connect** and read the validation error.
4. Common silent failures we already guard against:
   - App icon with alpha (must be opaque RGB 1024×1024)
   - Build number already used on TestFlight (bump `CURRENT_PROJECT_VERSION` / Xcode Cloud run number)
   - Missing export compliance (`ITSAppUsesNonExemptEncryption = NO`)

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
