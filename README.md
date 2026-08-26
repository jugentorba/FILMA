# FILMA

FILMA is a cross-platform movie, series, YouTube and Live TV app built with Expo + React Native TV. The same codebase targets Android phones/tablets, Android TV, iPhone/iPad and Apple TV.

## Current release

- App version: **0.1.6**
- iOS build: **7**
- Android versionCode: **7**
- Bundle/package id: `com.jugentorba.filma`

## Core features

- Movies-first home experience with TV-aware navigation.
- Phone / TV Mode switch for testing TV features on an Android phone; native TV devices always stay in TV mode.
- Permanent **Cinemeta** movie/series catalog and metadata anchor.
- Built-in **FILMA Free** catalogue with direct playable public Internet Archive feature films.
- Automatic official movie/series provider discovery at startup, with a forced fresh provider pass before FILMA declares a title unavailable.
- Movie and episode availability is checked automatically; a playback miss offers **Search again** first. Manual source management is optional.
- Stremio-compatible user sources can supplement automatic discovery and may provide catalogue, metadata, streams, or a combination of those capabilities.
- Automatic stream ranking by preferred audio language and player-level failover when a direct stream fails, plus manual **Next source** switching.
- Default playback language priority: **French → Albanian → English**. Manual audio preferences override that order.
- Movies/series discovery includes Popular, New and Featured rows, cached catalogue/metadata requests, cross-provider deduplication, and combined search.
- Series/episode selection with artwork, automatic episode source resolution, progress and resume-aware continuation.
- Profile-scoped Continue Watching, favorites and playback progress.
- Dropbox synchronization of profiles, progress, favorites, preferences and configured sources across devices.
- Live TV via legal/public or user-authorized M3U/M3U8 playlists, local M3U/M3U8 file import and Xtream Codes, with channel logos, search, groups and backup-source failover.
- Automatic public IPTV-org language playlists, with independent source health/fallback.
- YouTube catalog/search and native in-FILMA Android phone/Android TV playback.
- Expanded RTSH Albanian archive movies surfaced through official YouTube playlists/search fallback.
- Responsive Compact / Comfortable layouts for phone, tablet and TV.
- English, French and Albanian UI.

## Content-source policy

FILMA is designed for sources the user is authorized to use. The built-in discovery path is limited to official/public sources such as Cinemeta, the official Stremio add-on index, Internet Archive public content, IPTV-org public playlists and official YouTube content. User-configured Stremio manifests, M3U/M3U8 URLs/files and authorized Xtream providers are supported.

The project does not include scraping, anti-bot bypasses, token extraction or automatic harvesting of unauthorized copyrighted streams.

## Sync

Dropbox uses an App Folder and OAuth authorization-code + PKCE flow. No FILMA backend server is required. Once connected, FILMA automatically syncs local changes, periodically pulls remote changes and safely merges per-item timestamps so playback can continue on another device. Local playlist files and Xtream passwords stay device-local.

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
- source/language-priority, media-discovery and custom-source validation tests
- built-in playable movie-provider regression tests
- release-version alignment
- M3U parsing/merge and local-playlist tests
- YouTube source tests
- Expo config
- Expo Doctor
- Android mobile prebuild + native Kotlin compilation
- Android TV prebuild + native Kotlin compilation
- iPhone/iPad prebuild
- Apple TV prebuild

## Build artifacts

### Android

`.github/workflows/build-android.yml` produces:

- `FILMA-mobile-APK`
- `FILMA-Android-TV-APK`

Both release APKs are zip-aligned, signed, verified with Android `apksigner`, and uploaded with SHA-256 checksum files. With no Android signing secrets configured, the workflow uses FILMA's persisted test-build key so the APKs remain installable at no extra cost.

For a permanent distribution identity, add these repository secrets; the workflow automatically prefers them over the fallback key:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

The same permanent keystore must be retained for future Android updates distributed under the same package id.

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
