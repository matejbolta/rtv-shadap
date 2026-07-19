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
      ensureLiveMarker(card, article.isLive, hasVisibleNativeLiveBadge(card));
    }
    for (const element of [...article.titleElements, ...article.imageElements]) {
      element.dataset.rtvTrackerState = status.state;
      if (article.isLive) element.dataset.rtvTrackerLive = "true";
      else delete element.dataset.rtvTrackerLive;
    }
  }
}

function ensureLiveMarker(card: HTMLElement, isLive: boolean, hasNativeLive: boolean): void {
  const markers = Array.from(card.querySelectorAll<HTMLElement>(
    "[data-rtv-tracker-owned='true'][data-rtv-tracker-marker='live']"
  ));
  if (!isLive || hasNativeLive) {
    markers.forEach((marker) => marker.remove());
    return;
  }
  if (markers.length > 0) {
    markers.slice(1).forEach((marker) => marker.remove());
    return;
  }
  const marker = document.createElement("span");
  marker.dataset.rtvTrackerOwned = "true";
  marker.className = "rtv-tracker-marker";
  marker.textContent = "V živo";
  marker.dataset.rtvTrackerMarker = "live";
  const target = card.querySelector("h1, h2, h3, h4") ?? card.firstElementChild ?? card;
  target.insertAdjacentElement("afterbegin", marker);
}
