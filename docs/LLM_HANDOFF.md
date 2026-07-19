# RTV Shadap LLM Handoff

This document is the durable project memory for future coding agents.

Last updated: 2026-07-19.
Current source version: 0.3.1.

## Start Here

RTV Shadap is a Manifest V3 Chrome/Brave extension for:

    https://www.rtvslo.si/*

It is a manual read-state tool. It never infers that the user saw a story from page load, scrolling, clicking, navigation, refresh, tab visibility, or tab closing.

The only operation that adds articles to history is the popup button:

    Do the magic

That button marks every currently extracted RTV article or media card on the active RTV page. Stable article identity carries the seen state across the whole supported site, so a story marked on the homepage stays seen on category pages, side columns, article-page recommendations, and any other supported presentation.

Version 0.3.0 adds optional browser-native device sync. It has no RTV Shadap account, OAuth flow, developer server, or knowledge of the user's identity. Full, unpruned history always remains in `chrome.storage.local`. After explicit opt-in on a device, only a compact capped ledger of stable article keys and day-level timestamps is written to `chrome.storage.sync`.

The exact homepage also retains a narrow cleanup feature that hides selected RTV365/promotional blocks.

## Non-Negotiable Product Rules

1. Manual marking is the only history write.
   Loading, viewing, refreshing, closing, leaving, or returning to an RTV page must not mark any article.

2. Article clicks are not tracked.
   Normal click, Enter, middle click, Cmd/Ctrl click, and new-tab opens must not mutate article history.

3. The popup mark button marks all currently extracted cards.
   It must ask the content script in the active RTV tab to inspect the current DOM, including dynamically injected cards.

4. Seen state follows the stable article key across the site.
   A story marked anywhere must render as seen everywhere the same key appears under `www.rtvslo.si`.

5. Opened article content is never a card.
   On an article-detail page, the title, hero media, caption, and prose must remain visually untouched. Related, sidebar, and lower news-list cards may still render as seen.

6. Full local history does not expire or prune automatically.
   “Forever” means until Reset, extension-data removal, or uninstall. The 3,000-entry sync cap must never prune `chrome.storage.local`.

7. Device sync is explicit and per device.
   Do not read or write the RTV Shadap sync payload until the user chooses browser sync. Declining must leave the normal manual feature fully usable in local-only mode.

8. The sync payload is deliberately narrow.
   Sync compact stable keys and day-level seen timestamps only. Never sync titles, canonical URLs, page HTML, screenshots, click behavior, analytics, or identity data.

9. Synced histories converge by union, while Reset wins over old offline state.
   Use the reset generation/timestamp design. A stale device must not resurrect pre-reset history. Marks genuinely made after the reset may survive and rejoin the shared ledger.

10. Reset scope follows sync mode.
   In browser-sync mode, Reset is global for devices participating in the same browser sync environment. In local-only mode, Reset affects only that browser profile.

11. The enable switch controls rendering and manual marking.
    When disabled, visual treatment and homepage cleanup disappear and the page-mark action cannot write history. The sync preference is separate from this switch.

12. Live stories stay visually prominent.
    A live card may have a history record, but it must not be dimmed.

13. The content script runs only on the supported origin.
    Do not broaden permissions beyond `https://www.rtvslo.si/*` without an explicit product decision.

14. Homepage cleanup stays homepage-only.
    Category and article pages get extraction/rendering, not broad page cleanup.

15. No developer-operated server, telemetry, analytics, ads, tracking, remote code, OAuth, or external API.
    Browser-native `chrome.storage.sync`, after consent, is the only approved transmission path.

16. Do not use RTV SLO logos as extension icons.
    Current icons are original generated assets.

17. Keep selectors conservative.
    A cleanup rule must never hide a real news card merely because it resembles a banner layout.

## Product Flow

The intended normal workflow is:

1. Open any page on `www.rtvslo.si`.
2. Scan its visible news cards.
3. Open the extension popup.
4. Press `Do the magic`.
5. On first use of version 0.3.x on that device, choose browser sync or local-only.
6. The extracted non-live cards become visually quiet immediately.
7. Move to another RTV page.
8. Previously marked stories remain quiet there; unmarked stories remain prominent.

