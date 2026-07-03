import type { RuntimeMessage, RuntimeResponse } from "../shared/messages";
import { isRuntimeMessage } from "../shared/messages";
import { queryTabs, sendTabMessage } from "../shared/chrome-api";
import { HOMEPAGE_ORIGIN } from "../shared/constants";
import { Repository } from "./repository";
import {
  abandonSession,
  commitSession,
  commitSessionsForTab,
  getStatuses,
  markArticleOpened,
  reconcileLeftoverPendingSessions,
  startOrReplaceSession,
  mergeSnapshot
} from "./session-manager";

const repository = new Repository();

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
          return { ok: true as const, enabled: true, statuses };
        });
      case "UPDATE_SESSION_SNAPSHOT":
        if (tabId == null) return { ok: false, error: "Missing tab" };
        return repository.mutate((state) => {
          if (!state.settings.enabled) return { ok: true as const, enabled: false, statuses: [] };
          mergeSnapshot(state, tabId, message.sessionId, message.articles, Date.now());
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
      case "SET_ENABLED":
        return repository.mutate((state) => {
          state.settings.enabled = message.enabled;
          return { ok: true as const, enabled: state.settings.enabled };
        }).then((response) => {
          void broadcastToHomepageTabs({ type: "SETTINGS_CHANGED", enabled: message.enabled });
          return response;
        });
      case "RESET_HISTORY":
        return repository.mutate((state) => {
          state.history = {};
          state.pendingSessions = {};
          return { ok: true as const, enabled: state.settings.enabled };
        }).then((response) => {
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
  void broadcastToHomepageTabs({ type: "HISTORY_CHANGED" });
}

async function broadcastToHomepageTabs(message: { type: "HISTORY_CHANGED" } | { type: "SETTINGS_CHANGED"; enabled: boolean }): Promise<void> {
  const tabs = await queryTabs({ url: `${HOMEPAGE_ORIGIN}/*` }).catch(() => []);
  for (const tab of tabs) {
    if (tab.id != null) sendTabMessage(tab.id, message).catch(() => undefined);
  }
}
