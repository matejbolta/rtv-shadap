import type { RuntimeMessage, RuntimeResponse, TabResponse } from "../shared/messages";
import type { SyncMode } from "../shared/models";
import { queryTabs, sendRuntimeMessage, sendTabMessage } from "../shared/chrome-api";

const enabledSwitch = document.querySelector<HTMLButtonElement>("#enabled-switch");
const markPageButton = document.querySelector<HTMLButtonElement>("#mark-page");
const resetButton = document.querySelector<HTMLButtonElement>("#reset");
const enabledLabel = document.querySelector<HTMLElement>("#enabled-label");

let enabled = true;
let syncMode: SyncMode = "ask";
let successTimer: number | undefined;

const settingsReady = refresh();

enabledSwitch?.addEventListener("click", () => {
  const nextEnabled = enabledSwitch.getAttribute("aria-checked") !== "true";
  setEnabledUi(nextEnabled);
  enabledSwitch.disabled = true;
  void setEnabled(nextEnabled).finally(() => {
    if (enabledSwitch) enabledSwitch.disabled = false;
  });
});

markPageButton?.addEventListener("click", () => {
  void markCurrentPageSeen();
});

resetButton?.addEventListener("click", () => {
  void resetHistory();
});

async function refresh(): Promise<void> {
  const settings = await sendMessage({ type: "GET_SETTINGS" });
  if (settings.ok) {
    setEnabledUi(settings.enabled);
    if ("syncMode" in settings) syncMode = settings.syncMode;
  }
}

async function setEnabled(nextEnabled: boolean): Promise<void> {
  const response = await sendMessage({ type: "SET_ENABLED", enabled: nextEnabled });
  if (!response.ok) {
    setEnabledUi(!nextEnabled);
    return;
  }
  setEnabledUi(response.enabled);
}

async function markCurrentPageSeen(): Promise<void> {
  if (!markPageButton) return;
  await settingsReady;
  if (!enabled) return;
  await ensureSyncChoice();
  window.clearTimeout(successTimer);
  markPageButton.classList.remove("is-success");
  markPageButton.disabled = true;
  markPageButton.classList.add("is-working");
  try {
    const activeTab = await getActiveTab();
    if (activeTab?.id == null || (activeTab.url != null && !activeTab.url.startsWith("https://www.rtvslo.si/"))) {
      return;
    }
    const response = await sendTabMessage<TabResponse>(activeTab.id, { type: "MARK_CURRENT_PAGE_SEEN" });
    if (!response.ok) return;
    flashSuccess();
  } catch {
    // Keep the popup intentionally minimal; the page remains unchanged on failure.
  } finally {
    markPageButton.classList.remove("is-working");
    markPageButton.disabled = !enabled;
  }
}

async function ensureSyncChoice(): Promise<void> {
  if (syncMode !== "ask") return;
  const useBrowserSync = confirm(
    "Sync marked RTV article IDs across your devices using your browser's built-in sync? "
    + "No RTV Shadap account is needed, and no data is sent to us. Choose Cancel to keep this device local-only."
  );
  const nextMode = useBrowserSync ? "browser" : "local";
  const response = await sendMessage({ type: "SET_SYNC_MODE", syncMode: nextMode });
  if (response.ok && "syncMode" in response) syncMode = response.syncMode;
  else syncMode = "local";
}

async function resetHistory(): Promise<void> {
  await settingsReady;
  const message = syncMode === "browser"
    ? "Reset RTV Shadap history on all synced devices?"
    : "Reset RTV Shadap history on this device?";
  if (!confirm(message) || !resetButton) return;
  resetButton.disabled = true;
  await sendMessage({ type: "RESET_HISTORY" });
  resetButton.disabled = false;
}

function flashSuccess(): void {
  if (!markPageButton) return;
  window.clearTimeout(successTimer);
  markPageButton.classList.add("is-success");
  successTimer = window.setTimeout(() => {
    markPageButton.classList.remove("is-success");
  }, 900);
}

function setEnabledUi(nextEnabled: boolean): void {
  enabled = nextEnabled;
  if (enabledSwitch) enabledSwitch.setAttribute("aria-checked", String(nextEnabled));
  if (markPageButton) markPageButton.disabled = !nextEnabled;
  setText(enabledLabel, nextEnabled ? "Enabled" : "Disabled");
}

function setText(element: HTMLElement | null, value: string): void {
  if (element) element.textContent = value;
}

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const tabs = await queryTabs({ active: true, currentWindow: true });
  return tabs[0];
}

function sendMessage(message: RuntimeMessage): Promise<RuntimeResponse> {
  return sendRuntimeMessage<RuntimeResponse>(message).catch((error) => ({
    ok: false,
    error: error instanceof Error ? error.message : "Message failed"
  }));
}
