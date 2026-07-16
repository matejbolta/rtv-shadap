import type { RuntimeMessage, RuntimeResponse, TabResponse } from "../shared/messages";
import { queryTabs, sendRuntimeMessage, sendTabMessage } from "../shared/chrome-api";

const enabledSwitch = document.querySelector<HTMLButtonElement>("#enabled-switch");
const markPageButton = document.querySelector<HTMLButtonElement>("#mark-page");
const resetButton = document.querySelector<HTMLButtonElement>("#reset");
const enabledLabel = document.querySelector<HTMLElement>("#enabled-label");

let enabled = true;
let successTimer: number | undefined;

void refresh();

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
  if (!confirm("Reset RTV Shadap history?")) return;
  resetButton.disabled = true;
  void sendMessage({ type: "RESET_HISTORY" }).finally(() => {
    if (resetButton) resetButton.disabled = false;
  });
});

async function refresh(): Promise<void> {
  const settings = await sendMessage({ type: "GET_SETTINGS" });
  if (settings.ok) setEnabledUi(settings.enabled);
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
  if (!enabled || !markPageButton) return;
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
