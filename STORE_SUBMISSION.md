# Chrome Web Store submission notes

Use `release/rtv-shadap-vX.Y.Z-webstore.zip` for Chrome Web Store upload. Its `manifest.json` is at the zip root.

## Version 0.3.2 update notes

```text
Improved cross-device setup reliability by preserving the published Chrome Web Store extension ID in development and manual packages. This prevents copies loaded from different local folders from receiving different sync identities. No permissions, synchronized data, or collection behavior changed. Brave users must enable the Extensions data type in Brave Sync on every participating device.
```

## Version 0.3.1 update notes

```text
Fixed an issue where a page-local control inside an opened RTV SLO article could cause the article body to be dimmed. Seen styling now remains limited to news and media cards, including category, related, and sidebar lists; opened article content always stays fully readable. Also fixed repeated page rescans on pages containing live-story markers and coalesced rapid dynamic updates to reduce unnecessary CPU and memory pressure.
```

## Version 0.3.0 update notes

```text
RTV Shadap can now synchronize manually marked stories across devices through the browser's built-in sync. Sync is optional, requires no RTV Shadap account or OAuth, and transfers only compact article IDs and day-level timestamps. Full article history remains local. A new Options page lets users switch between browser sync and local-only mode.
```

## Listing

Name:

```text
RTV Shadap
```

Short description:

```text
Manually dim RTV SLO stories and optionally sync their read state across your devices.
```

Detailed description:

```text
RTV Shadap makes RTV SLO news pages easier to scan.

Press the popup button to dim all stories currently shown on an RTV SLO page. The extension remembers those stories, so the same articles stay dimmed when they appear on the homepage, category pages, or elsewhere on RTV SLO. Nothing is marked automatically when you load, close, or leave a page. Live stories remain visually prominent, and selected promotional sections are hidden on the homepage.

Optional device sync uses the browser's built-in sync service and requires no RTV Shadap account or OAuth. Full history stays local. Only compact article IDs and day-level timestamps are placed in browser sync after the user explicitly opts in. The extension has no developer-operated server, analytics, tracking, ads, or telemetry.

RTV Shadap is an independent browser extension and is not affiliated with RTV SLO.
```

Category:

```text
Productivity
```

Language:

```text
English
```

Visibility recommendation:

```text
Unlisted first, public later if desired.
```

## Single purpose

```text
RTV Shadap lets users manually dim stories on RTV SLO, recognize them across the site, and optionally synchronize that read state through browser-native device sync.
```

## Permission justification

`storage`:

```text
Used to store full manual article history locally and, only after explicit opt-in, a compact ledger of article IDs and day-level timestamps in chrome.storage.sync. RTV Shadap operates no server; the developer cannot access browser-sync identities or users' synchronized history.
```

`https://www.rtvslo.si/*` host permission:

```text
Required so the extension can identify and dim article cards across RTV SLO pages and hide selected promotional sections on the homepage. The extension does not run on unrelated websites.
```

## Privacy

Remote code:

```text
No remote code is used. All extension code is packaged in the extension bundle.
```

Data collection:

```text
The developer does not collect, receive, sell, or share user data. After explicit opt-in, the extension places compact article IDs and day-level timestamps in chrome.storage.sync solely to provide cross-device read-state synchronization through the user's browser provider.
```

Data usage checkboxes:

```text
Disclose `Website content` because the extension processes RTV article identifiers/titles to provide its manual read-state feature. Do not select personally identifiable information, authentication information, personal communications, location, financial information, health information, or advertising-related categories. The synchronized payload contains only compact article IDs and day-level timestamps.
```

Certification checkboxes:

```text
Check all three certification boxes.
```

Privacy policy URL:

```text
https://github.com/matejbolta/rtv-shadap/blob/main/PRIVACY.md
```

Data handling:

```text
The extension stores stable article IDs, canonical URLs, last known titles, and timestamps locally in chrome.storage.local. If the user explicitly enables device sync, only compact article IDs and day-level timestamps are written to chrome.storage.sync. The developer has no server and no access to either local or synchronized history. Sync can be declined in the one-time prompt or changed later in extension Options.
```

## Test instructions for reviewers

```text
1. Install the extension.
2. Open https://www.rtvslo.si/.
3. Open the extension popup and press “Do the magic”. The first use presents a one-time choice between browser sync and local-only mode; either choice continues without an RTV Shadap login.
4. The stories on that page should become dimmed immediately.
5. Open another RTV SLO page or category. The same stories should remain dimmed wherever they appear, while unmarked stories stay prominent.
6. Merely loading, closing, or leaving a page must not mark stories automatically.
7. Open the extension's Options page to change the device-sync choice.
8. With browser sync enabled on two browser profiles in the same sync environment, mark a page on one device and confirm matching stories become seen on the other after browser synchronization.
9. Open the extension popup to reset history. With sync enabled, the reset propagates to other opted-in devices.
```

For Brave testing, the `Extensions` data type must be enabled under Brave Sync on both devices. The unrelated `Allow Google login for extensions` setting is not required.

## Dashboard assets

- Store icon: use `public/icons/icon128.png`.
- Homepage screenshot: use `release/store-assets/rtv-shadap-homepage-1280x800.jpg`.
- Current popup screenshot: use `release/store-assets/rtv-shadap-popup-1280x800.jpg`.
- Device-sync Options screenshot: use `release/store-assets/rtv-shadap-sync-options-1280x800.jpg`.
- Optional promotional tile images can be skipped unless the dashboard requires them.
