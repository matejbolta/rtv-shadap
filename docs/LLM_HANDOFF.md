# RTV Shadap LLM Handoff

This document is the project memory for future coding agents.

The repository was built through an interactive conversation with the user. The code is readable on its own, but several important product decisions came from the user's workflow, repeated manual testing, Chrome Web Store constraints, and bug reports. A future agent should read this file before making functional changes.

Last updated: 2026-07-02.

## Start Here

RTV Shadap is a Manifest V3 Chrome/Brave extension for the RTV SLO homepage at `https://www.rtvslo.si/`.

The core problem: RTV SLO's homepage rearranges and refreshes stories over time. A user who checks the page a few times per day has to waste attention deciding which headlines are genuinely new and which ones were already scanned earlier. This extension makes already-seen and opened stories visually quieter, while genuinely new stories remain visually clear.

The user is not just asking for "mark visited links." The intended experience is:

1. Open the RTV SLO homepage.
2. Quickly scan visible headlines.
3. Open selected stories, often in new tabs.
4. Close the homepage after scanning.
5. On the next visit, old stories should be visually de-emphasized and new stories should pop out.

The extension also hides selected distracting RTV365/promotional homepage sections, because they interrupt scanning and are not part of the news-digest workflow.

## Non-Negotiable Product Rules

These are easy to accidentally break. Treat them as product requirements, not implementation accidents.

1. The extension must run only on `https://www.rtvslo.si/` homepage behavior.
   The manifest host permission is broader (`https://www.rtvslo.si/*`) because content scripts are matched by URL pattern, but `src/content/content-script.ts` exits unless `location.origin === HOMEPAGE_ORIGIN` and `location.pathname === "/"`.

2. No server, telemetry, analytics, ads, tracking, remote code, or external APIs.
   All state is local in `chrome.storage.local`.

3. Do not use RTV SLO's logo as the extension icon.
   The initial icon used an RTV source image, but it was replaced because of copyright/trademark concerns. Current icons are generated original assets by `scripts/generate-icons.mjs`.

4. "Seen" does not mean "rendered once."
   Articles become `seen` when a homepage visit/session is committed. This avoids instantly graying everything on first page load.

5. Clicking a homepage article in the same tab must not mark the whole homepage as seen.
   Same-tab navigation to a story marks only the clicked story as `opened` and abandons the pending homepage session.

6. Closing the actual homepage tab commits the scanned homepage session.
   That is the user's preferred workflow: scan, open selected stories in new tabs, close the homepage, and read opened tabs later.

7. Closing separate article tabs must not affect homepage state.
   The content script does not run on article pages, so closing article tabs should not commit homepage snapshots.

8. RTV auto-refreshes must not commit the previous homepage session.
   RTV can replace/reload the homepage while a tab is left open. A story that appeared during auto-refresh A must not become seen just because auto-refresh B happened.

9. Live stories stay visually prominent.
   If a card is detected as `V zivo`, `V živo`, or `LIVE`, it should not be dimmed even if history says it was seen/opened. Live is orthogonal metadata, not a fourth visual state.

10. New stories must pop visually by contrast.
   The UX goal is not decoration. Seen/opened items should be quiet enough that the user's eye naturally lands on new items.

11. Do not turn the project into a generic ad blocker or page rewriter.
    The cleanup behavior is intentionally narrow and RTV-homepage-specific.

## Historical Context

This section explains why the project looks the way it does.

### Original Motivation

The user described RTV SLO as a page where headlines shift positions during the day. A title that was at the top may later move lower, into a side column, or lose its image. The annoying part is not reading the news; it is spending attention to determine whether a title was already seen a few hours earlier.

The first idea was:

- fully gray out stories the user opened,
- semi-gray stories whose title was already seen,
- leave genuinely new stories visually strong,
- exempt live-updating stories.

### UX Iterations

