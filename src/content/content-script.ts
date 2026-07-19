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
import { CoalescingTaskRunner } from "./coalescing-task-runner";
import { extractArticles, toSnapshots, type ExtractedArticle } from "./extractor";
import { mutationsAreExtensionOwned } from "./mutation-filter";
import { clearRendering, renderArticles } from "./renderer";
import { hideDistractingHomepageSections, restoreHiddenSections } from "./site-cleanup";

class RtvSiteController {
  private articles: ExtractedArticle[] = [];
  private statuses: ArticleStatus[] = [];
  private enabled = true;
  private rescanTimer: number | undefined;
  private observer: MutationObserver | undefined;
  private readonly scanRunner = new CoalescingTaskRunner(() => this.scanAndRender());

  async start(): Promise<void> {
    this.bindRuntimeMessages();
    await this.scanRunner.request();
    this.observeMutations();
  }

  private scheduleScan(): void {
    if (!this.enabled) return;
    window.clearTimeout(this.rescanTimer);
    this.rescanTimer = window.setTimeout(() => {
      this.rescanTimer = undefined;
      void this.scanRunner.request().catch(() => undefined);
    }, RESCAN_DEBOUNCE_MS);
  }

  private async scanAndRender(): Promise<void> {
    this.applyHomepageCleanup();
    this.articles = extractArticles(document);
    const response = await sendMessage({ type: "GET_STATUSES", articles: toSnapshots(this.articles) });
    if (response.ok) {
      this.applyResponse(response);
      return;
    }
    const local = await this.readLocalSnapshot();
    if (!local) return;
    this.enabled = local.enabled;
    this.statuses = local.statuses;
    if (!this.enabled) {
      this.stopRendering();
      return;
    }
    renderArticles(this.articles, this.statuses);
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
      this.stopRendering();
      return;
    }
    renderArticles(this.articles, this.statuses);
  }

  private async readLocalSnapshot(): Promise<{ enabled: boolean; statuses: ArticleStatus[] } | null> {
    try {
      const result = await storageGet(STORAGE_KEY);
      const state = result[STORAGE_KEY] as Partial<StorageState> | undefined;
      const enabled = state?.settings?.enabled !== false;
      const history = state?.history ?? {};
      const statuses: ArticleStatus[] = toSnapshots(this.articles).map((article) => ({
        key: article.key,
        isLive: article.isLive,
        state: history[article.key] ? "seen" : "new"
      }));
      return { enabled, statuses };
    } catch {
      return null;
    }
  }

  private applyHomepageCleanup(): void {
    if (location.pathname === "/") hideDistractingHomepageSections(document);
    else restoreHiddenSections(document);
  }

  private stopRendering(): void {
    window.clearTimeout(this.rescanTimer);
    this.rescanTimer = undefined;
    clearRendering();
    restoreHiddenSections(document);
  }

  private observeMutations(): void {
    this.observer = new MutationObserver((mutations) => {
      if (!this.enabled || mutationsAreExtensionOwned(mutations)) return;
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
      if (message.type === "HISTORY_CHANGED") void this.scanRunner.request().catch(() => undefined);
      if (message.type === "SETTINGS_CHANGED") {
        this.enabled = message.enabled;
        if (message.enabled) void this.scanRunner.request().catch(() => undefined);
        else this.stopRendering();
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
