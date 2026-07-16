# RTV Shadap LLM Handoff

This document is the project memory for future coding agents.

Last updated: 2026-07-16.
Current source version: 0.2.6.

## Start Here

RTV Shadap is a Manifest V3 Chrome/Brave extension for all pages under:

    https://www.rtvslo.si/*

The product is a manual read-state tool. It does not infer that the user saw a story from page load, scrolling, clicking, navigation, refresh, tab visibility, or tab closing.

The only operation that adds articles to history is the large popup button:

    Do the magic

When the user presses it, every RTV article or media card currently extracted from the active RTV SLO page is stored as seen. The same stable article key then renders as seen wherever it appears on the RTV SLO site: homepage, category pages, side columns, lower sections, or another page.

History is local to the browser profile and remains until the user resets it or removes extension data.

The exact homepage also retains the narrow cleanup feature that hides selected RTV365/promotional blocks.

## Non-Negotiable Product Rules

1. Manual marking is the only history write.
   Loading, viewing, refreshing, closing, leaving, or returning to an RTV page must not mark any article.

2. Article clicks are not tracked.
   Normal click, Enter, middle click, Cmd/Ctrl click, and new-tab opens must not mutate article history.

3. The popup page-mark button marks all currently extracted cards.
   It must use the content script in the active RTV tab so it marks the actual current DOM, including dynamically injected cards.

4. Seen state follows the stable article key across the site.
   If a story was marked on the homepage, it must be seen on a category page and vice versa.

5. History does not expire or prune automatically.
   “Forever” means until popup reset, extension-data removal, or uninstall. Do not silently reintroduce a record cap.

6. The enable switch controls behavior, not only CSS.
   When disabled, rendering and homepage cleanup disappear and the page-mark button cannot write history.

7. Live stories stay visually prominent.
   A live card may have a seen record, but it must not be dimmed.

8. The content script runs only on the www.rtvslo.si origin.
   The current scope does not include unrelated sites or arbitrary RTV subdomains.

9. Homepage cleanup stays homepage-only.
   Category and article pages get extraction/rendering, not broad page cleanup.

10. No server, telemetry, analytics, ads, tracking, remote code, or external APIs.
    All state stays in chrome.storage.local.

11. Do not use RTV SLO logos as extension icons.
    Current icons are original generated assets.

12. Keep selectors conservative.
    A cleanup rule must never hide a real news card merely because it resembles a banner layout.

## Product Flow

The intended workflow is:

1. Open any page on www.rtvslo.si.
2. Scan its visible news cards.
3. Open the extension popup.
4. Press Do the magic.
5. The extracted non-live cards become visually quiet immediately.
6. Move to another RTV page.
7. Previously marked stories remain quiet there; unmarked stories remain prominent.

Nothing is added to history if step 4 does not happen.

## Historical Context

### Version 0.1 Behavior — Retired

Versions 0.1.x used automatic homepage sessions:

- closing the homepage tab committed all cards as seen,
- clicking an article marked it opened,
- same-tab navigation needed an abandon-session path,
- auto-refresh replacement needed special pending-session handling,
- browser startup reconciled leftover sessions.

That model was deliberately removed for 0.2.0 at the user's request. Do not restore it as a convenience or compatibility behavior.

Old terms such as pending session, opened state, COMMIT_SESSION, ABANDON_SESSION, and MARK_ARTICLE_OPENED describe retired behavior, not current requirements.

### Why the Manual Model Replaced It

The user no longer wanted page closing or any other browser lifecycle signal to gray everything automatically. The desired mental model is now explicit and deterministic:

- no button press means no history change,
- button press means all extracted cards on this page become seen,
- stable identity carries that state across the entire RTV news site.

This removes ambiguity around whether the user actually scanned a page before closing or refreshing it.

### Popup UX

The popup previously went through checkbox, legend, URL instructions, and count-card variants. Count cards were removed because dynamic-page counts were easy to misinterpret.

Current popup priorities are:

- product name,
- Enabled/Disabled switch,
- one large primary manual-mark button,
- reset history.

After a successful manual mark, the primary button briefly flashes green and then returns to blue. The green success state must override the normal blue hover state while the pointer remains over the button. Failures must not show the success flash.

Keep the popup visually limited to those controls. Do not add explanatory copy, operation-status text, or analytics-like counts.

### Visual Tuning

