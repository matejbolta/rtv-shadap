# Chrome Web Store submission notes

Use `release/rtv-shadap-vX.Y.Z-webstore.zip` for Chrome Web Store upload. Its `manifest.json` is at the zip root.

## Version 0.2.6 update notes

```text
RTV Shadap now uses a fully manual workflow. Press “Do the magic” to dim every story on the current RTV SLO page; the same stories remain dimmed wherever they appear across the site. Loading, closing, refreshing, or leaving a page no longer marks anything automatically. This update also adds all-site support, a darker and more consistent seen treatment, a simplified popup, and a green success flash after marking completes.
```

## Listing

Name:

```text
RTV Shadap
```

Short description:

```text
Manually dim RTV SLO stories on the current page and keep them dimmed everywhere on the site.
```

Detailed description:

```text
RTV Shadap makes RTV SLO news pages easier to scan.

Press the popup button to dim all stories currently shown on an RTV SLO page. The extension remembers those stories locally, so the same articles stay dimmed when they appear on the homepage, category pages, or elsewhere on RTV SLO. Nothing is marked automatically when you load, close, or leave a page. Live stories remain visually prominent, and selected promotional sections are hidden on the homepage.

The extension only runs on https://www.rtvslo.si/. It has no server, analytics, tracking, ads, or telemetry. Manually marked article history is stored locally in the browser using chrome.storage.local.

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
RTV Shadap lets users manually dim the stories on any RTV SLO news page and recognizes the same stories across the site.
```

## Permission justification

`storage`:

```text
Used to store article IDs that the user manually marked from an RTV SLO page. No data is transmitted to any server.
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
The extension does not collect, transmit, sell, or share user data.
```

Data usage checkboxes:

```text
Leave all user-data category checkboxes unchecked.
```

Certification checkboxes:

```text
Check all three certification boxes.
```

Privacy policy URL:

```text
https://github.com/matejbolta/rtv-shadap/blob/main/PRIVACY.md
```

Local data:

```text
The extension stores article IDs, manual seen status, and timestamps locally in chrome.storage.local so it can recognize the same story across RTV SLO pages. This data remains on the user's device.
```

## Test instructions for reviewers

```text
1. Install the extension.
2. Open https://www.rtvslo.si/.
3. Open the extension popup and press “Do the magic”.
4. The stories on that page should become dimmed immediately.
5. Open another RTV SLO page or category. The same stories should remain dimmed wherever they appear, while unmarked stories stay prominent.
6. Merely loading, closing, or leaving a page must not mark stories automatically.
7. Open the extension popup to reset local history if needed.
```

## Assets still needed in the dashboard

- Store icon: use `public/icons/icon128.png`.
- Screenshots: capture the RTV homepage with visible dimmed/seen stories and the extension popup.
- Optional promotional tile images can be skipped unless the dashboard requires them.
