import type { RuntimeMessage, RuntimeResponse } from "../shared/messages";
import { isRuntimeMessage } from "../shared/messages";
import { queryTabs, sendTabMessage } from "../shared/chrome-api";
import { HOMEPAGE_ORIGIN } from "../shared/constants";
import { Repository } from "./repository";
import { getStatuses, markArticlesSeen } from "./history-manager";

const repository = new Repository();

chrome.runtime.onInstalled.addListener(() => {
  void repository.mutate((state) => {
    state.settings.enabled = state.settings.enabled !== false;
  });
});

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  void handleMessage(message).then(sendResponse);
  return true;
});

async function handleMessage(message: unknown): Promise<RuntimeResponse> {
  if (!isRuntimeMessage(message)) return { ok: false, error: "Invalid message" };
  try {
    switch (message.type) {
      case "MARK_ARTICLES_SEEN":
        return repository.mutate((state) => {
          if (!state.settings.enabled) return { ok: false as const, error: "RTV Shadap je izklopljen." };
          markArticlesSeen(state, message.articles, Date.now());
          return {
            ok: true as const,
            enabled: true,
            markedCount: message.articles.length,
            statuses: getStatuses(state, message.articles)
          };
        }).then((response) => {
          if (response.ok) broadcastHistoryChanged();
          return response;
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
          void broadcastToRtvTabs({ type: "SETTINGS_CHANGED", enabled: message.enabled });
          return response;
        });
      case "RESET_HISTORY":
        return repository.mutate((state) => {
          state.history = {};
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
  void broadcastToRtvTabs({ type: "HISTORY_CHANGED" });
}

async function broadcastToRtvTabs(message: { type: "HISTORY_CHANGED" } | { type: "SETTINGS_CHANGED"; enabled: boolean }): Promise<void> {
  const tabs = await queryTabs({ url: `${HOMEPAGE_ORIGIN}/*` }).catch(() => []);
  for (const tab of tabs) {
    if (tab.id != null) sendTabMessage(tab.id, message).catch(() => undefined);
  }
}
