# Agent Instructions

This repository is maintained with AI coding agents in mind. Before making non-trivial changes, read:

1. `docs/LLM_HANDOFF.md`
2. `README.md`
3. `STORE_SUBMISSION.md` if the change affects packaging, permissions, privacy, or Chrome Web Store submission
4. `PRIVACY.md` if the change affects data behavior

## Product Invariants

- RTV Shadap is a manual read-state tool for news cards across `https://www.rtvslo.si/*`.
- Merely loading, viewing, closing, refreshing, or leaving an RTV page must never add articles to history.
- Clicking an article must never add it to history.
- Only the popup action `Do the magic` may mark the currently extracted page articles as seen.
- A manually marked article must render as seen everywhere on RTV SLO where the same stable article key appears.
- Only news/media cards may be dimmed. The body, hero image, and prose of an opened article must always remain visually untouched.
- Full manually marked history remains local and persistent until the user resets it or removes extension data; do not expire or prune local history automatically.
- Browser-native device sync is opt-in. Never read or write `chrome.storage.sync` before the user chooses browser sync.
- Sync only compact article keys and day-level timestamps. Never sync titles, canonical URLs, page HTML, or analytics.
- The synchronized ledger may retain only the newest 3,000 keys to respect browser quotas; this must never prune full local history.
- When browser sync is enabled, Reset is global and must use the reset generation to stop stale offline devices from resurrecting history.
- Keep live stories visually prominent even when their stable key is in history.
- Rendering must settle after extension-owned DOM updates; never let the mutation observer rescan in response to RTV Shadap's own markers.
- The enable switch controls both rendering and manual marking. When disabled, do not write article history.
- Homepage cleanup remains limited to the exact RTV SLO homepage. Do not turn it into a generic ad blocker.
- Do not add developer-operated servers, analytics, telemetry, ads, tracking, remote code, OAuth, or external APIs. Browser-native sync is the only approved transmission path.
- Do not use RTV SLO logo assets as extension icons.

## Code Orientation

- `src/content/content-script.ts`: all-RTV-page controller, mutation scanning, rendering, and manual page-mark action.
- `src/background/history-manager.ts`: manual history transitions and status classification.
- `src/background/service-worker.ts`: runtime router and coordinator for the only local/sync storage writers.
- `src/background/sync-manager.ts`: compact browser-sync ledger, convergence, quota limits, and reset generations.
- `src/background/repository.ts`: storage normalization and serialized mutations.
- `src/content/extractor.ts`: RTV article/media extraction and stable-key grouping.
- `src/content/site-cleanup.ts`: narrow exact-homepage cleanup rules.
- `src/content/content.css`: seen/live visual treatment.
- `src/popup/`: enable switch, large manual page-mark button, and reset history.
- `src/options/`: persistent browser-sync/local-only preference.

## Change Rules

- Prefer small, targeted changes that preserve the manual-only history rule.
- Add or update tests for behavior changes.
- If RTV DOM changes, ask for or create a fresh sanitized fixture and update extractor tests.
- Do not broaden selectors or host permissions casually.
- Do not rename storage keys without an explicit migration.
- Treat changes to sync payloads, consent, retention, or reset semantics as privacy-sensitive and update `PRIVACY.md`, `STORE_SUBMISSION.md`, and the handoff.
- Keep `package.json` and `public/manifest.json` versions aligned.
- For user-visible extension changes, bump the version before packaging or Web Store upload.
- Docs-only changes do not require a version bump.

## Verification

Run when feasible:

```sh
pnpm typecheck
pnpm test
pnpm build
```

For release packaging:

```sh
node scripts/package.mjs
```

Use `release/rtv-shadap-vX.Y.Z.zip` for manual unpacked installs.
Use `release/rtv-shadap-vX.Y.Z-webstore.zip` for Chrome Web Store upload.
