const LIVE_PATTERN = /(^|[\s([{:;–-])(?:v\s*[žz]ivo|live)(?=$|[\s)\].,:;–-])/i;

export function hasLiveSignalFromText(text: string): boolean {
  return LIVE_PATTERN.test(normalizeText(text));
}

export function elementHasNativeLiveSignal(element: Element): boolean {
  const snippets: string[] = [];
  const direct = directText(element);
  if (direct) snippets.push(direct);
  for (const attr of ["aria-label", "title", "data-label", "data-badge", "data-status", "class"]) {
    const value = element.getAttribute(attr);
    if (value) snippets.push(value);
  }
  return snippets.some(hasLiveSignalFromText);
}

export function cardHasLiveSignal(card: Element, headline: string): boolean {
  if (hasLiveSignalFromText(headline)) return true;
  const smallSignalElements = Array.from(
    card.querySelectorAll<HTMLElement>("[aria-label], [title], [data-label], [data-badge], [data-status], span, em, strong, b")
  ).filter((element) => !element.closest("[data-rtv-tracker-owned='true']"));
  return smallSignalElements.some((element) => {
    const text = normalizeText(element.textContent ?? "");
    return text.length <= 40 && elementHasNativeLiveSignal(element);
  });
}

export function hasVisibleNativeLiveBadge(card: Element): boolean {
  return Array.from(card.querySelectorAll<HTMLElement>("span, em, strong, b, [aria-label], [title]"))
    .filter((element) => !element.closest("[data-rtv-tracker-owned='true']"))
    .some((element) => normalizeText(element.textContent ?? "").length <= 40 && elementHasNativeLiveSignal(element));
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function directText(element: Element): string {
  return Array.from(element.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent ?? "")
    .join(" ");
}