The one-time sync choice must not add permanent explanatory copy to the popup. Later changes belong on the extension Options page.

Nothing is added to article history if the mark action does not complete. Merely opening the popup or answering the sync choice does not mark a page.

## Historical Context

### Version 0.1 Behavior — Retired

Versions 0.1.x used automatic homepage sessions:

- closing the homepage tab committed all cards as seen,
- clicking an article marked it opened,
- same-tab navigation needed an abandon-session path,
- auto-refresh replacement needed special pending-session handling,
- browser startup reconciled leftover sessions.

That model was deliberately removed for 0.2.0 at the user's request. Do not restore it as a convenience or compatibility behavior.

Old terms such as pending session, opened state, `COMMIT_SESSION`, `ABANDON_SESSION`, and `MARK_ARTICLE_OPENED` describe retired behavior, not current requirements.

### Version 0.2 Manual Model

The user no longer wanted page closing or any browser lifecycle signal to gray everything automatically. The replacement mental model is explicit and deterministic:

- no button press means no history change,
- button press means all extracted cards on this page become seen,
- stable identity carries that state across the RTV news site.

This removes ambiguity around whether the user actually scanned a page before closing or refreshing it.

### Version 0.3 Device Sync

The user wanted to move between a Mac and Linux laptop without rescanning the same stories, but did not want “Sign in with Google,” an RTV Shadap account, or a shared multi-user backend.

The chosen design uses the browser's existing extension sync facility:

- Chrome profiles can use Chrome Sync.
- Brave profiles can use a Brave Sync chain without an RTV Shadap login.
- Every Store user remains isolated by their own browser profile/sync environment.
- Chrome and Brave do not share a common RTV Shadap sync universe.
- If browser sync itself is unavailable or disabled, the extension remains functional locally.

This is intentionally not a custom cross-browser service. Supporting Chrome-to-Brave or unrelated browser profiles would require a separate identity/pairing and backend design, which is outside the approved scope.

### Version 0.3.1 Article-page Boundary

RTV article pages contain page-local controls such as `href="#"`. On a numeric article URL, resolving that fragment against the current page previously produced the current article key. A Google-preference control inside `<article class="article">` could therefore make the extractor classify the entire long-form article as a seen card.

`identifyArticle` now rejects fragment-only and query-only references before URL resolution. This keeps opened article titles, hero media, captions, and prose untouched while preserving extraction of real related/sidebar cards with explicit RTV article URLs.

### Version 0.3.1 Render Stability

The live fallback marker used to be removed and recreated during every render. Because the mutation observer saw that child-list change at the card heading, one unrelated page mutation could start a permanent debounced rescan cycle on a page containing a live card.

The marker is now idempotent: an unchanged render preserves the existing node, while a newly available native live badge removes the fallback. Title extraction strips extension-owned marker text, so rescanning cannot corrupt the headline or make live detection alternate between true and false. The observer also recognizes child-list changes made entirely from extension-owned nodes, and passive scans use a coalescing runner so rapid requests never overlap and collapse into at most one follow-up scan. Each scan renders once: the background response is authoritative, with local storage retained only as the failure fallback.

Regression and stress coverage must preserve these properties:

- a repeated unchanged live render produces no child-list mutation,
- extracting again after rendering preserves the original live title and state,
- one unrelated DOM mutation settles after one rescan,
- extension-owned mutations are ignored but mixed site/extension mutations are not,
- repeated requests while a scan is active never run concurrently,
- failure does not permanently wedge the scan runner.

### Popup UX

Current popup priorities are:

- product name only (`RTV Shadap`),
- `Enabled`/`Disabled` switch,
- one large `Do the magic` primary button,
- one large `Reset` button.

After a successful mark, the primary button briefly flashes green and returns to blue. The success selector must override the normal hover selector while the pointer remains over the button. Failures must not show the success flash.

Keep the permanent popup visually limited to those controls. Do not add explanatory copy, operation-status text, or analytics-like counts. The first-use native confirmation is a one-time consent boundary, not a new permanent popup section.

### Visual Tuning

All manually seen cards use one strong card-level filter derived from the darker pre-0.1.2 middle-click treatment. It adds substantial grayscale and brightness reduction plus dark diagonal stripes. There is no medium-gray tier.

