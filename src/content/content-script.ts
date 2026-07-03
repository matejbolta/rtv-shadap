import { HOMEPAGE_ORIGIN, RESCAN_DEBOUNCE_MS, SNAPSHOT_DEBOUNCE_MS, STORAGE_KEY } from "../shared/constants";
import { sendRuntimeMessage, storageGet } from "../shared/chrome-api";
import type { BroadcastMessage, RuntimeMessage, RuntimeResponse } from "../shared/messages";
import type { ArticleSnapshot, ArticleStatus, StorageState } from "../shared/models";
import { extractArticles, toSnapshots, type ExtractedArticle } from "./extractor";
import { clearRendering, renderArticles } from "./renderer";
import { hideDistractingHomepageSections, restoreHiddenSections } from "./site-cleanup";

function createSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

class HomepageController {
  private sessionId = createSessionId();
  private articles: ExtractedArticle[] = [];
  private statuses: ArticleStatus[] = [];
  private enabled = true;
  private rescanTimer: number | undefined;
  private snapshotTimer: number | undefined;
  private observer: MutationObserver | undefined;
  private abandonSessionOnPagehide = false;
  private restartSessionOnPageshow = false;

  async start(): Promise<void> {
    this.bindArticleOpenHandlers();
    this.bindLifecycleHandlers();
    this.bindRuntimeMessages();
    await this.scanAndStartSession();
    this.observeMutations();
  }

  private async scanAndStartSession(): Promise<void> {
    hideDistractingHomepageSections(document);
    this.articles = extractArticles(document);
    await this.renderFromLocalStorage();
    const response = await sendMessage({ type: "START_SESSION", sessionId: this.sessionId, articles: toSnapshots(this.articles) });
    this.applyResponse(response);
  }

  private scheduleScan(): void {
    window.clearTimeout(this.rescanTimer);
    this.rescanTimer = window.setTimeout(() => void this.scanAndUpdate(), RESCAN_DEBOUNCE_MS);
  }

  private async scanAndUpdate(): Promise<void> {
    hideDistractingHomepageSections(document);
    this.articles = extractArticles(document);
    if (!this.enabled) {
      clearRendering();
      restoreHiddenSections(document);
      return;
    }
    await this.renderFromLocalStorage();
    window.clearTimeout(this.snapshotTimer);
    this.snapshotTimer = window.setTimeout(() => void this.persistSnapshot(), SNAPSHOT_DEBOUNCE_MS);
    const response = await sendMessage({ type: "GET_STATUSES", articles: toSnapshots(this.articles) });
    this.applyResponse(response);
  }

  private async persistSnapshot(): Promise<void> {
    if (this.abandonSessionOnPagehide) return;
    const snapshots = toSnapshots(this.articles);
    const response = await sendMessage({
      type: "UPDATE_SESSION_SNAPSHOT",
      sessionId: this.sessionId,
      articles: snapshots
    });
    this.applyResponse(response);
  }

  private applyResponse(response: RuntimeResponse): void {
    if (!response.ok) return;
    this.enabled = response.enabled;
    if ("statuses" in response) this.statuses = response.statuses;
    if (!this.enabled) {
      clearRendering();
      return;
    }
    renderArticles(this.articles, this.statuses);
  }

  private async renderFromLocalStorage(): Promise<void> {
    try {
      const result = await storageGet(STORAGE_KEY);
      const state = result[STORAGE_KEY] as Partial<StorageState> | undefined;
      const enabled = state?.settings?.enabled !== false;
      this.enabled = enabled;
      if (!enabled) {
        clearRendering();
        restoreHiddenSections(document);
        return;
      }
      hideDistractingHomepageSections(document);
      const history = state?.history ?? {};
      this.statuses = toSnapshots(this.articles).map((article) => {
        const record = history[article.key];
        return {
          key: article.key,
          isLive: article.isLive,
          state: record?.openedAt ? "opened" : record ? "seen" : "new"
        };
      });
      renderArticles(this.articles, this.statuses);
    } catch {
      // Background classification still runs below; local storage is only a fast fallback.
    }
  }

