import type { ArticleSnapshot, ArticleStatus, SyncMode } from "./models";

export type RuntimeMessage =
  | { type: "MARK_ARTICLES_SEEN"; articles: ArticleSnapshot[] }
  | { type: "GET_SETTINGS" }
  | { type: "GET_STATUSES"; articles: ArticleSnapshot[] }
  | { type: "SET_ENABLED"; enabled: boolean }
  | { type: "SET_SYNC_MODE"; syncMode: Exclude<SyncMode, "ask"> }
  | { type: "RESET_HISTORY" };

export type RuntimeResponse =
  | { ok: true; enabled: boolean; statuses: ArticleStatus[] }
  | { ok: true; enabled: boolean; markedCount: number; statuses: ArticleStatus[] }
  | { ok: true; enabled: boolean; syncMode: SyncMode }
  | { ok: true; enabled: boolean }
  | { ok: false; error: string };

export type BroadcastMessage =
  | { type: "HISTORY_CHANGED" }
  | { type: "SETTINGS_CHANGED"; enabled: boolean };

export type TabRequestMessage = { type: "MARK_CURRENT_PAGE_SEEN" };

export type TabResponse =
  | { ok: true; markedCount: number }
  | { ok: false; error: string };

export function isRuntimeMessage(value: unknown): value is RuntimeMessage {
  if (!value || typeof value !== "object" || !("type" in value)) return false;
  const type = (value as { type: unknown }).type;
  return typeof type === "string";
}
