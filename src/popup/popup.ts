import type { RuntimeMessage, RuntimeResponse } from "../shared/messages";
import { LATEST_COUNTS_KEY, STORAGE_KEY } from "../shared/constants";
import { queryTabs, sendRuntimeMessage, sendTabMessage, storageGet, storageSet } from "../shared/chrome-api";
import type { PageCounts, StorageState } from "../shared/models";

const enabledSwitch = document.querySelector<HTMLButtonElement>("#enabled-switch");
const resetButton = document.querySelector<HTMLButtonElement>("#reset");
const countNew = document.querySelector<HTMLElement>("#count-new");
const countSeen = document.querySelector<HTMLElement>("#count-seen");
const countOpened = document.querySelector<HTMLElement>("#count-opened");
const countLive = document.querySelector<HTMLElement>("#count-live");
const enabledLabel = document.querySelector<HTMLElement>("#enabled-label");

void refresh();

enabledSwitch?.addEventListener("click", () => {
  const nextEnabled = enabledSwitch.getAttribute("aria-checked") !== "true";
  setEnabledUi(nextEnabled);
  enabledSwitch.disabled = true;
  void setEnabled(nextEnabled)
    .finally(() => {
      if (enabledSwitch) enabledSwitch.disabled = false;
      void refreshCountsOnly();
    });
});

resetButton?.addEventListener("click", () => {
  if (!confirm("Res ponastavim zgodovino RTV Shadap?")) return;
  void sendMessage({ type: "RESET_HISTORY" }).then(refresh);
});

async function refresh(): Promise<void> {
  const settings = await sendMessage({ type: "GET_SETTINGS" });
  if (settings.ok) setEnabledUi(settings.enabled);
  await refreshCountsOnly();
}

async function refreshCountsOnly(): Promise<void> {
  const activeTab = await getActiveTab();
  const liveCounts = await getLiveContentCounts(activeTab?.id);
  const response = await sendMessage({ type: "GET_PAGE_COUNTS", tabId: activeTab?.id });
  const storedCounts = await getStoredCounts();
  const counts = liveCounts ?? (response.ok && "counts" in response ? response.counts : null) ?? storedCounts;
  if (counts) {
    setCounts(counts);
  } else {
    setCounts({ new: 0, seen: 0, opened: 0, live: 0 });
  }
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

function setCounts(counts: PageCounts): void {
  setText(countNew, counts.new);
  setText(countSeen, counts.seen);
  setText(countOpened, counts.opened);
  setText(countLive, counts.live);
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

async function getLiveContentCounts(tabId: number | undefined): Promise<{ new: number; seen: number; opened: number; live: number } | null> {
  if (tabId == null) return null;
  try {
    const response = await sendTabMessage<{ counts?: { new: number; seen: number; opened: number; live: number } }>(tabId, { type: "REQUEST_PAGE_COUNTS" });
    return response?.counts ?? null;
  } catch {
    return null;
  }
}

async function getStoredCounts(): Promise<PageCounts | null> {
  try {
    const result = await storageGet(STORAGE_KEY);
    const latestResult = await storageGet(LATEST_COUNTS_KEY);
    if (latestResult[LATEST_COUNTS_KEY]) return latestResult[LATEST_COUNTS_KEY] as PageCounts;
    const state = result[STORAGE_KEY] as Partial<StorageState> | undefined;
    return state?.latestPage?.counts ?? null;
  } catch {
    return null;
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
    settings: { ...(current?.settings ?? { enabled: true }), enabled },
    latestPage: current?.latestPage
  };
  await storageSet({ [STORAGE_KEY]: next });
}