  private observeMutations(): void {
    this.observer = new MutationObserver((mutations) => {
      if (mutations.every((mutation) => mutation.target instanceof Element && mutation.target.closest("[data-rtv-tracker-owned='true']"))) return;
      this.scheduleScan();
    });
    this.observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["href", "class", "aria-label", "title", "data-label", "data-badge", "data-status"]
    });
  }

  private bindArticleOpenHandlers(): void {
    document.addEventListener("pointerdown", (event) => {
      if (event.button !== 1) return;
      this.markOpenedFromEvent(event);
    }, true);
    document.addEventListener("click", (event) => this.markOpenedFromEvent(event), true);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Enter") this.markOpenedFromEvent(event);
    }, true);
  }

  private markOpenedFromEvent(event: Event): void {
    const target = event.target instanceof Element ? event.target : null;
    const link = target?.closest<HTMLAnchorElement>("a[href]");
    if (!link) return;
    const article = this.articles.find((candidate) => candidate.links.includes(link));
    if (!article) return;
    const abandonSession = isSameTabArticleActivation(event, link);
    if (abandonSession) {
      window.clearTimeout(this.snapshotTimer);
      this.abandonSessionOnPagehide = true;
      this.restartSessionOnPageshow = true;
    }
    const snapshot: ArticleSnapshot = {
      key: article.key,
      articleId: article.articleId,
      canonicalUrl: article.canonicalUrl,
      title: article.title,
      isLive: article.isLive
    };
    this.statuses = this.statuses.filter((status) => status.key !== article.key);
    this.statuses.push({ key: article.key, state: "opened", isLive: article.isLive });
    renderArticles(this.articles, this.statuses);
    void sendMessage({ type: "MARK_ARTICLE_OPENED", sessionId: this.sessionId, article: snapshot, abandonSession });
  }

  private bindLifecycleHandlers(): void {
    window.addEventListener("pagehide", () => {
      if (!this.abandonSessionOnPagehide) return;
      void sendMessage({ type: "ABANDON_SESSION", sessionId: this.sessionId, reason: "same-tab-article-navigation" });
    });
    window.addEventListener("pageshow", () => {
      if (!this.restartSessionOnPageshow) return;
      this.abandonSessionOnPagehide = false;
      this.restartSessionOnPageshow = false;
      this.sessionId = createSessionId();
      void this.scanAndStartSession();
    });
    document.addEventListener("visibilitychange", () => {
      if (this.abandonSessionOnPagehide) return;
      if (document.visibilityState === "hidden") void this.persistSnapshot();
    });
  }

  private bindRuntimeMessages(): void {
    chrome.runtime.onMessage.addListener((message: BroadcastMessage) => {
      if (message.type === "HISTORY_CHANGED") void this.scanAndUpdate();
      if (message.type === "SETTINGS_CHANGED") {
        this.enabled = message.enabled;
        if (message.enabled) void this.scanAndUpdate();
        else {
          clearRendering();
          restoreHiddenSections(document);
        }
      }
    });
  }
}

function isSameTabArticleActivation(event: Event, link: HTMLAnchorElement): boolean {
  const target = link.getAttribute("target")?.trim().toLowerCase();
  if (target && target !== "_self") return false;
  if (link.hasAttribute("download")) return false;
  if (event instanceof MouseEvent) {
    return event.type === "click" && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
  }
  if (event instanceof KeyboardEvent) {
    return event.key === "Enter" && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
  }
  return false;
}

function sendMessage(message: RuntimeMessage): Promise<RuntimeResponse> {
  return sendRuntimeMessage<RuntimeResponse>(message).catch((error) => ({
    ok: false,
    error: error instanceof Error ? error.message : "Message failed"
  }));
}

if (location.origin === HOMEPAGE_ORIGIN && location.pathname === "/") {
  void new HomepageController().start();
}
