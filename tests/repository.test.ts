import { describe, expect, it } from "vitest";
import { getStatuses, markArticlesSeen } from "../src/background/history-manager";
import { emptyState, normalizeState } from "../src/background/repository";
import type { ArticleSnapshot } from "../src/shared/models";

const article = (id: number, title = `Naslov ${id}`): ArticleSnapshot => ({
  key: `rtv:${id}`,
  articleId: String(id),
  canonicalUrl: `https://www.rtvslo.si/test/${id}`,
  title,
  isLive: false
});

describe("manual history behavior", () => {
  it("does not mark extracted articles until the user explicitly marks the page", () => {
    const state = emptyState();
    const articles = [article(1), article(2)];

    expect(getStatuses(state, articles).map((status) => status.state)).toEqual(["new", "new"]);

    markArticlesSeen(state, articles, 10);
    expect(getStatuses(state, articles).map((status) => status.state)).toEqual(["seen", "seen"]);
  });

  it("keeps manually marked articles without automatic pruning", () => {
    const state = emptyState();
    const articles = Array.from({ length: 10_005 }, (_, index) => article(index));

    markArticlesSeen(state, articles, 10);

    expect(Object.keys(state.history)).toHaveLength(10_005);
    expect(state.history["rtv:0"]).toBeDefined();
    expect(state.history["rtv:10004"]).toBeDefined();
  });

  it("updates metadata without changing the original first-seen timestamp", () => {
    const state = emptyState();
    markArticlesSeen(state, [article(1, "Prvi naslov")], 10);
    markArticlesSeen(state, [article(1, "Posodobljen naslov")], 20);

    expect(state.history["rtv:1"]).toMatchObject({
      firstSeenAt: 10,
      lastSeenAt: 20,
      lastTitle: "Posodobljen naslov"
    });
  });

  it("migrates old history while adding local browser-sync preferences", () => {
    const state = normalizeState({
      schemaVersion: 1,
      history: {
        "rtv:1": {
          key: "rtv:1",
          canonicalUrl: "https://www.rtvslo.si/test/1",
          lastTitle: "Naslov 1",
          firstSeenAt: 1,
          lastSeenAt: 2,
          openedAt: 2
        }
      },
      pendingSessions: { "1:old": { tabId: 1 } },
      settings: { enabled: false }
    });

    expect(state.schemaVersion).toBe(3);
    expect(state.settings.enabled).toBe(false);
    expect(state.settings.syncMode).toBe("ask");
    expect(state.sync).toEqual({ resetAt: 0 });
    expect(state.history["rtv:1"]).toBeDefined();
    expect(state).not.toHaveProperty("pendingSessions");
    expect(getStatuses(state, [article(1)])[0]?.state).toBe("seen");
  });
});
