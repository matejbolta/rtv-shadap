import type { ArticleStatus } from "../shared/models";
import type { ExtractedArticle } from "./extractor";
import { hasVisibleNativeLiveBadge } from "./live-detection";

export function clearRendering(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-rtv-tracker-state], [data-rtv-tracker-live], [data-rtv-tracker-card]").forEach((element) => {
    element.removeAttribute("data-rtv-tracker-state");
    element.removeAttribute("data-rtv-tracker-live");
    element.removeAttribute("data-rtv-tracker-card");
  });
  root.querySelectorAll("[data-rtv-tracker-owned='true']").forEach((element) => element.remove());
}

export function renderArticles(articles: ExtractedArticle[], statuses: ArticleStatus[]): void {
  const byKey = new Map(statuses.map((status) => [status.key, status]));
  for (const article of articles) {
    const status = byKey.get(article.key) ?? { key: article.key, state: "new" as const, isLive: article.isLive };
    for (const card of article.cardElements) {
      card.dataset.rtvTrackerCard = "true";
      card.dataset.rtvTrackerState = status.state;
      if (article.isLive) card.dataset.rtvTrackerLive = "true";
      else delete card.dataset.rtvTrackerLive;
      ensureMarker(card, status.state, article.isLive, hasVisibleNativeLiveBadge(card));
    }
    for (const element of [...article.titleElements, ...article.imageElements]) {
      element.dataset.rtvTrackerState = status.state;
      if (article.isLive) element.dataset.rtvTrackerLive = "true";
      else delete element.dataset.rtvTrackerLive;
    }
  }
}

function ensureMarker(card: HTMLElement, state: ArticleStatus["state"], isLive: boolean, hasNativeLive: boolean): void {
  card.querySelectorAll("[data-rtv-tracker-owned='true']").forEach((element) => element.remove());
  if (state === "new" && !isLive) return;
  const marker = document.createElement("span");
  marker.dataset.rtvTrackerOwned = "true";
  marker.className = "rtv-tracker-marker";
  if (isLive && !hasNativeLive) {
    marker.textContent = "V živo";
    marker.dataset.rtvTrackerMarker = "live";
  } else if (state === "opened") {
    marker.textContent = "Odprto";
    marker.dataset.rtvTrackerMarker = "opened";
  } else {
    return;
  }
  const target = card.querySelector("h1, h2, h3, h4") ?? card.firstElementChild ?? card;
  target.insertAdjacentElement("afterbegin", marker);
}
