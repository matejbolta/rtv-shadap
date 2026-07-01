import type { RuntimeMessage, RuntimeResponse } from "../shared/messages";
import { isRuntimeMessage } from "../shared/messages";
import { sendTabMessage, storageSet } from "../shared/chrome-api";
import { LATEST_COUNTS_KEY } from "../shared/constants";
import type { PageCounts } from "../shared/models";
import { Repository } from "./repository";
import {
  abandonSession,
  commitSession,
  commitSessionsForTab,
  countStatuses,
  getStatuses,
  markArticleOpened,
  reconcileLeftoverPendingSessions,
  startOrReplaceSession,
  mergeSnapshot
} from "./session-manager";

const repository = new Repository();
const latestCountsByTab = new Map<number, PageCounts>();

function rememberCounts(state: { latestPage?: { tabId: number; updatedAt: number; counts: PageCounts } }, tabId: number, counts: PageCounts): void {
  latestCountsByTab.set(tabId, counts);
  state.latestPage = { tabId, updatedAt: Date.now(), counts };
  void storageSet({ [LATEST_COUNTS_KEY]: counts });
}

chrome.runtime.onInstalled.addListener(() => {
  void repository.mutate((state) => {
    state.settings.enabled = state.settings.enabled !== false;
  });
});

chrome.runtime.onStartup.addListener(() => {
  void repository.mutate((state) => reconcileLeftoverPendingSessions(state, Date.now()));
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void repository.mutate((state) => {
    commitSessionsForTab(state, tabId, Date.now());
  }).then(broadcastHistoryChanged);
  latestCountsByTab.delete(tabId);
});

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  void handleMessage(message, sender).then(sendResponse);
  return true;
});

async function handleMessage(message: unknown, sender: chrome.runtime.MessageSender): Promise<RuntimeResponse> {
  if (!isRuntimeMessage(message)) return { ok: false, error: "Invalid message" };
  const tabId = sender.tab?.id;
  try {
    switch (message.type) {
      case "START_SESSION":
        if (tabId == null) return { ok: false, error: "Missing tab" };
        return repository.mutate((state) => {
          if (!state.settings.enabled) return { ok: true as const, enabled: false, statuses: [] };
          startOrReplaceSession(state, tabId, message.sessionId, message.articles, Date.now());
          const statuses = getStatuses(state, message.articles);
          rememberCounts(state, tabId, countStatuses(statuses));
          return { ok: true as const, enabled: true, statuses };
        });
      case "UPDATE_SESSION_SNAPSHOT":
        if (tabId == null) return { ok: false, error: "Missing tab" };
        return repository.mutate((state) => {
          if (!state.settings.enabled) return { ok: true as const, enabled: false, statuses: [] };
          mergeSnapshot(state, tabId, message.sessionId, message.articles, Date.now());
          rememberCounts(state, tabId, message.counts);
          return { ok: true as const, enabled: true, statuses: getStatuses(state, message.articles) };
        });
      case "MARK_ARTICLE_OPENED":
        if (tabId == null) return { ok: false, error: "Missing tab" };
        return repository.mutate((state) => {
          const timestamp = Date.now();
          markArticleOpened(state, tabId, message.sessionId, message.article, timestamp);
          if (message.abandonSession) abandonSession(state, tabId, message.sessionId, timestamp);
          return { ok: true as const, enabled: state.settings.enabled, statuses: getStatuses(state, [message.article]) };
        }).then((response) => {
          broadcastHistoryChanged();
          return response;
        });
      case "COMMIT_SESSION":
        if (tabId == null) return { ok: false, error: "Missing tab" };
        return repository.mutate((state) => {
          commitSession(state, tabId, message.sessionId, Date.now());
          return { ok: true as const, enabled: state.settings.enabled };
        }).then((response) => {
          broadcastHistoryChanged();
          return response;
        });
      case "ABANDON_SESSION":
        if (tabId == null) return { ok: false, error: "Missing tab" };
        return repository.mutate((state) => {
          abandonSession(state, tabId, message.sessionId, Date.now());
          return { ok: true as const, enabled: state.settings.enabled };
        });
      case "GET_SETTINGS":
        return repository.read().then((state) => ({
          ok: true as const,
          enabled: state.settings.enabled
        }));
      case "GET_STATUSES":
        return repository.read().then((state) => ({
          ok: true as const,
          enabled: state.settings.enabled,
          statuses: getStatuses(state, message.articles)
        }));
      case "GET_PAGE_COUNTS":
        return repository.read().then((state) => {
          const requestedTabId = message.tabId ?? tabId;
          const fallbackCounts = state.latestPage?.counts ?? Array.from(latestCountsByTab.values()).at(-1) ?? null;
          return {
            ok: true as const,
            enabled: state.settings.enabled,
            counts: requestedTabId == null ? fallbackCounts : latestCountsByTab.get(requestedTabId) ?? fallbackCounts
          };
        });
      case "SET_ENABLED":
        return repository.mutate((state) => {
          state.settings.enabled = message.enabled;
          return { ok: true as const, enabled: state.settings.enabled };
        }).then((response) => {
          broadcastToHomepageTabs({ type: "SETTINGS_CHANGED", enabled: message.enabled });
          return response;
        });
      case "RESET_HISTORY":
        return repository.mutate((state) => {
          state.history = {};
          state.pendingSessions = {};
          state.latestPage = undefined;
          return { ok: true as const, enabled: state.settings.enabled };
        }).then((response) => {
          void storageSet({ [LATEST_COUNTS_KEY]: { new: 0, seen: 0, opened: 0, live: 0 } });
          broadcastHistoryChanged();
          return response;
        });
      default:
        return { ok: false, error: "Unsupported message" };
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

function broadcastHistoryChanged(): void {
  broadcastToHomepageTabs({ type: "HISTORY_CHANGED" });
}

function broadcastToHomepageTabs(message: { type: "HISTORY_CHANGED" } | { type: "SETTINGS_CHANGED"; enabled: boolean }): void {
  for (const tabId of latestCountsByTab.keys()) {
    sendTabMessage(tabId, message).catch(() => undefined);
  }
}