Early popup versions had a normal checkbox labeled enabled/active, a legend, URL text, and dashed count placeholders. The user found this confusing and ugly. It was redesigned into a compact product-like popup:

- product name `RTV Shadap`,
- switch instead of checkbox,
- reset history button,
- no redundant legend,
- no "open or refresh URL" text.

Later, the count cards were removed entirely because they were not useful enough and were easy to make misleading on a dynamic homepage. The popup should stay focused on two actions: enable/disable and reset history.

The visual dimming went through several rounds:

- first gray was too subtle,
- then the striped overlay was too intense,
- final version uses grayscale/saturation changes plus diagonal stripes at reduced intensity.

The diagonal stripe pattern is intentional. It makes already-seen content recognizable without needing to read the title. Do not remove it just because plain opacity looks simpler.

### Name

The name is intentionally playful: `RTV Shadap`.

Rejected/previous names included variants like `RTV Novo`, `RTV Radar`, and `RTV Digest`. The user explicitly chose `RTV Shadap`.

### Homepage Cleanup

The user asked to remove:

- the full RTV365 streaming-service section,
- standalone promo banners between news sections,
- RTV365 promo banners,
- lower portal shortcuts like Skit, Ziv Zav, Cist hudo, MMC podrobno,
- the `Sodelujte` cards.

The user explicitly wanted to keep `Posebna izdaja`.

### Article Navigation Bug

A major bug was discovered around same-tab article clicks:

1. User opens homepage.
2. User clicks one article normally.
3. Browser navigates away from homepage to article.
4. Old implementation treated leaving the homepage as session completion.
5. Result: all homepage articles became seen, even though only one was opened.

The fix:

- detect normal same-tab article activation,
- immediately mark the clicked story as `opened`,
- set `abandonSessionOnPagehide`,
- send `ABANDON_SESSION` instead of `COMMIT_SESSION` on `pagehide`,
- on back navigation (`pageshow`) start a new homepage session.

Regression test: `tests/repository.test.ts` includes `can abandon a same-tab article navigation without marking the rest as seen`.

### Chrome Web Store and Releases

The project was put on GitHub as `matejbolta/rtv-shadap`.

Chrome Web Store item ID observed during submission:

```text
oeplikfkggjcbekgclpegnblalngbpai
```

Share URL:

```text
https://chromewebstore.google.com/detail/rtv-shadap/oeplikfkggjcbekgclpegnblalngbpai
```

Historical status on 2026-07-02:

- `0.1.0` was published first.
- `0.1.1` was submitted afterward so the Web Store package would match the current icon/version.
- The user prefers careful version bumps from now on.

Always verify current dashboard state instead of assuming this historical status is still true.

## Architecture Overview

The extension is deliberately small:

```text
public/manifest.json
src/content/
src/background/
src/popup/
src/shared/
scripts/
tests/
```

### Runtime Pieces

`src/content/content-script.ts`

- Runs on RTV SLO pages but exits unless exact homepage.
- Extracts article cards.
- Applies visual states.
- Hides distracting homepage sections.
- Tracks click/open behavior.
- Sends session snapshots to the service worker.
- Observes DOM mutations because RTV dynamically updates the page.

`src/background/service-worker.ts`

- Owns mutations to `chrome.storage.local` through `Repository`.
- Handles messages from content script and popup.
- Commits pending homepage sessions when tabs close.
- Broadcasts history/settings changes to active homepage tabs.

`src/background/session-manager.ts`

- Pure-ish state transition logic.
- The safest place to reason about `seen`, `opened`, pending sessions, commits, and abandoned sessions.
- Most lifecycle bugs should get tests here.

`src/background/repository.ts`

- Normalizes persisted storage.
- Serializes storage mutations through an in-memory promise queue.
- Prunes history above `MAX_HISTORY_RECORDS`.

`src/content/extractor.ts`

- Finds RTV article/media links.
- Groups duplicate card presentations by stable article key.
- Finds title/image/card elements for rendering.

