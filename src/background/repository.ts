import { MAX_HISTORY_RECORDS, SCHEMA_VERSION, STORAGE_KEY } from "../shared/constants";
import { storageGet, storageSet } from "../shared/chrome-api";
import type { ArticleHistoryRecord, ArticleSnapshot, LatestPageSnapshot, PendingSession, StorageState } from "../shared/models";

export const emptyState = (): StorageState => ({
  schemaVersion: SCHEMA_VERSION,
  history: {},
  pendingSessions: {},
  settings: { enabled: true }
});

export class Repository {
  private queue = Promise.resolve();

  async read(): Promise<StorageState> {
    const result = await storageGet(STORAGE_KEY);
    return normalizeState(result[STORAGE_KEY]);
  }

  async mutate<T>(mutator: (state: StorageState) => T | Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const state = await this.read();
      const result = await mutator(state);
      await storageSet({ [STORAGE_KEY]: state });
      return result;
    });
    this.queue = run.then(() => undefined, () => undefined);
    return run;
  }
}

export function normalizeState(value: unknown): StorageState {
  if (!value || typeof value !== "object") return emptyState();
  const state = value as Partial<StorageState>;
  return {
    schemaVersion: SCHEMA_VERSION,
    history: isRecord(state.history) ? state.history as Record<string, ArticleHistoryRecord> : {},
    pendingSessions: isRecord(state.pendingSessions) ? state.pendingSessions as Record<string, PendingSession> : {},
    settings: { enabled: state.settings?.enabled !== false },
    latestPage: isLatestPageSnapshot(state.latestPage) ? state.latestPage : undefined
  };
}

export function upsertSeenRecord(
  history: Record<string, ArticleHistoryRecord>,
  article: ArticleSnapshot,
  timestamp: number
): void {
  const existing = history[article.key];
  if (existing) {
    existing.lastSeenAt = Math.max(existing.lastSeenAt, timestamp);
    existing.lastTitle = article.title || existing.lastTitle;
    existing.canonicalUrl = article.canonicalUrl || existing.canonicalUrl;
    existing.articleId = article.articleId ?? existing.articleId;
  } else {
    history[article.key] = {
      key: article.key,
      articleId: article.articleId,
      canonicalUrl: article.canonicalUrl,
      lastTitle: article.title,
      firstSeenAt: timestamp,
      lastSeenAt: timestamp
    };
  }
}

export function upsertOpenedRecord(
  history: Record<string, ArticleHistoryRecord>,
  article: ArticleSnapshot,
  timestamp: number
): void {
  upsertSeenRecord(history, article, timestamp);
  const record = history[article.key];
  if (!record) return;
  record.openedAt = record.openedAt ?? timestamp;
  record.lastOpenedAt = timestamp;
}

export function pruneHistory(history: Record<string, ArticleHistoryRecord>, limit = MAX_HISTORY_RECORDS): void {
  const records = Object.values(history);
  if (records.length <= limit) return;
  records
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
    .slice(limit)
    .forEach((record) => {
      delete history[record.key];
    });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isLatestPageSnapshot(value: unknown): value is LatestPageSnapshot {
  if (!isRecord(value) || !isRecord(value.counts)) return false;
  return typeof value.tabId === "number" && typeof value.updatedAt === "number";
}
