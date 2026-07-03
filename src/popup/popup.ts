import type { RuntimeMessage, RuntimeResponse } from "../shared/messages";
import { STORAGE_KEY } from "../shared/constants";
import { queryTabs, sendRuntimeMessage, sendTabMessage, storageGet, storageSet } from "../shared/chrome-api";
import type { StorageState } from "../shared/models";

const enabledSwitch = document.querySelector<HTMLButtonElement>("#enabled-switch");
const resetButton = document.querySelector<HTMLButtonElement>("#reset");
const enabledLabel = document.querySelector<HTMLElement>("#enabled-label");

void refresh();

enabledSwitch?.addEventListener("click", () => {
  const nextEnabled = enabledSwitch.getAttribute("aria-checked") !== "true";
  setEnabledUi(nextEnabled);
  enabledSwitch.disabled = true;
  void setEnabled(nextEnabled)
    .finally(() => {
      if (enabledSwitch) enabledSwitch.disabled = false;
    });
});

resetButton?.addEventListener("click", () => {
  if (!confirm("Res ponastavim zgodovino RTV Shadap?")) return;
  void sendMessage({ type: "RESET_HISTORY" }).then(refresh);
});

async function refresh(): Promise<void> {
  const settings = await sendMessage({ type: "GET_SETTINGS" });
  if (settings.ok) setEnabledUi(settings.enabled);
}

async function setEnabled(enabled: boolean): Promise<void> {
  const response = await sendMessage({ type: "SET_ENABLED", enabled });
  if (!response.ok || response.enabled !== enabled) {
    await writeEnabledFallback(enabled);
  }
  setEnabledUi(enabled);
  const activeTab = await getActiveTab();
  if (activeTab?.id != null) {
    await sendTabMessage(activeTab.id, { type: "SETTINGS_CHANGED", enabled }).catch(() => undefined);
  }
}

function setEnabledUi(enabled: boolean): void {
  if (enabledSwitch) enabledSwitch.setAttribute("aria-checked", String(enabled));
  setText(enabledLabel, enabled ? "Aktivno" : "Izklopljeno");
}

function setText(element: HTMLElement | null, value: number | string): void {
  if (element) element.textContent = String(value);
}

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  try {
    const tabs = await queryTabs({ active: true, currentWindow: true });
    return tabs[0];
  } catch {
    return undefined;
  }
}

function sendMessage(message: RuntimeMessage): Promise<RuntimeResponse> {
  return sendRuntimeMessage<RuntimeResponse>(message).catch((error) => ({
    ok: false,
    error: error instanceof Error ? error.message : "Message failed"
  }));
}

async function writeEnabledFallback(enabled: boolean): Promise<void> {
  const result = await storageGet(STORAGE_KEY);
  const current = result[STORAGE_KEY] as Partial<StorageState> | undefined;
  const next: StorageState = {
    schemaVersion: 1,
    history: current?.history ?? {},
    pendingSessions: current?.pendingSessions ?? {},
    settings: { ...(current?.settings ?? { enabled: true }), enabled }
  };
  await storageSet({ [STORAGE_KEY]: next });
}
