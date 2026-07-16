import { SCHEMA_VERSION, STORAGE_KEY } from "../shared/constants";
import { storageGet, storageSet } from "../shared/chrome-api";
import type { ArticleHistoryRecord, ArticleSnapshot, StorageState, SyncMode } from "../shared/models";

export const emptyState = (): StorageState => ({
  schemaVersion: SCHEMA_VERSION,
  history: {},
  settings: { enabled: true, syncMode: "ask" },
  sync: { resetAt: 0 }
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
    settings: {
      enabled: state.settings?.enabled !== false,
      syncMode: normalizeSyncMode(state.settings?.syncMode)
    },
    sync: {
      generation: typeof state.sync?.generation === "string" ? state.sync.generation : undefined,
      resetAt: typeof state.sync?.resetAt === "number" ? state.sync.resetAt : 0
    }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeSyncMode(value: unknown): SyncMode {
  return value === "browser" || value === "local" ? value : "ask";
}