All manually seen cards use a single strong card-level filter derived from the darker pre-0.1.2 middle-click treatment. It adds substantial grayscale and brightness reduction plus dark diagonal stripes. There is no medium-gray tier in the manual model.

Do not add separate descendant opacity rules for headlines, links, summaries, or media. The old mixed treatment produced inconsistent text colors and could compound opacity when nested links and headings both matched. Applying the dark filter once at the card level keeps every part of the card consistent while preserving RTV's original typography hierarchy.

The filter belongs only on the card container. Do not stack filters or opacity on lazy-loaded image/text descendants; that caused both two-stage dimming and inconsistent text intensity in 0.1.x.

### Homepage Cleanup and the 0.1.3 Regression

The user asked to hide selected homepage distractions:

- the standalone RTV365 section,
- standalone promo banners,
- RTV365 banners,
- portal shortcuts such as Skit, Ziv Zav, Cist hudo, and MMC podrobno,
- Sodelujte cards and heading.

Posebna izdaja must remain visible.

Version 0.1.3 fixed a real regression where a broad text-centered/banner-image rule hid legitimate news cards. The fix added a news-card exclusion and source-specific banner matching.

Treat this as important scar tissue:

- never hide by generic layout class alone,
- do not assume an image dimension in a filename makes its enclosing card promotional,
- add a fixture regression test before broadening cleanup.

### Name and Branding

The chosen name is RTV Shadap. Earlier ideas included RTV Novo, RTV Radar, and RTV Digest.

An early icon used an RTV source image. It was replaced because of copyright/trademark concerns. Rebuild current original icons through scripts/generate-icons.mjs.

## Architecture Overview

### public/manifest.json

- Manifest V3.
- Matches https://www.rtvslo.si/*.
- Uses only storage permission and the RTV host permission.
- Version must match package.json.

### src/content/content-script.ts

The all-RTV-page controller:

- extracts article/media cards from the current DOM,
- renders stored statuses,
- observes dynamic DOM mutations,
- handles MARK_CURRENT_PAGE_SEEN from the popup,
- sends MARK_ARTICLES_SEEN to the service worker,
- applies homepage cleanup only when pathname is exactly /,
- removes rendering and cleanup when disabled.

It must not bind article-open tracking or page lifecycle history handlers.

### src/background/service-worker.ts

The only normal writer to chrome.storage.local:

- handles manual mark requests,
- handles settings and history reset,
- returns statuses,
- broadcasts history/settings changes to RTV tabs.

There should be no tabs.onRemoved history commit and no startup pending-session reconciliation.

### src/background/history-manager.ts

Small deterministic history logic:

- markArticlesSeen writes the supplied snapshots,
- getStatuses returns new or seen,
- live stays orthogonal metadata.

### src/background/repository.ts

- normalizes persisted storage,
- serializes mutations through an in-memory promise queue,
- preserves schema-one history during the schema-two upgrade,
- drops obsolete schema-one pending sessions on the next write.

Do not add a second direct storage writer in the popup.

### src/content/extractor.ts

- identifies RTV article and RTV365 media links,
- groups duplicate presentations by stable key,
- finds title, media, and smallest safe card elements,
- ignores content inside homepage-cleanup blocks.

This extractor is reused on homepage, category, and article pages.

### src/content/renderer.ts and content.css

- render new/seen state,
- preserve full emphasis for live cards,
- add a live marker only when the page lacks a native one,
- place grayscale/stripe treatment on the card container.

There is no opened visual state in 0.2.0.

### src/content/site-cleanup.ts

Contains narrow exact-homepage cleanup rules. It may be called by the all-site controller only when location.pathname is /.

### src/popup

- enable/disable switch,
- large Do the magic button,
- large Reset button.

The popup sends a tab message to the active RTV page. It does not extract the page itself and does not write storage directly.

## State Model

Storage key remains:

    rtvNovoState

Do not rename it without a migration; the old internal name is harmless and changing it would lose user history.

Schema two:

    interface StorageState {
      schemaVersion: 2;
      history: Record<string, ArticleHistoryRecord>;
      settings: { enabled: boolean };
    }

History records retain:

- stable key,
- optional numeric article ID,
- canonical URL,
- last title,
- first and last manual-seen timestamps.

Schema-one openedAt fields may remain as extra persisted JSON until a record is rewritten. Current classification ignores them and treats any existing history record as seen.

Schema-one pendingSessions are obsolete and are dropped when normalized state is next written, including on extension update.

