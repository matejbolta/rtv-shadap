export interface ArticleSnapshot {
  key: string;
  articleId?: string;
  canonicalUrl: string;
  title: string;
  isLive: boolean;
}

export interface SessionArticle extends ArticleSnapshot {
  firstDiscoveredAt: number;
  lastDiscoveredAt: number;
}

export interface PendingSession {
  tabId: number;
  sessionId: string;
  startedAt: number;
  updatedAt: number;
  articles: Record<string, SessionArticle>;
  abandonedAt?: number;
}

export interface ArticleHistoryRecord {
  key: string;
  articleId?: string;
  canonicalUrl: string;
  lastTitle: string;
  firstSeenAt: number;
  lastSeenAt: number;
  openedAt?: number;
  lastOpenedAt?: number;
}

export interface ExtensionSettings {
  enabled: boolean;
}

export interface StorageState {
  schemaVersion: 1;
  history: Record<string, ArticleHistoryRecord>;
  pendingSessions: Record<string, PendingSession>;
  settings: ExtensionSettings;
  latestPage?: LatestPageSnapshot;
}

export type ArticleVisualState = "new" | "seen" | "opened";

export interface ArticleStatus {
  key: string;
  state: ArticleVisualState;
  isLive: boolean;
}

export interface PageCounts {
  new: number;
  seen: number;
  opened: number;
  live: number;
}

export interface LatestPageSnapshot {
  tabId: number;
  updatedAt: number;
  counts: PageCounts;
}
