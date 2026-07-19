import { beforeEach, describe, expect, it } from "vitest";
import type { ArticleStatus } from "../src/shared/models";
import { extractArticles, type ExtractedArticle } from "../src/content/extractor";
import { mutationsAreExtensionOwned } from "../src/content/mutation-filter";
import { renderArticles } from "../src/content/renderer";

function liveArticle(): { article: ExtractedArticle; status: ArticleStatus } {
  const card = document.querySelector<HTMLElement>("#card");
  const heading = card?.querySelector<HTMLElement>("h2");
  if (!card || !heading) throw new Error("Missing test card");
  const article: ExtractedArticle = {
    key: "rtv:live-test",
    articleId: "live-test",
    canonicalUrl: "https://www.rtvslo.si/test/live-test",
    title: "V živo: test",
    isLive: true,
    links: [],
    titleElements: [heading],
    imageElements: [],
    cardElements: [card]
  };
  return {
    article,
    status: { key: article.key, isLive: true, state: "new" }
  };
}

async function deliverMutations(): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, 0));
}

describe("render stability", () => {
  beforeEach(() => {
    document.body.innerHTML = "<article id='card'><h2>V živo: test</h2></article>";
  });

  it("does not replace an existing live marker during an unchanged render", async () => {
    const { article, status } = liveArticle();
    renderArticles([article], [status]);
    const initialMarker = document.querySelector("[data-rtv-tracker-marker='live']");
    const records: MutationRecord[] = [];
    const observer = new MutationObserver((mutations) => records.push(...mutations));
    observer.observe(document.body, { subtree: true, childList: true });

    renderArticles([article], [status]);
    await deliverMutations();
    observer.disconnect();

    expect(document.querySelector("[data-rtv-tracker-marker='live']")).toBe(initialMarker);
    expect(records).toEqual([]);
  });

  it("keeps live identity stable when extraction runs again after rendering", () => {
    document.body.innerHTML = `
      <main>
        <article id="card">
          <a href="/slovenija/v-zivo-test/788999"><h2>V živo: test</h2></a>
        </article>
      </main>
    `;
    const first = extractArticles(document);
    expect(first).toHaveLength(1);
    expect(first[0]?.isLive).toBe(true);
    renderArticles(first, [{ key: "rtv:788999", isLive: true, state: "new" }]);

    const second = extractArticles(document);

    expect(second).toHaveLength(1);
    expect(second[0]?.title).toBe("V živo: test");
    expect(second[0]?.isLive).toBe(true);
  });

  it("removes its fallback marker when the page adds a native live badge", () => {
    const { article, status } = liveArticle();
    renderArticles([article], [status]);
    const nativeBadge = document.createElement("strong");
    nativeBadge.textContent = "LIVE";
    article.cardElements[0]?.append(nativeBadge);

    renderArticles([article], [status]);

    expect(document.querySelector("[data-rtv-tracker-marker='live']")).toBeNull();
    expect(nativeBadge.isConnected).toBe(true);
  });

  it("settles after one unrelated page mutation instead of rescanning itself", async () => {
    const { article, status } = liveArticle();
    renderArticles([article], [status]);
    let actionableBatches = 0;
    let totalBatches = 0;
    const observer = new MutationObserver((mutations) => {
      totalBatches += 1;
      if (mutationsAreExtensionOwned(mutations)) return;
      actionableBatches += 1;
      renderArticles([article], [status]);
    });
    observer.observe(document.body, { subtree: true, childList: true });

    document.body.append(document.createElement("div"));
    await deliverMutations();
    await deliverMutations();
    observer.disconnect();

    expect(actionableBatches).toBe(1);
    expect(totalBatches).toBe(1);
    expect(document.querySelectorAll("[data-rtv-tracker-marker='live']")).toHaveLength(1);
  });

  it("distinguishes extension-owned marker mutations from mixed site changes", async () => {
    const records: MutationRecord[][] = [];
    const observer = new MutationObserver((mutations) => records.push(mutations));
    observer.observe(document.body, { subtree: true, childList: true });
    const heading = document.querySelector("h2");
    const marker = document.createElement("span");
    marker.dataset.rtvTrackerOwned = "true";
    heading?.append(marker);
    await deliverMutations();

    const siteNode = document.createElement("div");
    heading?.append(marker, siteNode);
    await deliverMutations();
    observer.disconnect();

    expect(mutationsAreExtensionOwned(records[0] ?? [])).toBe(true);
    expect(mutationsAreExtensionOwned(records[1] ?? [])).toBe(false);
  });

  it("ignores text mutations inside an extension-owned marker", async () => {
    const heading = document.querySelector("h2");
    const marker = document.createElement("span");
    marker.dataset.rtvTrackerOwned = "true";
    marker.textContent = "V živo";
    heading?.append(marker);
    const records: MutationRecord[] = [];
    const observer = new MutationObserver((mutations) => records.push(...mutations));
    observer.observe(document.body, { subtree: true, characterData: true });

    if (marker.firstChild) marker.firstChild.textContent = "LIVE";
    await deliverMutations();
    observer.disconnect();

    expect(mutationsAreExtensionOwned(records)).toBe(true);
  });
});
