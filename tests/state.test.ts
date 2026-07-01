import { describe, expect, it } from "vitest";
import type { ArticleSnapshot } from "../src/shared/models";
import { emptyState } from "../src/background/repository";
import { getStatuses, markArticleOpened } from "../src/background/session-manager";

const article = (key: string, isLive = false): ArticleSnapshot => ({
  key,
  articleId: key.replace("rtv:", ""),
  canonicalUrl: `https://www.rtvslo.si/test/${key.replace("rtv:", "")}`,
  title: "Naslov",
  isLive
});

describe("state behavior", () => {
  it("classifies unknown, seen and opened articles", () => {
    const state = emptyState();
    expect(getStatuses(state, [article("rtv:1")])[0]?.state).toBe("new");
    state.history["rtv:1"] = {
      key: "rtv:1",
      canonicalUrl: "https://www.rtvslo.si/test/1",
      lastTitle: "Naslov",
      firstSeenAt: 1,
      lastSeenAt: 1
    };
    expect(getStatuses(state, [article("rtv:1")])[0]?.state).toBe("seen");
    state.history["rtv:1"].openedAt = 2;
    expect(getStatuses(state, [article("rtv:1")])[0]?.state).toBe("opened");
  });

  it("keeps live orthogonal and opening updates duplicates by key", () => {
    const state = emptyState();
    markArticleOpened(state, 1, "s", article("rtv:2", true), 10);
    expect(getStatuses(state, [article("rtv:2", true), article("rtv:2", true)])).toEqual([
      { key: "rtv:2", state: "opened", isLive: true },
      { key: "rtv:2", state: "opened", isLive: true }
    ]);
  });

  it("headline changes with same id do not create a new state", () => {
    const state = emptyState();
    markArticleOpened(state, 1, "s", { ...article("rtv:3"), title: "Prvi naslov" }, 10);
    expect(getStatuses(state, [{ ...article("rtv:3"), title: "Drugi naslov" }])[0]?.state).toBe("opened");
  });
});