`src/content/renderer.ts`

- Adds/removes `data-rtv-tracker-*` attributes and small badges.
- Does not directly hard-code visual styling; CSS handles styling.

`src/content/content.css`

- Visual UX for seen/opened/live cards.
- Tune carefully. A small CSS change can make the product feel broken.

`src/content/site-cleanup.ts`

- Hides RTV365/promo/shortcut sections.
- Must remain narrow and homepage-specific.

`src/popup/*`

- Popup switch and reset history.
- Do not reintroduce count cards unless there is a genuinely reliable product reason.

`src/shared/*`

- Common constants, models, message types, URL identity helpers, and Chrome API promise wrappers.

## State Model

### Article Identity

Stable keys are essential because the same story can appear in multiple places or move around the page.

`src/shared/article-url.ts` produces:

- `rtv:<numeric-id>` for RTV SLO article URLs ending in numeric IDs,
- `rtv365:<recording-id>` for RTV365 media items,
- `url:<path>` fallback only for clear article-like slugs.

Numeric IDs are preferred because headlines can change while the story remains the same.

Examples:

```text
https://www.rtvslo.si/slovenija/test/704321 -> rtv:704321
https://365.rtvslo.si/kratki#175232322 -> rtv365:175232322
```

### Visual States

There are three primary states:

- `new`: not in history yet.
- `seen`: homepage session containing the article was committed.
- `opened`: user opened/clicked the article.

There is also `isLive`, which is orthogonal:

- live cards can still have history records,
- live cards should not be dimmed.

### Storage

Storage key:

```text
rtvNovoState
```

Current schema:

```ts
interface StorageState {
  schemaVersion: 1;
  history: Record<string, ArticleHistoryRecord>;
  pendingSessions: Record<string, PendingSession>;
  settings: { enabled: boolean };
}
```

The storage key still contains an earlier project name (`rtvNovo`). Do not rename storage keys casually; renaming them resets existing users' state unless you implement migration.

Older installs may have leftover count-related fields/keys such as `latestPage` or `rtvRadarLatestCounts`. Current code ignores them.

## Homepage Session Lifecycle

This is the most important implementation detail.

### Load Homepage

1. Content script hides selected sections.
2. Content script extracts articles.
3. It renders immediately from local storage as a fast fallback.
4. It sends `START_SESSION` to the service worker with article snapshots.
5. Service worker starts/replaces a pending session for that tab/session ID.
6. Service worker returns statuses from history.
7. Content script renders authoritative statuses.

### DOM Mutations

RTV can update the page dynamically.

The content script observes DOM changes and rescans with `RESCAN_DEBOUNCE_MS`.

On rescan:

- hidden sections are hidden again,
- articles are extracted again,
- local storage fallback rendering runs,
- a debounced `UPDATE_SESSION_SNAPSHOT` is sent,
- the pending session stores the union of articles seen during the session.

Important: a DOM mutation alone does not commit history. It only updates the current pending session and rendering.

### Same-Tab Homepage Replacement

RTV can also refresh/replace the homepage document while the tab remains open. This caused a real bug:

1. Auto-refresh A added new colored stories.
2. Auto-refresh B started a new homepage session in the same tab.
3. The old implementation committed session A when session B started.
4. Result: stories added in A were already gray in B, even though the user may not have looked at them.

Current rule: starting a new homepage session in the same tab discards the previous pending session instead of committing it.

Do not change this back to "commit old session on replacement" unless you have a better way to distinguish an RTV auto-refresh from a deliberate user visit.

### Visibility Hidden

When the homepage tab becomes hidden, the content script persists a snapshot but does not commit the session.

Reason: switching tabs should not mean "I am done scanning the homepage." It only keeps the pending session current.

### Closing Homepage Tab

When the homepage tab closes, `chrome.tabs.onRemoved` in the service worker commits all pending sessions for that tab.

Committed pending articles become `seen`.

