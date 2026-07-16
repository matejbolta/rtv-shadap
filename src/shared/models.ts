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

export interface ExtensionSettings {
  enabled: boolean;
}

export interface StorageState {
  schemaVersion: 2;
  history: Record<string, ArticleHistoryRecord>;
  settings: ExtensionSettings;
}

export type ArticleVisualState = "new" | "seen";

export interface ArticleStatus {
  key: string;
  state: ArticleVisualState;
  isLive: boolean;
}
