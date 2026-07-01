import type { ArticleSnapshot, ArticleStatus, PageCounts, PendingSession, SessionArticle, StorageState } from "../shared/models";
import { pruneHistory, upsertOpenedRecord, upsertSeenRecord } from "./repository";

export function pendingKey(tabId: number, sessionId: string): string {
  return `${tabId}:${sessionId}`;
}

export function startOrReplaceSession(
  state: StorageState,
  tabId: number,
  sessionId: string,
  articles: ArticleSnapshot[],
  timestamp: number
): void {
  for (const key of Object.keys(state.pendingSessions)) {
    const session = state.pendingSessions[key];
    if (session?.tabId === tabId && session.sessionId !== sessionId) {
      commitPendingSession(state, key, timestamp);
    }
  }
  mergeSnapshot(state, tabId, sessionId, articles, timestamp);
}

export function mergeSnapshot(
  state: StorageState,
  tabId: number,
  sessionId: string,
  articles: ArticleSnapshot[],
  timestamp: number
): void {
  const key = pendingKey(tabId, sessionId);
  const session = state.pendingSessions[key] ?? {
    tabId,
    sessionId,
    startedAt: timestamp,
    updatedAt: timestamp,
    articles: {}
  };
  if (session.abandonedAt != null) return;
  session.updatedAt = timestamp;
  for (const article of articles) {
    const existing = session.articles[article.key];
    session.articles[article.key] = mergeSessionArticle(existing, article, timestamp);
  }
  state.pendingSessions[key] = session;
}

export function markArticleOpened(
  state: StorageState,
  tabId: number,
  sessionId: string,
  article: ArticleSnapshot,
  timestamp: number
): void {
  mergeSnapshot(state, tabId, sessionId, [article], timestamp);
  upsertOpenedRecord(state.history, article, timestamp);
}

export function abandonSession(state: StorageState, tabId: number, sessionId: string, timestamp: number): void {
  const key = pendingKey(tabId, sessionId);
  const session = state.pendingSessions[key] ?? {
    tabId,
    sessionId,
    startedAt: timestamp,
    updatedAt: timestamp,
    articles: {}
  };
  session.articles = {};
  session.updatedAt = timestamp;
  session.abandonedAt = timestamp;
  state.pendingSessions[key] = session;
}

export function commitSession(state: StorageState, tabId: number, sessionId: string, timestamp: number): void {
  commitPendingSession(state, pendingKey(tabId, sessionId), timestamp);
}

export function commitSessionsForTab(state: StorageState, tabId: number, timestamp: number): void {
  for (const key of Object.keys(state.pendingSessions)) {
    if (state.pendingSessions[key]?.tabId === tabId) commitPendingSession(state, key, timestamp);
  }
}

export function reconcileLeftoverPendingSessions(state: StorageState, timestamp: number): void {
  for (const key of Object.keys(state.pendingSessions)) commitPendingSession(state, key, timestamp);
}

export function getStatuses(state: StorageState, articles: ArticleSnapshot[]): ArticleStatus[] {
  return articles.map((article) => {
    const record = state.history[article.key];
    return {
      key: article.key,
      isLive: article.isLive,
      state: record?.openedAt ? "opened" : record ? "seen" : "new"
    };
  });
}

export function countStatuses(statuses: ArticleStatus[]): PageCounts {
  return statuses.reduce<PageCounts>(
    (counts, status) => {
      counts[status.state] += 1;
      if (status.isLive) counts.live += 1;
      return counts;
    },
    { new: 0, seen: 0, opened: 0, live: 0 }
  );
}

function commitPendingSession(state: StorageState, key: string, timestamp: number): void {
  const session = state.pendingSessions[key];
  if (!session) return;
  if (session.abandonedAt != null) {
    delete state.pendingSessions[key];
    return;
  }
  for (const article of Object.values(session.articles)) {
    upsertSeenRecord(state.history, article, Math.max(article.lastDiscoveredAt, timestamp));
  }
  pruneHistory(state.history);
  delete state.pendingSessions[key];
}

function mergeSessionArticle(existing: SessionArticle | undefined, article: ArticleSnapshot, timestamp: number): SessionArticle {
  if (existing) {
    return {
      ...existing,
      ...article,
      firstDiscoveredAt: existing.firstDiscoveredAt,
      lastDiscoveredAt: timestamp
    };
  }
  return {
    ...article,
    firstDiscoveredAt: timestamp,
    lastDiscoveredAt: timestamp
  };
}
