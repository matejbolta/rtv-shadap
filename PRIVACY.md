# Privacy Policy

Last updated: July 16, 2026.

RTV Shadap does not operate a server, user-account system, analytics, advertising, telemetry, or remote code. The developer does not receive or have access to users' article history.

The extension runs only on `https://www.rtvslo.si/*`. When the user presses **Do the magic**, it stores the stable identifiers, canonical URLs, last known titles, and timestamps of the article cards found on that page in `chrome.storage.local`. This full history remains inside that browser profile and is used only to render the same stories as seen on RTV SLO.

## Optional browser sync

Device sync is off until the user explicitly chooses it in the one-time prompt or extension Options page. It requires no RTV Shadap account, Google OAuth, email address, or developer-operated service.

When enabled, RTV Shadap writes only a compact ledger containing stable RTV article identifiers and day-level seen timestamps to `chrome.storage.sync`. It does not sync article titles, canonical URLs, page content, screenshots, or analytics. The synchronized ledger is capped at the newest 3,000 identifiers to stay within browser quotas; the complete local history is not pruned by this cap.

The user's browser provider transports and stores `chrome.storage.sync` data according to the user's existing browser-sync configuration. Chrome may use Chrome Sync for signed-in profiles; Brave may use a Brave Sync chain. RTV Shadap cannot read the user's browser account, sync identity, credentials, or data belonging to other extensions or users.

Users who choose local-only mode do not have RTV Shadap history written to `chrome.storage.sync` on that device. They can change this choice from the extension Options page.

Changing one device to local-only stops that device from participating in future synchronization, but does not erase a ledger already shared with other devices. To delete shared history, the user can select **Reset** while browser sync is enabled and then change devices to local-only.

## Retention and deletion

Local history remains until the user selects **Reset**, removes the extension's data, or uninstalls the extension. When browser sync is enabled, **Reset** also replaces the synchronized ledger with an empty reset generation so opted-in devices clear old history and offline devices cannot restore it later.

RTV Shadap does not sell, share, monetize, or permit human access to article history. It uses the data only for its user-facing manual read-state and optional device-sync features.

RTV Shadap's use of information complies with the Chrome Web Store User Data Policy, including the Limited Use requirements. Data is used only to provide or improve the extension's disclosed single purpose and is never used for advertising, profiling, credit decisions, or unrelated purposes.

RTV Shadap is an independent browser extension and is not affiliated with RTV SLO.