Current filter:

    grayscale(0.85) saturate(0.25) brightness(0.52) contrast(0.86)

Current stripe darkness:

    rgb(0 0 0 / 11%)

Do not add separate descendant opacity rules for headlines, links, summaries, or media. The former mixed treatment produced inconsistent text colors and compounded opacity. Apply the dark treatment once at the card container.

### Homepage Cleanup and the 0.1.3 Regression

The exact homepage hides selected distractions:

- standalone RTV365 section,
- standalone promo banners,
- RTV365 banners,
- portal shortcuts such as Skit, Ziv Zav, Cist hudo, and MMC podrobno,
- Sodelujte cards and heading.

`Posebna izdaja` must remain visible.

Version 0.1.3 fixed a real regression where a broad text-centered/banner-image rule hid legitimate news cards. Important scar tissue:

- never hide by generic layout class alone,
- do not assume an image dimension in a filename makes its card promotional,
- add a fixture regression test before broadening cleanup.

### Name and Branding

The chosen name is RTV Shadap. Earlier ideas included RTV Novo, RTV Radar, and RTV Digest.

An early icon used an RTV source image. It was replaced because of copyright/trademark concerns. Rebuild current original icons through `scripts/generate-icons.mjs`.

## Architecture Overview

### public/manifest.json

- Manifest V3.
- Matches `https://www.rtvslo.si/*`.
- Uses only the `storage` permission and the RTV host permission.
- Declares `options.html` as the extension Options page.
- Version must match `package.json`.

No identity/OAuth permission is needed for `chrome.storage.sync`.

### src/content/content-script.ts

The all-RTV-page controller:

- extracts article/media cards from the current DOM,
- renders stored statuses,
- observes dynamic DOM mutations,
- handles `MARK_CURRENT_PAGE_SEEN` from the popup,
- sends `MARK_ARTICLES_SEEN` to the service worker,
- applies homepage cleanup only when pathname is exactly `/`,
- removes rendering and cleanup when disabled,
- coalesces passive rescan requests and renders once per scan,
- ignores DOM mutations caused solely by extension-owned markers.

It must not bind article-open tracking or page-lifecycle history handlers. It must not directly write local or sync storage.

### src/background/service-worker.ts

The storage/message coordinator:

- accepts the only normal manual history-write request,
- handles enabled and sync-mode settings,
- handles local/global Reset,
- returns article statuses,
- broadcasts history/settings changes to open RTV tabs,
- passes local changes and remote sync changes through `BrowserSyncManager`.

There must be no `tabs.onRemoved` history commit and no startup pending-session reconciliation.

### src/background/history-manager.ts

Small deterministic history logic:

- `markArticlesSeen` writes the supplied snapshots,
- `getStatuses` returns `new` or `seen`,
- live remains orthogonal metadata.

### src/background/repository.ts

- normalizes persisted local storage to schema three,
- serializes local mutations through an in-memory promise queue,
- preserves schema-one/schema-two history during upgrade,
- defaults migrated devices to the unresolved sync mode `ask`,
- drops obsolete pending sessions through normalization.

The popup, options page, and content script must not become additional direct local-storage writers.

### src/background/sync-manager.ts

Owns all RTV Shadap `chrome.storage.sync` behavior:

- blocks payload access until local `syncMode` is `browser`,
- restricts sync-area access to trusted extension contexts,
- compacts keys and timestamps,
- enforces item/total quota safety margins,
- merges remote and local history by stable key,
- serializes reconciliation to avoid local races,
- listens for remote `chrome.storage.onChanged` events,
- uses reset generations to prevent stale resurrection,
- broadcasts when remote history changes local rendering.

All sync failures must leave the complete local history intact. A transient provider failure may delay convergence; it must not turn marking into automatic expiry or data loss.

### src/content/extractor.ts

- identifies RTV article and RTV365 media links,
- rejects page-local fragment/query controls that merely resolve back to the open article,
- groups duplicate presentations by stable key,
- finds title, media, and the smallest safe card element,
- ignores content inside homepage-cleanup blocks.

The same extractor is reused on homepage, category, and article pages.

### src/content/renderer.ts and content.css

- render `new`/`seen` state,
- preserve full emphasis for live cards,
- add a live marker only when the page lacks a native one,
- place grayscale/stripe treatment on the card container.

