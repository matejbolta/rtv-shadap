import { HOMEPAGE_ORIGIN } from "./constants";

const RTV365_ORIGIN = "https://365.rtvslo.si";

const REJECTED_FIRST_SEGMENTS = new Set([
  "slovenija",
  "svet",
  "sport",
  "kultura",
  "zabava-in-slog",
  "posebna-ponudba",
  "rtv365",
  "vreme",
  "spored",
  "iskalnik",
  "moj-rtv",
  "login",
  "registracija",
  "radio",
  "tv"
]);

export interface ArticleIdentity {
  key: string;
  articleId?: string;
  canonicalUrl: string;
}

export function normalizeRtvUrl(rawHref: string, baseHref: string): URL | null {
  if (isPageLocalReference(rawHref)) return null;
  try {
    const url = new URL(rawHref, baseHref);
    if (url.origin !== HOMEPAGE_ORIGIN) return null;
    url.hash = "";
    url.search = "";
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url;
  } catch {
    return null;
  }
}

export function identifyArticle(rawHref: string, baseHref = HOMEPAGE_ORIGIN + "/"): ArticleIdentity | null {
  const url = normalizeSupportedUrl(rawHref, baseHref);
  if (!url || url.pathname === "/") return null;
  if (url.origin === RTV365_ORIGIN) return identifyRtv365Media(url);
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;
  const first = segments[0]?.toLowerCase();
  if (first && REJECTED_FIRST_SEGMENTS.has(first) && !/\d{5,}$/.test(url.pathname)) return null;
  const idMatch = url.pathname.match(/\/(\d{5,})$/);
  if (idMatch?.[1]) {
    return {
      key: `rtv:${idMatch[1]}`,
      articleId: idMatch[1],
      canonicalUrl: url.toString()
    };
  }
  if (segments.length >= 2 && hasArticleLikeSlug(segments.at(-1) ?? "")) {
    return {
      key: `url:${url.pathname.toLowerCase()}`,
      canonicalUrl: url.toString()
    };
  }
  return null;
}

export function identifyRtv365Recording(recordingId: string): ArticleIdentity | null {
  if (!/^\d{5,}$/.test(recordingId)) return null;
  return {
    key: `rtv365:${recordingId}`,
    articleId: recordingId,
    canonicalUrl: `${RTV365_ORIGIN}/arhiv/${recordingId}`
  };
}

function normalizeSupportedUrl(rawHref: string, baseHref: string): URL | null {
  if (isPageLocalReference(rawHref)) return null;
  try {
    const url = new URL(rawHref, baseHref);
    url.hostname = url.hostname.toLowerCase();
    if (url.origin !== HOMEPAGE_ORIGIN && url.origin !== RTV365_ORIGIN) return null;
    url.search = "";
    if (url.origin === HOMEPAGE_ORIGIN) url.hash = "";
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url;
  } catch {
    return null;
  }
}

function isPageLocalReference(rawHref: string): boolean {
  const href = rawHref.trim().toLowerCase();
  return !href || href.startsWith("#") || href.startsWith("?") || href.startsWith("javascript:");
}

function identifyRtv365Media(url: URL): ArticleIdentity | null {
  const hashId = url.hash.match(/^#(\d{5,})$/)?.[1];
  const pathId = url.pathname.match(/\/(\d{5,})$/)?.[1];
  const id = hashId ?? pathId;
  if (!id) return null;
  return {
    key: `rtv365:${id}`,
    articleId: id,
    canonicalUrl: url.toString()
  };
}

function hasArticleLikeSlug(slug: string): boolean {
  return slug.length >= 12 && slug.includes("-") && /[a-z0-9]/i.test(slug);
}