This is the main workflow the user likes: scan homepage, open selected stories in tabs, close homepage.

### Pagehide

The content script also sends a lifecycle message on `pagehide`.

`pagehide` by itself must not commit a session. RTV auto-refreshes can trigger page lifecycle events, and treating `pagehide` as "the user finished scanning" caused auto-refreshed stories to gray out in the next refresh cycle.

If the user clicked an article in the same tab, `pagehide` sends:

```text
ABANDON_SESSION
```

Normal homepage tab closing is handled by `chrome.tabs.onRemoved` in the service worker.

### Same-Tab Article Click

Normal left click or Enter on a homepage article link:

1. mark that article `opened`,
2. render it as opened immediately,
3. send `MARK_ARTICLE_OPENED` with `abandonSession: true`,
4. abandon the rest of the homepage pending session,
5. on browser Back (`pageshow`), start a fresh homepage session.

This prevents the "I opened one article and everything became gray" bug.

### New-Tab Article Opens

Middle click, Cmd/Ctrl click, shifted/modified click, or target `_blank`:

1. mark clicked article `opened`,
2. do not abandon homepage session,
3. homepage can later be closed and committed as `seen`.

This matches the user's preferred workflow.

### Browser Startup

`chrome.runtime.onStartup` reconciles leftover pending sessions. This is a defensive cleanup for sessions that were pending when the browser stopped.

## Extraction Details

RTV homepage DOM has multiple card shapes. Known useful classes from the saved fixture:

- `xl-news`
- `md-news`
- `sm-news`
- `article-container`
- title classes like `title-cut-4-rows`, `title-cut-5-rows`, `list-title`
- image wrappers like `image-link`, `image-container`, `container-16-9`

The extractor intentionally uses a mix of known RTV classes and generic article/card/teaser fallbacks. It then filters links through `identifyArticle`.

When RTV changes DOM:

1. Save a fresh full homepage HTML fixture if possible.
2. Sanitize secrets/API keys.
3. Add/adjust tests in `tests/extractor.test.ts`.
4. Change selectors conservatively.

Do not parse titles with brittle string hacks if DOM APIs or existing selector helpers can handle it.

## Live Detection

Live detection lives in `src/content/live-detection.ts`.

Recognized text:

- `V živo`
- `V zivo`
- `LIVE`

It intentionally checks:

- headline text,
- short badge-like elements,
- selected attributes (`aria-label`, `title`, `data-label`, `data-badge`, `data-status`, `class`).

It intentionally avoids treating a whole large section as live just because nearby navigation or page chrome contains live words.

If live detection changes, update `tests/live-detection.test.ts`.

## Visual UX Notes

The visual design is functional, not decorative.

### Seen

Seen cards are somewhat gray and striped:

- grayscale/saturation/contrast reduced,
- title/media opacity reduced,
- diagonal overlay with low-intensity black stripes.

### Opened

Opened cards are quieter than seen cards and get an `Odprto` badge if useful.

### Live

Live cards ignore dimming:

```css
[data-rtv-tracker-live="true"] {
  opacity: 1 !important;
  filter: none !important;
}
```

### Stripe Intensity

The user specifically tuned stripe intensity downward after it was too heavy. Current values are not arbitrary:

```css
--rtv-tracker-seen-stripe: rgb(0 0 0 / 8%);
--rtv-tracker-opened-stripe: rgb(0 0 0 / 11%);
```

If changing these, test visually on:

- lead card,
- side column,
- Avdio/Video strip,
- lower category sections,
- both dark and lighter image content.

### Avoid Two-Stage Lazy-Load Dimming

RTV lazy-loads or late-renders some media while the user scrolls. Do not stack the main grayscale/filter treatment on both the card container and child `img`/`picture`/`figure` elements. That creates an annoying two-stage effect where a seen card looks only semi-dimmed until it enters the viewport, then becomes fully dimmed when the image element receives its own state/filter.

