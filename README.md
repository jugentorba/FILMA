# FILMA

FILMA is a cross-platform movie, series, YouTube and Live TV app built with Expo + React Native TV. The same codebase targets Android phones/tablets, Android TV, iPhone/iPad and Apple TV.

## Current release

- App version: **0.1.3**
- iOS build: **4**
- Android versionCode: **4**
- Bundle/package id: `com.jugentorba.filma`

## Core features

- Movies-first home experience with TV-aware navigation.
- Phone / TV Mode switch for testing TV features on an Android phone; native TV devices always stay in TV mode.
- Permanent **Cinemeta** movie/series catalog and metadata anchor.
- Stremio-compatible user sources plus official automatic source discovery.
- Custom movie sources are validated before saving and must expose a movie/series `stream` resource.
- Automatic stream ranking and player-level failover when a direct stream fails, plus manual **Next source** switching.
- Default playback language priority: **French → Albanian → English**. Manual audio preferences override that order.
- Series/episode selection with artwork, progress and resume-aware continuation.
- Continue Watching and favorites.
- Dropbox synchronization of progress, favorites, preferences and configured sources across devices.
- Live TV via legal/public or user-authorized M3U/M3U8 playlists, with channel logos, search, groups and backup-source failover.
- Automatic public IPTV-org language playlists, with independent source health/fallback.
- YouTube catalog/search and native in-FILMA Android phone/Android TV playback.
- RTSH Albanian archive movies surfaced through the official YouTube path.
- English, French and Albanian UI.

## Content-source policy

FILMA is designed for sources the user is authorized to use. The built-in discovery path is limited to official/public sources such as Cinemeta, the official Stremio add-on index, IPTV-org public playlists and official YouTube content. User-configured Stremio manifests and M3U/M3U8 URLs are supported.

The project does not include scraping, anti-bot bypasses, token extraction or automatic harvesting of unauthorized copyrighted streams.

## Sync

Dropbox uses an App Folder and OAuth authorization-code + PKCE flow. No FILMA backend server is required. Once connected, FILMA automatically syncs local changes, periodically pulls remote changes and safely merges per-item timestamps so playback can continue on another device.

## Development

```bash
yarn install --frozen-lockfile
yarn typecheck
yarn start
```

Mobile native builds:

```bash
yarn android
yarn ios
```

TV native builds:

```bash
yarn android:tv
yarn ios:tv
```

Prebuild only:

```bash
yarn prebuild
EXPO_TV=1 yarn prebuild:tv
```

## Continuous integration

`FILMA CI` verifies:

- TypeScript
- state migration/conflict tests
- source/language-priority and custom-source validation tests
- M3U parsing/merge tests
- Expo config
- Expo Doctor
- Android mobile prebuild
- Android TV prebuild
- iPhone/iPad prebuild
- Apple TV prebuild

## Build artifacts

### Android

`.github/workflows/build-android.yml` produces:

- `FILMA-mobile-APK`
- `FILMA-Android-TV-APK`

Both release APKs are zip-aligned, signed with FILMA's persistent test-build key, verified with Android `apksigner`, and uploaded with SHA-256 checksum files. A permanent distribution keystore should replace the test-build key before store/public release signing.

### Apple unsigned/simulator

`.github/workflows/build-apple.yml` produces:

- `FILMA-iOS-Simulator`
- `FILMA-iOS-Unsigned-IPA`
- `FILMA-Apple-TV-Simulator`
- `FILMA-Apple-TV-Unsigned-IPA`

The unsigned iPhone/iPad and Apple TV IPAs are compiled for real devices but still require Apple signing before installation.

### Apple signed device builds

`.github/workflows/build-apple-signed.yml` can produce real signed artifacts when Apple Developer signing material is stored as GitHub repository secrets. If signing secrets are absent, the workflow exits successfully without publishing a fake signed artifact.

Expected signing secrets:

- `APPLE_CERTIFICATE_P12_BASE64`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_TEAM_ID`
- `IOS_PROVISIONING_PROFILE_BASE64`
- `TVOS_PROVISIONING_PROFILE_BASE64` (only needed for signed Apple TV builds)
- `APPLE_EXPORT_METHOD` (optional; defaults to `development`)

Other build credential:

- `YOUTUBE_API_KEY` for YouTube Data API catalog/search functionality.

## Platform status

| Platform | Native generation | Build workflow | Device artifact |
| --- | --- | --- | --- |
| Android phone/tablet | Yes | Yes | Signed test APK |
| Android TV | Yes | Yes | Signed test APK |
| iPhone/iPad | Yes | Yes | Unsigned IPA; signed IPA when Apple secrets are configured |
| Apple TV | Yes | Yes | Unsigned device IPA + simulator; signed IPA when Apple secrets are configured |

`main` is the authoritative branch. Older experimental feature branches may remain for history but should not be merged blindly into current `main`.