There is no `opened` visual state in the manual model.

### src/content/site-cleanup.ts

Contains narrow exact-homepage cleanup rules. It may be called by the all-site controller only when `location.pathname === "/"`.

### src/popup

- enabled switch,
- large `Do the magic` button,
- large `Reset` button,
- one-time native sync choice only while `syncMode === "ask"`.

The popup sends a tab message to the active RTV page. It does not extract the page or write storage directly.

### src/options

The persistent settings page lets the user choose:

- `Sync across devices`, or
- `Keep this device local`.

Switching one device to local-only stops its participation but intentionally does not erase a ledger already used by other devices. A user who wants to delete shared history should Reset while browser sync is enabled, then switch devices to local-only.

## Local State Model

The local storage key remains:

    rtvNovoState

Do not rename it without a migration. The old internal name is harmless; changing it naively would lose user history.

Schema three:

    interface StorageState {
      schemaVersion: 3;
      history: Record<string, ArticleHistoryRecord>;
      settings: {
        enabled: boolean;
        syncMode: "ask" | "browser" | "local";
      };
      sync: {
        generation?: string;
        resetAt: number;
      };
    }

History records retain:

- stable key,
- optional numeric article ID,
- canonical URL,
- last title,
- exact first and last manual-seen timestamps.

The complete record stays local. Remote-only keys are represented locally with an empty title/URL placeholder until the extractor sees that article again and refreshes its metadata.

Schema-one `openedAt` fields may remain as extra persisted JSON until a record is rewritten. Classification ignores them and treats any existing history record as seen. Schema-one `pendingSessions` are obsolete and dropped when normalized state is written.

## Browser Sync State Model

The synchronized ledger uses 17 fixed `chrome.storage.sync` items:

    rtvShadapSyncMeta
    rtvShadapSyncBucket00
    ...
    rtvShadapSyncBucket0f

Meta shape:

    { v: 1, g: generation, r: resetTimestamp }

Bucket shape:

    { v: 1, g: generation, e: [[compactKey, epochDay], ...] }

Compaction examples:

    rtv:786788                  -> r786788
    rtv365:175232950            -> m175232950
    url:/posebno/dolg-naslov    -> u/posebno/dolg-naslov

Limits and safety margins:

- newest 3,000 compact entries at most,
- 16 deterministic hash buckets,
- target at most 7,600 bytes per item,
- target at most 90,000 bytes total,
- fixed keys prevent accumulation of obsolete bucket items.

The targets deliberately stay below Chrome's documented sync quotas. Never increase them to the exact provider limit without accounting for serialization/key overhead and provider differences.

Day-level timestamps are sufficient for convergence/recency and avoid syncing exact reading times. They do not replace the exact timestamps kept locally.

## Stable Article Identity

`src/shared/article-url.ts` produces:

- `rtv:<numeric-id>` for normal RTV articles ending in a numeric ID,
- `rtv365:<recording-id>` for RTV365 cards,
- `url:<normalized-path>` only for clear article-like fallback slugs.

Numeric IDs are preferred because headlines and placement can change while the underlying story stays the same.

Example:

    Homepage /slovenija/example/704321          -> rtv:704321
    Category /svet/renamed-example/704321       -> rtv:704321

Both presentations share one local and synchronized identity.

## Manual Marking Lifecycle

### Passive Page Load

1. Content script starts on an RTV page.
2. Exact-homepage cleanup runs only on `/`.
3. Extractor finds current article/media cards.
4. Local storage provides fast initial rendering.
5. `GET_STATUSES` provides authoritative rendering.
6. No history is written.

### Dynamic DOM Update

1. Mutation observer debounces a rescan.
2. Extractor rebuilds current article/card mappings.
3. Existing history is rendered.
4. No history is written.

### First Popup Button Press

1. Popup loads settings before proceeding.
2. If `syncMode` is `ask`, it presents one native confirmation.
3. Accept stores `browser`; Cancel stores `local`.
4. The choice itself does not mark anything.
5. The normal mark flow then continues.

### Every Successful Popup Button Press