## Stable Article Identity

src/shared/article-url.ts produces:

- rtv:<numeric-id> for normal RTV articles ending in a numeric ID,
- rtv365:<recording-id> for RTV365 cards,
- url:<normalized-path> only for clear article-like fallback slugs.

Numeric IDs are preferred because headlines and page placement can change while the underlying story remains the same.

Example:

    Homepage card /slovenija/example/704321 -> rtv:704321
    Category card /svet/renamed-example/704321 -> rtv:704321

Both presentations share one history record.

## Manual Marking Lifecycle

### Passive Page Load

1. Content script starts on an RTV SLO page.
2. Exact homepage cleanup runs only on /.
3. Extractor finds current article/media cards.
4. Local storage provides fast initial rendering.
5. GET_STATUSES provides authoritative rendering.
6. No history is written.

### Dynamic DOM Update

1. Mutation observer debounces a rescan.
2. Extractor rebuilds current article/card mappings.
3. Existing history is rendered.
4. No history is written.

### Popup Button Press

1. Popup checks that the active tab is under https://www.rtvslo.si/.
2. Popup sends MARK_CURRENT_PAGE_SEEN to that tab.
3. Content script rescans the current DOM.
4. Content script sends all extracted snapshots in MARK_ARTICLES_SEEN.
5. Service worker serially writes those keys to history.
6. Service worker broadcasts HISTORY_CHANGED to all open RTV tabs.
7. Current and other RTV tabs rerender matching cards.
8. Popup reports how many unique article keys were marked.

### Disable

- all custom state attributes/markers are removed,
- homepage cleanup is restored,
- manual mark button is disabled,
- background rejects manual article writes while disabled.

### Reset

- history becomes empty,
- all open RTV tabs rerender,
- no current-page articles are automatically re-added.

## Live Detection

Recognized signals include:

- V živo,
- V zivo,
- LIVE.

Detection checks headline text and short badge-like elements/attributes inside the card. It intentionally avoids scanning an entire large section for a weak nearby live word.

Live is orthogonal:

- a live key can be in history,
- status may be seen,
- CSS must still keep the card fully prominent.

## Homepage Cleanup

Cleanup is intentionally not part of all-site marking. It runs only on the exact homepage.

When adding a rule:

1. Use a selector tied to the unwanted block.
2. Exclude known news-card containers.
3. Add a saved-fixture regression test.
4. Confirm Posebna izdaja and real article cards remain.
5. Confirm hidden promo links are not extracted into the manual-mark set.

## Privacy and Chrome Web Store

Privacy promise:

- no collection or transmission,
- no server,
- no analytics,
- no ads,
- no telemetry,
- no remote code,
- local storage only,
- article history changes only after explicit user action.

STORE_SUBMISSION.md contains listing and permission language. PRIVACY.md is the public policy.

Chrome Web Store item:

    oeplikfkggjcbekgclpegnblalngbpai

Share URL:

    https://chromewebstore.google.com/detail/rtv-shadap/oeplikfkggjcbekgclpegnblalngbpai

Historical published tags existed through v0.1.3 before the manual redesign. Version 0.2.6 is the prepared release for the new manual workflow. Always verify the current Web Store dashboard state rather than trusting historical status.

## Versioning and Release

Use:

- patch for bug fixes and selector/UX tuning,
- minor for meaningful behavior changes such as the 0.2.0 manual model,
- major for a stable public milestone.

For user-visible changes:

1. Update package.json and public/manifest.json together.
2. Run typecheck, tests, and build.
3. Run node scripts/package.mjs.
4. Use the webstore zip for Chrome Web Store.
5. Use the folder-wrapped zip for manual unpacked installation.
6. Tag vX.Y.Z when making a GitHub Release.

Artifacts:

    release/rtv-shadap-vX.Y.Z.zip
    release/rtv-shadap-vX.Y.Z-webstore.zip

The Web Store zip must have manifest.json at its root.

## Automated Tests

Core coverage:

- tests/article-url.test.ts: stable cross-page article/media identity,
- tests/extractor.test.ts: duplicate grouping, real fixture extraction, cleanup behavior, promo regression,
- tests/live-detection.test.ts: live signal precision,
- tests/repository.test.ts: explicit-only marking, no pruning, metadata updates, schema-one migration,
- tests/state.test.ts: new/seen and live classification,
- tests/fixture-sanitization.test.ts: blocks committed Google API keys.

