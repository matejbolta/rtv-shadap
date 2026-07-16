import type { ArticleSnapshot, ArticleStatus, StorageState } from "../shared/models";
import { upsertSeenRecord } from "./repository";

export function markArticlesSeen(state: StorageState, articles: ArticleSnapshot[], timestamp: number): void {
  for (const article of articles) upsertSeenRecord(state.history, article, timestamp);
}

export function getStatuses(state: StorageState, articles: ArticleSnapshot[]): ArticleStatus[] {
  return articles.map((article) => ({
    key: article.key,
    isLive: article.isLive,
    state: state.history[article.key] ? "seen" : "new"
  }));
}