1. Popup checks that the active tab is under `https://www.rtvslo.si/`.
2. Popup sends `MARK_CURRENT_PAGE_SEEN` to that tab.
3. Content script rescans the current DOM.
4. Content script sends all extracted snapshots in `MARK_ARTICLES_SEEN`.
5. Service worker serially writes those keys to full local history.
6. Service worker broadcasts `HISTORY_CHANGED` to open RTV tabs.
7. If browser sync is enabled, sync reconciliation updates the compact ledger.
8. Current and other RTV tabs rerender matching cards.
9. Popup flashes the button green only after the mark operation succeeds.

### Disable

- all custom state attributes/markers are removed,
- homepage cleanup is restored,
- manual mark button is disabled,
- background rejects manual article writes while disabled,
- stored history and sync preference are retained.

## Browser Sync Lifecycle

### Initial Opt-in

1. No remote payload has been read before consent.
2. The device reads the existing ledger after `syncMode` becomes `browser`.
3. If no ledger exists, it creates a generation and uploads compact local history.
4. If a ledger exists, local and remote keys are merged.
5. The merged newest subset is written back; full local history is not capped.

### Normal Convergence

1. A local manual mark is committed locally first.
2. Sync manager builds the compact capped payload.
3. Only changed sync items are written.
4. Other opted-in devices receive a sync storage change.
5. They merge keys into local history and broadcast a rerender.

Concurrent/offline marks converge by union. Duplicate keys keep the latest day in the sync ledger and preserve richer local metadata.

### Reset Generation

1. Reset in browser mode creates a new random generation and exact reset timestamp.
2. Local history is cleared.
3. Meta and all 16 buckets are replaced with that generation and empty entries.
4. Other known-generation devices see the newer reset, discard records last seen before it, and adopt the new generation.
5. Buckets from an old generation are ignored even if provider updates arrive out of order.
6. A device reconnecting with a mark genuinely made after the reset may retain and merge that post-reset record.

The generation is essential. Deleting keys without a generation would allow an offline device to upload its stale union and resurrect the reset history.

### Local-only Mode

- sync payload is neither read nor written by that device,
- full local manual history behaves exactly like version 0.2,
- Reset clears only local history,
- choosing browser sync later joins/merges with the provider ledger.

## Live Detection

Recognized signals include:

- `V živo`,
- `V zivo`,
- `LIVE`.

Detection checks headline text and short badge-like elements/attributes inside the card. It intentionally avoids scanning an entire large section for a weak nearby live word.

Live is orthogonal: a live key can be in history and have status `seen`, while CSS keeps the card fully prominent.

## Homepage Cleanup

Cleanup is not part of all-site marking. It runs only on the exact homepage.

When adding a rule:

1. Use a selector tied to the unwanted block.
2. Exclude known news-card containers.
3. Add a saved-fixture regression test.
4. Confirm `Posebna izdaja` and real article cards remain.
5. Confirm hidden promo links are not extracted into the mark set.

## Privacy and Chrome Web Store

Privacy promise:

- no developer server or account,
- no analytics, ads, telemetry, or remote code,
- full history remains local,
- article history changes only after explicit user action,
- device sync is off until explicit opt-in,
- synchronized data is limited to compact article IDs and day-level timestamps,
- no titles, URLs, HTML, exact reading times, or identity are synchronized,
- developer does not receive or have human access to local or synchronized history.

`STORE_SUBMISSION.md` contains listing, permission, disclosure, and reviewer language. `PRIVACY.md` is the public policy. Any change to payload, consent, retention, or reset semantics must update both.

Chrome Web Store item:

    oeplikfkggjcbekgclpegnblalngbpai

Share URL:

    https://chromewebstore.google.com/detail/rtv-shadap/oeplikfkggjcbekgclpegnblalngbpai

Published history existed through version 0.2.6 before the sync update, and version 0.3.0 introduced browser-native sync. Version 0.3.1 is the current article-page-boundary patch source. Verify the Web Store dashboard, Git tag, and GitHub Release rather than assuming this document proves Store publication.

## Versioning and Release

Use:

- patch for bug fixes and selector/UX tuning,
- minor for meaningful behavior changes such as manual mode or device sync,
- major for a stable public milestone.

For user-visible changes:

1. Update `package.json` and `public/manifest.json` together.
2. Run typecheck, tests, and build.
3. Run `node scripts/package.mjs`.
4. Inspect both ZIP layouts.
5. Use the webstore ZIP for Chrome Web Store.
6. Use the folder-wrapped ZIP for manual unpacked installation.
7. Commit/push/tag only when explicitly requested and the tree is verified.

Artifacts:

    release/rtv-shadap-vX.Y.Z.zip
    release/rtv-shadap-vX.Y.Z-webstore.zip

The Web Store ZIP must have `manifest.json` at its root. The manual ZIP must contain one top-level versioned folder.

## Automated Tests

Core coverage:

- `tests/article-url.test.ts`: stable cross-page article/media identity,
- `tests/extractor.test.ts`: duplicate grouping, fixture extraction, cleanup behavior, promo regression,
- `tests/live-detection.test.ts`: live signal precision,
- `tests/render-stability.test.ts`: idempotent live markers and mutation-loop regression,
- `tests/coalescing-task-runner.test.ts`: serialized/coalesced passive scan execution,
- `tests/repository.test.ts`: explicit marking, no local pruning, metadata, schema migration,
- `tests/sync-manager.test.ts`: compaction, quota margins, key encoding, merge, reset generations,
- `tests/manual-mode.test.ts`: no automatic hooks, popup route/UX, sync permission surface,
- `tests/state.test.ts`: `new`/`seen` and live classification,
- `tests/fixture-sanitization.test.ts`: blocks committed Google API keys.

Static routing tests are not a substitute for a two-device browser test. Preserve the manual checklist when changing sync.

## Manual Regression Checklist

1. Upgrade from 0.2.6 with existing history; existing cards remain seen and the first mark asks for sync choice.
2. Reset history and open the RTV homepage; cards remain new after reload/reopen.
3. Click and middle/Cmd-click articles; clicks alone do not mark them.
4. Press `Do the magic`; the one-time choice appears and the mark continues after either answer.
5. The primary button flashes green even while still hovered.
6. Extracted non-live cards dim immediately and remain dim after reload.
7. Matching stories remain dim on `/slovenija`, `/svet`, and other RTV pages.
8. Mark a category page; its cards become persistent across other RTV pages.
9. Dynamically added cards remain new until the button is pressed again.
10. Live cards stay fully prominent.
11. Homepage promo/RTV365/Sodelujte blocks are hidden; `Posebna izdaja` remains.
12. Category/article pages are not broadly cleaned up.
13. Disable; rendering/cleanup disappear and manual marking is unavailable. Re-enable restores history.
14. Choose local-only; no RTV sync payload is created/read and Reset is local.
15. On two devices in the same browser sync environment, choose browser sync and verify a mark propagates in both directions.
16. Make different marks while both devices are offline; reconnect and verify union convergence.
17. Reset from one synced device; the other clears after sync.
18. Repeat with the second device offline during Reset; reconnect and verify pre-reset history does not return.
19. Mark a story on the offline device after the other device's Reset; reconnect and verify that post-reset mark can survive.
20. Open Options and switch one device to local-only; other devices' shared history remains intact.
21. Open an already-seen article. Its title, hero image, caption, and body remain untouched; seen cards in related/sidebar/lower lists may still dim.
22. Leave a page containing a live card open after a dynamic update; RTV Shadap must settle instead of continuously rescanning or keeping the service worker busy.

## Debugging Playbook

### Button says no RTV page or finds zero articles

Check:

- active tab URL starts with `https://www.rtvslo.si/`,
- content script was refreshed after extension update,
- extractor supports the current page shape,
- links have supported stable identities,
- hidden homepage sections are not the only extracted content.

Use a fresh sanitized fixture before broadening selectors.

### Article is gray on one page but not another

Check:

- both links resolve to the same numeric article ID,
- fallback slug keys normalize consistently,
- the other presentation was extracted as a card,
- live metadata is not intentionally overriding dimming.

### Articles change without a button press

This is a product bug.

Check for:

- any local history mutation outside `MARK_ARTICLES_SEEN`, sync merge, and Reset,
- direct storage writes outside repository/sync manager,
- restored lifecycle or click handlers,
- stale 0.1.x extension code loaded in the browser.

Remote merge may make a card seen without pressing the button on that device, but only because it was explicitly marked on another opted-in device. That is the single intended exception to device-local button causality.

