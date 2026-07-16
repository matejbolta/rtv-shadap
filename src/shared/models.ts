export interface ArticleSnapshot {
  key: string;
  articleId?: string;
  canonicalUrl: string;
  title: string;
  isLive: boolean;
}

export interface ArticleHistoryRecord {
  key: string;
  articleId?: string;
  canonicalUrl: string;
  lastTitle: string;
  firstSeenAt: number;
  lastSeenAt: number;
}

export type SyncMode = "ask" | "browser" | "local";

export interface ExtensionSettings {
  enabled: boolean;
  syncMode: SyncMode;
}

export interface LocalSyncState {
  generation?: string;
  resetAt: number;
}

export interface StorageState {
  schemaVersion: 3;
  history: Record<string, ArticleHistoryRecord>;
  settings: ExtensionSettings;
  sync: LocalSyncState;
}

export type ArticleVisualState = "new" | "seen";

export interface ArticleStatus {
  key: string;
  state: ArticleVisualState;
  isLive: boolean;
}
