# Chrome Web Store submission notes

Use `release/rtv-shadap-vX.Y.Z-webstore.zip` for Chrome Web Store upload. Its `manifest.json` is at the zip root.

## Listing

Name:

```text
RTV Shadap
```

Short description:

```text
Highlights new RTV SLO homepage stories by dimming items you have already seen or opened.
```

Detailed description:

```text
RTV Shadap makes the RTV SLO homepage easier to scan.

It visually dims stories you have already seen, marks stories you have opened, keeps live stories prominent, and hides selected promotional homepage sections. New stories stay visually clear, so you can quickly spot what changed since your last visit.

The extension only runs on https://www.rtvslo.si/. It has no server, analytics, tracking, ads, or telemetry. Article history is stored locally in the browser using chrome.storage.local.

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
RTV Shadap helps users scan the RTV SLO homepage by visually distinguishing new, already seen, opened, and live stories.
```

## Permission justification

`storage`:

```text
Used to store article status locally in the user's browser, including whether RTV SLO homepage stories were already seen or opened. No data is transmitted to any server.
```

`https://www.rtvslo.si/*` host permission:

```text
Required so the extension can run on RTV SLO pages, identify article cards on the homepage, apply visual states, and hide selected promotional sections. The extension does not run on unrelated websites.
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
The extension stores article IDs, article status, and timestamps locally in chrome.storage.local so it can remember what was already seen or opened. This data remains on the user's device.
```

## Test instructions for reviewers

```text
1. Install the extension.
2. Open https://www.rtvslo.si/.
3. Use the homepage normally: scan stories, open a story, return to the homepage, and reopen the homepage later.
4. Previously seen stories should be visually dimmed, opened stories should be marked, and new stories should remain prominent.
5. Open the extension popup to reset local history if needed.
```

## Assets still needed in the dashboard

- Store icon: use `public/icons/icon128.png`.
- Screenshots: capture the RTV homepage with visible dimmed/seen stories and the extension popup.
- Optional promotional tile images can be skipped unless the dashboard requires them.
