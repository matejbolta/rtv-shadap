import type { ArticleSnapshot, ArticleStatus, PageCounts } from "./models";

export type RuntimeMessage =
  | { type: "START_SESSION"; sessionId: string; articles: ArticleSnapshot[] }
  | { type: "UPDATE_SESSION_SNAPSHOT"; sessionId: string; articles: ArticleSnapshot[]; counts: PageCounts }
  | { type: "MARK_ARTICLE_OPENED"; sessionId: string; article: ArticleSnapshot; abandonSession?: boolean }
  | { type: "COMMIT_SESSION"; sessionId: string; reason: string }
  | { type: "ABANDON_SESSION"; sessionId: string; reason: string }
  | { type: "GET_SETTINGS" }
  | { type: "GET_STATUSES"; articles: ArticleSnapshot[] }
  | { type: "GET_PAGE_COUNTS"; tabId?: number }
  | { type: "SET_ENABLED"; enabled: boolean }
  | { type: "RESET_HISTORY" };

export type RuntimeResponse =
  | { ok: true; enabled: boolean; statuses: ArticleStatus[] }
  | { ok: true; enabled: boolean; counts: PageCounts | null }
  | { ok: true; enabled: boolean }
  | { ok: false; error: string };

export type BroadcastMessage =
  | { type: "HISTORY_CHANGED" }
  | { type: "SETTINGS_CHANGED"; enabled: boolean }
  | { type: "REQUEST_PAGE_COUNTS" };

export function isRuntimeMessage(value: unknown): value is RuntimeMessage {
  if (!value || typeof value !== "object" || !("type" in value)) return false;
  const type = (value as { type: unknown }).type;
  return typeof type === "string";
}