If message routing or popup behavior changes, add tests where practical and keep the manual checklist.

## Manual Regression Checklist

1. Reset history.
2. Open the RTV homepage; cards are not dimmed.
3. Reload, close/reopen, switch tabs, and navigate away/back; no card becomes seen automatically.
4. Click an article normally, go Back; the click alone did not mark it.
5. Middle/Cmd-click an article; the click alone did not mark it.
6. Press Do the magic; extracted cards dim immediately.
7. Reload; marked cards remain dimmed.
8. Open a category such as /slovenija or /svet; matching stories remain dimmed there.
9. Press the button on a category page; its cards become persistent across other RTV pages.
10. Dynamically added cards remain new until the button is pressed again.
11. Live cards stay fully prominent.
12. Homepage promo/RTV365/Sodelujte sections are hidden; Posebna izdaja remains.
13. Category and article pages are not broadly cleaned up.
14. Disable the extension; rendering and cleanup disappear and manual marking is unavailable.
15. Re-enable; stored manual history renders again.
16. Reset history; all normal cards return to new.

## Debugging Playbook

### Button says no RTV page

Check:

- active tab URL starts with https://www.rtvslo.si/,
- content script is present after extension update/reload,
- the page was refreshed after loading a new unpacked build.

### Button finds zero articles

Check:

- extractor returns cards for the current page shape,
- links have supported RTV identities,
- title extraction returns non-empty text,
- hidden homepage sections are not the only content present.

Use a fresh sanitized fixture before broadening selectors.

### Article is gray on one page but not another

Check:

- both links resolve to the same numeric article ID,
- fallback slug keys are normalized consistently,
- the other presentation was extracted as a card,
- live metadata is not intentionally overriding dimming.

### Articles change without a button press

This is a product bug.

Check for:

- any history mutation outside MARK_ARTICLES_SEEN,
- direct storage writes outside Repository/service worker,
- restored lifecycle or click handlers,
- stale 0.1.x extension code still loaded in the browser.

### A real news card disappears

Likely a cleanup-selector regression.

Check site-cleanup.ts and the 0.1.3 regression test. Never fix this by adding another broad layout selector.

### Marked articles eventually become new

This is also a product bug unless the user reset history or browser storage was removed.

Do not prune automatically. If storage growth ever becomes a real problem, design a compact migration or ask the user before changing retention semantics.

## Known Limitations

- RTV can change DOM selectors at any time.
- The saved full-page fixture dates from 2026-06-30 and needs periodic live validation.
- Extraction marks unique supported cards in the DOM, not a human-eye visibility viewport.
- A dynamically injected card that appears after the button press remains new until the button is pressed again.
- Fallback slug identity is less stable than numeric ID identity.
- Storage is local per browser profile and does not sync across devices.
- The extension does not cover arbitrary RTV subdomains; current scope is www.rtvslo.si.
- Very long unpruned history could eventually approach browser local-storage limits. Do not solve that by silent expiry.

## Quick File Map

    README.md                         User/developer overview
    AGENTS.md                         Short agent invariants
    docs/LLM_HANDOFF.md               Project memory
    STORE_SUBMISSION.md               Chrome Web Store text
    PRIVACY.md                        Public privacy policy
    public/manifest.json              MV3 manifest/version
    src/background/history-manager.ts Manual history transitions
    src/background/repository.ts      Storage normalization/queue
    src/background/service-worker.ts  Only storage writer/message router
    src/content/content-script.ts     All-site controller/manual action
    src/content/extractor.ts          Card extraction and grouping
    src/content/renderer.ts           DOM state attributes/live marker
    src/content/content.css           Seen/live visuals
    src/content/site-cleanup.ts       Exact-homepage cleanup
    src/popup/                        Switch, manual mark, reset
    src/shared/                       Constants, models, messages, identity
    tests/                            Unit and fixture tests

## If You Are A Future Agent

Before editing:

1. Read AGENTS.md and this handoff.
2. Inspect git status and preserve user changes.
3. Treat manual-only marking as the central invariant.
4. Keep cross-page stable identity intact.
5. Keep homepage cleanup narrow.
6. Add tests for behavior changes.
7. Run typecheck, tests, and build.
8. Bump both versions and package user-visible changes correctly.

The user's trust now depends on absolute predictability: nothing becomes gray unless the user presses the button.
