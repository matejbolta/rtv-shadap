const HIDDEN_ATTR = "data-rtv-tracker-hidden-section";
const NEWS_CARD_SELECTOR = ".xl-news, .md-news, .sm-news, .article-container, article";

const STANDALONE_PROMO_IMAGE_SELECTOR = [
  "img[src*='banner-1400x']",
  "img[data-src*='banner-1400x']",
  "img[src*='1400x80']",
  "img[data-src*='1400x80']",
  "img[src*='1400x320']",
  "img[data-src*='1400x320']",
  "img[src*='rtv365_banner']",
  "img[data-src*='rtv365_banner']"
].join(",");

const PORTAL_SHORTCUT_SELECTOR = [
  "a[href*='skit.rtvslo.si']",
  "a[href*='ziv-zav.rtvslo.si']",
  "a[href*='cist-hudo.rtvslo.si']",
  "a[href*='mmcpodrobno']"
].join(",");

export function hideDistractingHomepageSections(document: Document = window.document): void {
  hideStandaloneRtv365Promo(document);
  hideStandalonePromoBanners(document);
  hidePortalShortcutRows(document);
  hideSodelujteSection(document);
}

export const hideRtv365PromoSections = hideDistractingHomepageSections;

function hideStandaloneRtv365Promo(document: Document): void {
  const logoImages = Array.from(document.querySelectorAll<HTMLImageElement>("img.section-title-custom-icon[src*='365-logo']"));
  for (const logo of logoImages) {
    const section = logo.closest<HTMLElement>("section");
    hideElement(section, "rtv365");
  }
}

function hideStandalonePromoBanners(document: Document): void {
  const images = Array.from(document.querySelectorAll<HTMLImageElement>(STANDALONE_PROMO_IMAGE_SELECTOR));
  for (const image of images) {
    hideElement(findStandalonePromoContainer(image), "promo-banner");
  }
}

function hidePortalShortcutRows(document: Document): void {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(PORTAL_SHORTCUT_SELECTOR));
  for (const link of links) {
    hideElement(findPortalShortcutRow(link), "portal-shortcuts");
  }
}

function hideSodelujteSection(document: Document): void {
  hideElement(document.querySelector<HTMLElement>("section[aria-label='Sodelujte']"), "sodelujte");
  hideElement(document.getElementById("sodelujte")?.closest<HTMLElement>(".section-heading"), "sodelujte-heading");
}

function findStandalonePromoContainer(image: HTMLImageElement): HTMLElement | null {
  if (!hasStandalonePromoImageSource(image)) return null;
  if (image.closest(NEWS_CARD_SELECTOR)) return null;

  const textCenteredContainer = image.closest<HTMLElement>(".container.text-center");
  if (textCenteredContainer) return textCenteredContainer;

  const link = image.closest<HTMLElement>("a");
  const wrapper = link?.parentElement;
  if (!wrapper || wrapper.matches("section, article")) return link;

  return wrapper.childElementCount === 1 ? wrapper : link;
}

function hasStandalonePromoImageSource(image: HTMLImageElement): boolean {
  const imageSource = `${image.getAttribute("src") ?? ""} ${image.dataset.src ?? ""}`;
  return /banner-1400x|rtv365_banner|(?:^|[_-])1400x(?:80|320)(?:[_\-.]|$)/.test(imageSource);
}

function findPortalShortcutRow(link: HTMLAnchorElement): HTMLElement | null {
  let current = link.parentElement;
  while (current && !current.matches("section, body")) {
    if (current.matches(".row") && current.querySelectorAll(PORTAL_SHORTCUT_SELECTOR).length >= 2) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function hideElement(element: HTMLElement | null | undefined, reason: string): void {
  if (!element) return;
  const hasStrongHiddenStyle = element.style.display === "none" && element.style.getPropertyPriority("display") === "important";
  if (element.getAttribute(HIDDEN_ATTR) === reason && hasStrongHiddenStyle) return;
  element.setAttribute(HIDDEN_ATTR, reason);
  element.style.setProperty("display", "none", "important");
}

export function restoreHiddenSections(document: Document = window.document): void {
  document.querySelectorAll<HTMLElement>(`[${HIDDEN_ATTR}]`).forEach((section) => {
    section.removeAttribute(HIDDEN_ATTR);
    section.style.removeProperty("display");
  });
}

export function isInsideHiddenSection(element: Element): boolean {
  return Boolean(element.closest(`[${HIDDEN_ATTR}]`));
}