### Sync does not arrive

Check:

- both devices explicitly selected browser sync,
- both installs are the same Web Store extension ID,
- both profiles participate in the same Chrome Sync account or Brave Sync chain,
- Chrome and Brave are not being mixed,
- `rtvShadapSyncMeta` and fixed buckets exist in `chrome.storage.sync`,
- service-worker console has quota/provider errors,
- browser sync has had time to propagate.

Local marking should still succeed during provider failures.

### Old history returns after Reset

Treat this as a sync-generation bug.

Check:

- Reset created a new generation and newer `resetAt`,
- all written buckets carry the same new generation,
- parser ignores old-generation buckets,
- a reconnecting known-generation device filtered pre-reset records before union,
- the returning records were not genuinely marked after Reset.

### Sync quota error

Check serialized bytes for every fixed item and total payload. Preserve margins of 7,600 bytes/item and 90,000 bytes total. Do not solve quota pressure by pruning full local history or syncing titles/URLs.

### A real news card disappears

Likely a cleanup-selector regression. Check `site-cleanup.ts` and the 0.1.3 fixture regression. Never fix it by adding another broad layout selector.

### Local articles eventually become new

This is a product bug unless the user Reset, removed extension storage, or uninstalled. Do not prune full local history. The sync cap limits only what can be reconstructed on another device.

## Known Limitations

- RTV can change DOM selectors at any time.
- The saved full-page fixture dates from 2026-06-30 and needs periodic live validation.
- Extraction marks unique supported cards in the DOM, not only the human-eye viewport.
- A card injected after the button press remains new until another press.
- Fallback slug identity is less stable than numeric identity.
- Browser sync propagation can be delayed or unavailable according to the provider.
- Chrome and Brave do not synchronize RTV Shadap history with each other.
- Every device/profile must opt in independently.
- Only the newest 3,000 identifiers are portable; full local history remains unpruned.
- A newly joined device cannot reconstruct titles/URLs for remote keys until those cards appear locally, which is intentional.
- The extension covers `www.rtvslo.si`, not arbitrary RTV subdomains.
- Very long unpruned history could eventually approach browser local-storage limits. Do not introduce silent expiry without a product decision.

## Quick File Map

    README.md                         User/developer overview
    AGENTS.md                         Short agent invariants
    docs/LLM_HANDOFF.md               Detailed project memory
    STORE_SUBMISSION.md               Chrome Web Store text/disclosures
    PRIVACY.md                        Public privacy policy
    public/manifest.json              MV3 manifest/version/options page
    src/background/history-manager.ts Manual local history transitions
    src/background/repository.ts      Local normalization/mutation queue
    src/background/service-worker.ts  Message and storage coordinator
    src/background/sync-manager.ts    Compact sync/convergence/reset logic
    src/content/content-script.ts     All-site controller/manual action
    src/content/coalescing-task-runner.ts  Serialized/coalesced passive scans
    src/content/extractor.ts          Card extraction and grouping
    src/content/mutation-filter.ts    Extension-owned DOM mutation guard
    src/content/renderer.ts           DOM state attributes/live marker
    src/content/content.css           Dark seen/live visuals
    src/content/site-cleanup.ts       Exact-homepage cleanup
    src/popup/                        Minimal popup and one-time consent
    src/options/                      Persistent sync choice
    src/shared/                       Constants, models, messages, identity
    tests/                            Unit, static, and fixture tests

## If You Are a Future Agent

Before editing:

1. Read `AGENTS.md`, this handoff, and privacy/store docs for data changes.
2. Inspect Git status and preserve user changes.
3. Treat manual-only marking and cross-site stable identity as central invariants.
4. Keep full local history permanent and sync payload compact/capped.
5. Preserve explicit per-device consent and no-account architecture.
6. Preserve generation-based global Reset semantics.
7. Keep homepage cleanup narrow and live cards prominent.
8. Add tests for behavior changes, especially offline/reset races.
9. Run typecheck, tests, build, and package verification.
10. Keep package/manifest versions aligned.

The user's trust depends on predictability: a story becomes seen only through an explicit `Do the magic` action on one of their opted-in devices, and Reset must not be undone by stale offline state.
