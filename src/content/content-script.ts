import { HOMEPAGE_ORIGIN, RESCAN_DEBOUNCE_MS, STORAGE_KEY } from "../shared/constants";
import { sendRuntimeMessage, storageGet } from "../shared/chrome-api";
import type {
  BroadcastMessage,
  RuntimeMessage,
  RuntimeResponse,
  TabRequestMessage,
  TabResponse
} from "../shared/messages";
import type { ArticleStatus, StorageState } from "../shared/models";
import { extractArticles, toSnapshots, type ExtractedArticle } from "./extractor";
import { clearRendering, renderArticles } from "./renderer";
import { hideDistractingHomepageSections, restoreHiddenSections } from "./site-cleanup";

class RtvSiteController {
  private articles: ExtractedArticle[] = [];
  private statuses: ArticleStatus[] = [];
  private enabled = true;
  private rescanTimer: number | undefined;
  private observer: MutationObserver | undefined;

  async start(): Promise<void> {
    this.bindRuntimeMessages();
    await this.scanAndRender();
    this.observeMutations();
  }

  private scheduleScan(): void {
    window.clearTimeout(this.rescanTimer);
    this.rescanTimer = window.setTimeout(() => void this.scanAndRender(), RESCAN_DEBOUNCE_MS);
  }

  private async scanAndRender(): Promise<void> {
    this.applyHomepageCleanup();
    this.articles = extractArticles(document);
    await this.renderFromLocalStorage();
    if (!this.enabled) return;
    const response = await sendMessage({ type: "GET_STATUSES", articles: toSnapshots(this.articles) });
    this.applyResponse(response);
  }

  private async markCurrentPageSeen(): Promise<TabResponse> {
    if (!this.enabled) return { ok: false, error: "RTV Shadap je izklopljen." };
    this.applyHomepageCleanup();
    this.articles = extractArticles(document);
    const articles = toSnapshots(this.articles);
    if (articles.length === 0) return { ok: true, markedCount: 0 };

    const response = await sendMessage({ type: "MARK_ARTICLES_SEEN", articles });
    if (!response.ok) return response;
    this.applyResponse(response);
    return {
      ok: true,
      markedCount: "markedCount" in response ? response.markedCount : articles.length
    };
  }

  private applyResponse(response: RuntimeResponse): void {
    if (!response.ok) return;
    this.enabled = response.enabled;
    if ("statuses" in response) this.statuses = response.statuses;
    if (!this.enabled) {
      clearRendering();
      restoreHiddenSections(document);
      return;
    }
    renderArticles(this.articles, this.statuses);
  }

  private async renderFromLocalStorage(): Promise<void> {
    try {
      const result = await storageGet(STORAGE_KEY);
      const state = result[STORAGE_KEY] as Partial<StorageState> | undefined;
      this.enabled = state?.settings?.enabled !== false;
      if (!this.enabled) {
        clearRendering();
        restoreHiddenSections(document);
        return;
      }
      this.applyHomepageCleanup();
      const history = state?.history ?? {};
      this.statuses = toSnapshots(this.articles).map((article) => ({
        key: article.key,
        isLive: article.isLive,
        state: history[article.key] ? "seen" : "new"
      }));
      renderArticles(this.articles, this.statuses);
    } catch {
      // Background classification still runs below; local storage is only a fast fallback.
    }
  }

  private applyHomepageCleanup(): void {
    if (location.pathname === "/") hideDistractingHomepageSections(document);
    else restoreHiddenSections(document);
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

  private bindRuntimeMessages(): void {
    chrome.runtime.onMessage.addListener((message: BroadcastMessage | TabRequestMessage, _sender, sendResponse) => {
      if (message.type === "MARK_CURRENT_PAGE_SEEN") {
        void this.markCurrentPageSeen().then(sendResponse);
        return true;
      }
      if (message.type === "HISTORY_CHANGED") void this.scanAndRender();
      if (message.type === "SETTINGS_CHANGED") {
        this.enabled = message.enabled;
        if (message.enabled) void this.scanAndRender();
        else {
          clearRendering();
          restoreHiddenSections(document);
        }
      }
      return undefined;
    });
  }
}

function sendMessage(message: RuntimeMessage): Promise<RuntimeResponse> {
  return sendRuntimeMessage<RuntimeResponse>(message).catch((error) => ({
    ok: false,
    error: error instanceof Error ? error.message : "Message failed"
  }));
}

if (location.origin === HOMEPAGE_ORIGIN) {
  void new RtvSiteController().start();
}