The main filter should live on `[data-rtv-tracker-card="true"]`; title opacity can be applied through descendants of that card.

### Popup UX

Popup should remain compact and direct:

- product name,
- enabled switch,
- reset history.

Avoid reintroducing:

- checkbox-as-toggle,
- verbose legends,
- "last scan ready" status text,
- URL instructions,
- dash placeholders instead of numbers.

## Hidden Homepage Sections

Implemented in `src/content/site-cleanup.ts`.

Currently hidden:

- standalone RTV365 full section,
- standalone promo banners,
- RTV365 banner images,
- portal shortcut rows for Skit, Ziv Zav, Cist hudo, MMC podrobno,
- `Sodelujte` section and heading.

Intentionally kept:

- `Posebna izdaja`
- actual news/category sections
- Avdio/Video items, which are extracted and dimmed like other items.

When adding cleanup rules:

1. Prefer selectors tied to the specific unwanted block.
2. Do not hide by broad visual layout alone.
3. Add assertions to `tests/extractor.test.ts`.
4. Verify extraction does not accidentally count hidden links.

## Privacy and Chrome Web Store Requirements

The privacy promise is central:

- no data collection,
- no transmission,
- no remote code,
- no analytics,
- no ads,
- no telemetry,
- local browser storage only.

Chrome Web Store form language is captured in `STORE_SUBMISSION.md`.

Privacy policy is `PRIVACY.md`.

If a future change adds any external request, tracking, sync, cloud storage, or broader host permission:

1. Stop and reconsider whether it is needed.
2. Update privacy policy and store submission notes.
3. Expect Chrome Web Store review implications.
4. Ask the user before doing it.

## Versioning Rules

The user explicitly asked to maintain versions carefully from `0.1.1` onward.

Use semantic-ish versioning:

- Patch (`0.1.2`): bug fix, selector fix, UX tuning, doc-neutral package rebuild.
- Minor (`0.2.0`): meaningful new behavior or feature.
- Major (`1.0.0`): stable public milestone after confidence.

For any code, manifest, icon, popup, CSS, behavior, or packaged asset change that should reach users:

1. Update `package.json` version.
2. Update `public/manifest.json` version to match.
3. Run checks.
4. Run `node scripts/package.mjs`.
5. Upload `release/rtv-shadap-vX.Y.Z-webstore.zip` to Chrome Web Store.
6. Tag `vX.Y.Z` if making a GitHub Release.

For docs-only changes, a version bump is not required.

Never upload a Chrome Web Store package with the same version as the currently published or previously uploaded package. Chrome requires increasing manifest versions for updates.

## Release Artifacts

`node scripts/package.mjs` creates two zip files:

```text
release/rtv-shadap-vX.Y.Z.zip
release/rtv-shadap-vX.Y.Z-webstore.zip
```

Difference:

- `rtv-shadap-vX.Y.Z.zip`: for manual unpacked installation. It contains a top-level folder.
- `rtv-shadap-vX.Y.Z-webstore.zip`: for Chrome Web Store upload. `manifest.json` is at zip root.

Do not upload the manual zip to Chrome Web Store.

Do not tell manual users to install the webstore zip.

## GitHub Releases

Release workflow is triggered by tags matching `v*`.

Normal release flow:

```sh
pnpm typecheck
pnpm test
node scripts/package.mjs
git status
git tag vX.Y.Z
git push origin main
git push origin vX.Y.Z
```

Because some environments may have `.git` read-only for coding agents, it is OK for the agent to prepare files and tell the user which git commands to run.

The user does not want everything forced into one commit. Use normal linear commits for normal changes.

## Chrome Web Store Flow

Chrome Web Store item ID:

```text
oeplikfkggjcbekgclpegnblalngbpai
```

Install/share URL:

```text
https://chromewebstore.google.com/detail/rtv-shadap/oeplikfkggjcbekgclpegnblalngbpai
```

Visibility:

- `Public`: searchable/listed.
- `Unlisted`: anyone with link can install, not listed/searchable.
- `Private`: only specified testers.

The user likely wants public once comfortable.

Review/publishing behavior:

- The user used manual/deferred publish.
- After review approval, the dashboard can show "Ready to publish before <date>".
- A reviewed staged item must be manually published before the deadline.
- Store emails may not reliably arrive; dashboard status is more reliable.

For updates:

1. Publish or finish any staged version first if the dashboard requires it.
2. Upload a new `*-webstore.zip` with a higher manifest version.
3. Save draft.
4. Submit for review.
5. Existing users stay on the previous live version during review.
6. After approval, manually publish if deferred publishing is still selected.

## Testing

Run before code/package changes:

```sh
pnpm typecheck
pnpm test
pnpm build
node scripts/package.mjs
```

Core automated tests:

- `tests/article-url.test.ts`: stable article/media identity.
- `tests/extractor.test.ts`: DOM extraction and hidden-section behavior.
- `tests/live-detection.test.ts`: live badge detection.
- `tests/repository.test.ts`: session commit/abandon/open/prune behavior.
- `tests/state.test.ts`: new/seen/opened classification.
- `tests/fixture-sanitization.test.ts`: prevents committed Google API keys in fixture.

Manual regression checklist:

1. Reset history in popup.
2. Open `https://www.rtvslo.si/`.
3. Confirm new items are fully visible.
4. Close homepage and reopen it; old items should be seen/dimmed.
5. Middle/Cmd-click an article; it should become opened immediately, homepage session should remain pending.
6. Normal-click an article in same tab; only that article should become opened, then Back should not gray every other article.
7. Let RTV dynamically add/reorder cards; new cards should remain visually prominent until the session is committed.
8. Confirm Avdio/Video cards are extracted and dimmed.
9. Confirm selected promo banners/RTV365/Sodelujte sections are hidden.
10. Confirm `Posebna izdaja` remains visible.
11. Toggle extension off; all custom dimming/markers/hidden sections should disappear.
12. Toggle extension on; behavior should return.

## Debugging Playbook

### "Everything became gray after I clicked one article"

Likely broken same-tab abandon flow.

Check:

- `isSameTabArticleActivation` in `content-script.ts`
- `abandonSessionOnPagehide`
- `MARK_ARTICLE_OPENED` with `abandonSession`
- `ABANDON_SESSION` handler
- `tests/repository.test.ts` same-tab abandon test

### "Nothing is graying out"

Check:

- exact URL is `https://www.rtvslo.si/` with pathname `/`,
- extension is enabled,
- content script is loaded,
- extractor returns articles,
- article keys match history keys,
- CSS is loaded,
- page is not live-only,
- local history was not reset.

### "Popup counts are missing"

This is intentional. The popup used to show new/seen/opened/live counts, but the user found them useless and likely misleading. Current popup exposes only enable/disable and reset history.

### "A promo/banner is still visible"

Check `src/content/site-cleanup.ts`.

Use a fresh saved HTML fixture if RTV changed classes or image filenames. Add a fixture assertion before adding a broad selector.

### "Avdio/Video does not dim"

Those are RTV365 media cards. Check:

- `identifyRtv365Recording`,
- `identifyRtv365Media`,
- dataset attributes like `data-recording`, `data-resume-ava-id`, `data-ava-id`,
- fixture coverage in `tests/extractor.test.ts`.

### "Icon mismatch between computers"

Usually stale release/package/install cache:

- GitHub Release `v0.1.0` historically contained an older package.
- Current icon is generated by `scripts/generate-icons.mjs`.
- Manual unpacked installs do not auto-update.
- Chrome/Brave may cache extension icons until extension reload/reinstall.
- Check package version and icon checksum in `dist` and zip.

### "Chrome Web Store rejects upload"

Common causes:

