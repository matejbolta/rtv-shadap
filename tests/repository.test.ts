import { describe, expect, it } from "vitest";
import { emptyState, pruneHistory } from "../src/background/repository";
import {
  abandonSession,
  commitSession,
  markArticleOpened,
  mergeSnapshot,
  reconcileLeftoverPendingSessions,
  startOrReplaceSession
} from "../src/background/session-manager";
import type { ArticleSnapshot } from "../src/shared/models";

const article = (id: number): ArticleSnapshot => ({
  key: `rtv:${id}`,
  articleId: String(id),
  canonicalUrl: `https://www.rtvslo.si/test/${id}`,
  title: `Naslov ${id}`,
  isLive: false
});

describe("session behavior", () => {
  it("does not mark scan as seen until commit and keeps removed articles in the union", () => {
    const state = emptyState();
    startOrReplaceSession(state, 1, "a", [article(1), article(2)], 10);
    mergeSnapshot(state, 1, "a", [article(2)], 20);
    expect(state.history["rtv:1"]).toBeUndefined();
    commitSession(state, 1, "a", 30);
    expect(Object.keys(state.history).sort()).toEqual(["rtv:1", "rtv:2"]);
  });

  it("opening persists immediately and duplicate commit is idempotent", () => {
    const state = emptyState();
    markArticleOpened(state, 1, "a", article(1), 10);
    expect(state.history["rtv:1"]?.openedAt).toBe(10);
    commitSession(state, 1, "a", 20);
    commitSession(state, 1, "a", 30);
    expect(Object.keys(state.history)).toEqual(["rtv:1"]);
    expect(state.history["rtv:1"]?.openedAt).toBe(10);
  });

  it("can abandon a same-tab article navigation without marking the rest as seen", () => {
    const state = emptyState();
    startOrReplaceSession(state, 1, "a", [article(1), article(2), article(3)], 10);
    markArticleOpened(state, 1, "a", article(1), 15);
    abandonSession(state, 1, "a", 16);
    mergeSnapshot(state, 1, "a", [article(2), article(3)], 17);
    reconcileLeftoverPendingSessions(state, 30);
    expect(Object.keys(state.history)).toEqual(["rtv:1"]);
    expect(state.history["rtv:1"]?.openedAt).toBe(15);
    expect(state.history["rtv:2"]).toBeUndefined();
    expect(state.history["rtv:3"]).toBeUndefined();
  });

  it("replaces same-tab homepage sessions without marking auto-refreshed stories as seen", () => {
    const state = emptyState();
    startOrReplaceSession(state, 1, "a", [article(1), article(2)], 10);
    startOrReplaceSession(state, 1, "b", [article(2), article(3)], 20);
    startOrReplaceSession(state, 1, "c", [article(3), article(4)], 30);

    expect(state.history["rtv:1"]).toBeUndefined();
    expect(state.history["rtv:2"]).toBeUndefined();
    expect(state.pendingSessions["1:a"]).toBeUndefined();
    expect(state.pendingSessions["1:b"]).toBeUndefined();

    commitSession(state, 1, "c", 40);
    expect(Object.keys(state.history).sort()).toEqual(["rtv:3", "rtv:4"]);
  });

  it("reconciles leftover pending sessions", () => {
    const state = emptyState();
    mergeSnapshot(state, 1, "a", [article(1)], 10);
    reconcileLeftoverPendingSessions(state, 20);
    expect(state.pendingSessions).toEqual({});
    expect(state.history["rtv:1"]).toBeDefined();
  });

  it("concurrent-like updates do not erase existing records", () => {
    const state = emptyState();
    mergeSnapshot(state, 1, "a", [article(1)], 10);
    mergeSnapshot(state, 2, "b", [article(2)], 11);
    commitSession(state, 1, "a", 20);
    commitSession(state, 2, "b", 21);
    expect(Object.keys(state.history).sort()).toEqual(["rtv:1", "rtv:2"]);
  });

  it("pruning retains newest records", () => {
    const state = emptyState();
    for (let i = 0; i < 10_005; i += 1) {
      state.history[`rtv:${i}`] = {
        key: `rtv:${i}`,
        canonicalUrl: `https://www.rtvslo.si/test/${i}`,
        lastTitle: String(i),
        firstSeenAt: i,
        lastSeenAt: i
      };
    }
    pruneHistory(state.history, 10_000);
    expect(Object.keys(state.history)).toHaveLength(10_000);
    expect(state.history["rtv:0"]).toBeUndefined();
    expect(state.history["rtv:10004"]).toBeDefined();
  });
});
