# Agent Instructions

This repository is maintained with AI coding agents in mind. Before making non-trivial changes, read:

1. `docs/LLM_HANDOFF.md`
2. `README.md`
3. `STORE_SUBMISSION.md` if the change affects packaging, permissions, privacy, or Chrome Web Store submission
4. `PRIVACY.md` if the change affects data behavior

## Product Invariants

- RTV Shadap exists to make genuinely new RTV SLO homepage stories pop out by quieting already-seen/opened stories.
- The extension must remain limited to the RTV SLO homepage workflow.
- Do not add servers, analytics, telemetry, ads, tracking, remote code, or external APIs.
- Do not use RTV SLO logo assets as extension icons.
- Keep live stories visually prominent.
- Same-tab article clicks must mark only that article as opened and abandon the homepage session. They must not mark all homepage articles as seen.
- Closing the homepage tab commits the homepage session as seen.
- Closing separate article tabs must not affect homepage state.

## Code Orientation

- `src/content/content-script.ts`: homepage controller, mutation scanning, click/lifecycle handling.
- `src/background/session-manager.ts`: session state rules; add tests here for lifecycle changes.
- `src/background/service-worker.ts`: Chrome runtime/tab message routing.
- `src/content/extractor.ts`: RTV article/media extraction.
- `src/content/site-cleanup.ts`: narrow RTV homepage cleanup rules.
- `src/content/content.css`: visual dimming/stripe UX.
- `src/popup/`: popup switch, counts, reset history.

## Change Rules

- Prefer small, targeted changes that preserve the user's browsing workflow.
- Add or update tests for behavior changes.
- If RTV DOM changes, ask for or create a fresh sanitized fixture and update extractor tests.
- Do not broaden selectors or host permissions casually.
- Do not rename storage keys without an explicit migration.
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
