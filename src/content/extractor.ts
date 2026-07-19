import { identifyArticle, identifyRtv365Recording, type ArticleIdentity } from "../shared/article-url";
import type { ArticleSnapshot } from "../shared/models";
import { cardHasLiveSignal } from "./live-detection";
import { isInsideHiddenSection } from "./site-cleanup";

export interface ExtractedArticle extends ArticleSnapshot {
  links: HTMLAnchorElement[];
  titleElements: HTMLElement[];
  imageElements: HTMLElement[];
  cardElements: HTMLElement[];
}

interface MutableExtracted extends ExtractedArticle {
  linkSet: Set<HTMLAnchorElement>;
  titleSet: Set<HTMLElement>;
  imageSet: Set<HTMLElement>;
  cardSet: Set<HTMLElement>;
}

const CARD_SELECTOR = [
  ".xl-news",
  ".md-news",
  ".sm-news",
  ".article-container",
  "article",
  "li",
  ".article",
  ".news",
  ".card",
  ".teaser",
  ".item",
  "[class*='article']",
  "[class*='card']",
  "[class*='teaser']"
].join(", ");
const TITLE_SELECTOR = "h1, h2, h3, h4, [class*='title'], [class*='headline']";
const CONTENT_ROOT_SELECTOR = "main, [role='main'], body";

export function extractArticles(document: Document = window.document): ExtractedArticle[] {
  const roots = Array.from(document.querySelectorAll<HTMLElement>(CONTENT_ROOT_SELECTOR));
  const scope = roots[0] ?? document.body;
  const anchors = Array.from(scope.querySelectorAll<HTMLAnchorElement>("a[href]"))
    .filter((anchor) => !anchor.closest("[data-rtv-tracker-owned='true']") && !isInsideHiddenSection(anchor));
  const byKey = new Map<string, MutableExtracted>();

  for (const anchor of anchors) {
    const identity = identifyAnchor(anchor, document.location.href);
    if (!identity) continue;
    const card = findCardElement(anchor);
    if (!card || card.querySelector("[data-rtv-tracker-owned='true']") === card) continue;
    const titleElements = findTitleElements(anchor, card);
    const title = pickTitle(anchor, titleElements);
    if (!title) continue;
    const images = findImageElements(anchor, card);
    const existing = byKey.get(identity.key);
    if (existing) {
      existing.linkSet.add(anchor);
      titleElements.forEach((element) => existing.titleSet.add(element));
      images.forEach((element) => existing.imageSet.add(element));
      existing.cardSet.add(card);
      existing.isLive = existing.isLive || cardHasLiveSignal(card, title);
      if (title.length > existing.title.length) existing.title = title;
    } else {
      byKey.set(identity.key, {
        key: identity.key,
        articleId: identity.articleId,
        canonicalUrl: identity.canonicalUrl,
        title,
        links: [],
        titleElements: [],
        imageElements: [],
        cardElements: [],
        isLive: cardHasLiveSignal(card, title),
        linkSet: new Set([anchor]),
        titleSet: new Set(titleElements),
        imageSet: new Set(images),
        cardSet: new Set([card])
      });
    }
  }

  return Array.from(byKey.values()).map((article) => ({
    key: article.key,
    articleId: article.articleId,
    canonicalUrl: article.canonicalUrl,
    title: article.title,
    links: Array.from(article.linkSet),
    titleElements: Array.from(article.titleSet),
    imageElements: Array.from(article.imageSet),
    cardElements: Array.from(article.cardSet),
    isLive: article.isLive
  }));
}

export function toSnapshots(articles: ExtractedArticle[]): ArticleSnapshot[] {
  return articles.map(({ key, articleId, canonicalUrl, title, isLive }) => ({
    key,
    articleId,
    canonicalUrl,
    title,
    isLive
  }));
}

function findCardElement(anchor: HTMLAnchorElement): HTMLElement | null {
  const card = anchor.closest<HTMLElement>(CARD_SELECTOR);
  if (card && countArticleLinks(card) <= 3) return card;
  const parent = anchor.parentElement;
  if (parent && countArticleLinks(parent) <= 2) return parent;
  return anchor;
}

function countArticleLinks(element: Element): number {
  const keys = new Set<string>();
  element.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
    const identity = identifyAnchor(anchor, document.location.href);
    if (identity) keys.add(identity.key);
  });
  return keys.size;
}

function identifyAnchor(anchor: HTMLAnchorElement, baseHref: string): ArticleIdentity | null {
  const hrefIdentity = identifyArticle(anchor.getAttribute("href") ?? "", baseHref);
  if (hrefIdentity) return hrefIdentity;
  const recordingId = anchor.dataset.recording ?? anchor.dataset.resumeAvaId ?? anchor.getAttribute("data-ava-id") ?? "";
  return identifyRtv365Recording(recordingId);
}

function findTitleElements(anchor: HTMLAnchorElement, card: HTMLElement): HTMLElement[] {
  const heading = anchor.closest<HTMLElement>(TITLE_SELECTOR);
  if (heading) return [heading];
  const nestedHeading = anchor.querySelector<HTMLElement>(TITLE_SELECTOR);
  if (nestedHeading) return [nestedHeading];
  const cardHeadings = Array.from(card.querySelectorAll<HTMLElement>(TITLE_SELECTOR))
    .filter((element) => !element.closest("[data-rtv-tracker-owned='true']"));
  if (cardHeadings.length > 0) return cardHeadings.slice(0, 2);
  return [anchor];
}

function pickTitle(anchor: HTMLAnchorElement, titleElements: HTMLElement[]): string {
  const candidates = [
    anchor.getAttribute("aria-label") ?? "",
    textWithoutCategory(anchor),
    anchor.getAttribute("title") ?? "",
    ...titleElements.map(textWithoutCategory)
  ].map(normalizeTitle);
  return candidates.find((text) => text.length >= 4) ?? "";
}

function normalizeTitle(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/^\s*\d+\.\s*mesto:\s*/i, "")
    .trim();
}

function textWithoutCategory(element: HTMLElement): string {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".news-cat, [data-rtv-tracker-owned='true']").forEach((node) => node.remove());
  return clone.textContent ?? "";
}

function findImageElements(anchor: HTMLAnchorElement, card: HTMLElement): HTMLElement[] {
  const elements = new Set<HTMLElement>();
  anchor.querySelectorAll<HTMLElement>("img, picture, figure").forEach((element) => elements.add(element));
  card.querySelectorAll<HTMLElement>("img, picture, figure").forEach((element) => elements.add(element));
  return Array.from(elements).filter((element) => !element.closest("[data-rtv-tracker-owned='true']"));
}