- uploaded manual zip instead of `*-webstore.zip`,
- manifest version not increased,
- manifest not at zip root,
- privacy/permission justification fields incomplete,
- package contains remote code or unexpected files.

### "GitHub says secrets detected"

This happened because the saved RTV homepage fixture contained public Google API keys from RTV's page. They were redacted and `tests/fixture-sanitization.test.ts` was added.

Never commit raw fixtures containing `AIza...` keys.

## Working With Fresh RTV HTML Fixtures

If selectors break, ask the user to save fresh homepage HTML and assets if needed.

Before committing a new fixture:

1. Remove scripts if they are not needed.
2. Redact Google API keys and any secret-like values.
3. Run `pnpm test`.
4. Ensure `tests/fixture-sanitization.test.ts` still passes.

## Future Feature Ideas

These are not commitments. They are reasonable future directions if the user asks.

- Option to choose dimming strength in popup.
- Option to temporarily show hidden RTV365/promo sections.
- Separate visual treatment for "seen" vs "opened" if the current distinction becomes too subtle.
- Sync across devices, but only if the user explicitly accepts privacy/store complexity.
- Better live-story detection if RTV exposes a stable live badge class.
- Better first-run onboarding, but keep popup compact.

## Things To Avoid

- Do not broaden host permissions beyond RTV without a strong reason.
- Do not add analytics to understand usage.
- Do not add remote config to tune selectors.
- Do not use RTV SLO branding assets as icons.
- Do not mark articles as seen merely because they were rendered once.
- Do not remove same-tab abandon behavior.
- Do not hide broad page sections with generic selectors that may remove news.
- Do not rename storage keys without migration.
- Do not change version in only `package.json` or only `manifest.json`; keep both aligned.

## Current Known Limitations

- RTV can change DOM at any time; selectors may need maintenance.
- Dynamic homepage updates while the homepage remains open can be added to the pending session and later committed on close. This is acceptable for the user's workflow, but it is not a perfect "human eye actually saw this exact card" detector.
- Storage is local per browser profile. Chrome Web Store installation auto-updates code, but does not sync seen/opened history across devices.
- The extension currently has no options page.
- Visual tuning is subjective and was optimized for the user's screenshots/dark RTV layout.

## Quick File Map

```text
README.md                         User/developer overview.
AGENTS.md                         Short instructions for future AI agents.
docs/LLM_HANDOFF.md               This project memory document.
STORE_SUBMISSION.md               Chrome Web Store listing/privacy text.
PRIVACY.md                        Public privacy policy.
public/manifest.json              MV3 manifest and Web Store version.
public/icons/                     Generated original icon assets.
scripts/generate-icons.mjs        Rebuilds icons.
scripts/build.mjs                 Bundles extension into dist/.
scripts/package.mjs               Builds release zip files.
src/content/content-script.ts     Homepage controller and lifecycle.
src/content/extractor.ts          Article/card extraction.
src/content/renderer.ts           DOM data attributes and markers.
src/content/content.css           Visual dimming/stripe UX.
src/content/site-cleanup.ts       Hides selected RTV homepage sections.
src/background/service-worker.ts  Runtime message routing and tab lifecycle.
src/background/session-manager.ts Session state transitions.
src/background/repository.ts      Storage normalization and mutation queue.
src/popup/                        Popup UI.
src/shared/                       Shared models, constants, messages, URL identity.
tests/                            Unit and fixture tests.
```

## If You Are A Future Agent

Before editing:

1. Read `AGENTS.md`.
2. Read this file's `Start Here`, `Non-Negotiable Product Rules`, and `Homepage Session Lifecycle`.
3. Inspect current `git status`.
4. Preserve user changes.
5. Make narrow changes.
6. Add/update tests for behavior changes.
7. Run typecheck/tests/build where feasible.
8. If package behavior changes, bump versions and package correctly.

The user's trust in this project comes from the extension feeling exactly aligned with his browsing workflow. Protect that workflow first.
