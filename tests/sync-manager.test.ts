import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyState } from "../src/background/repository";
import type { Repository } from "../src/background/repository";
import {
  BrowserSyncManager,
  MAX_SYNC_ENTRIES,
  buildSyncPayload,
  decodeArticleKey,
  encodeArticleKey,
  mergeRemoteEntries,
  parseSyncSnapshot
} from "../src/background/sync-manager";
import type { ArticleHistoryRecord, StorageState } from "../src/shared/models";

const DAY_MS = 86_400_000;

function historyRecord(index: number): ArticleHistoryRecord {
  return {
    key: `rtv:${index}`,
    articleId: String(index),
    canonicalUrl: `https://www.rtvslo.si/test/${index}`,
    lastTitle: `Naslov ${index}`,
    firstSeenAt: index * DAY_MS,
    lastSeenAt: index * DAY_MS
  };
}

class FakeRepository {
  constructor(public state: StorageState) {}

  async read(): Promise<StorageState> {
    return structuredClone(this.state);
  }

  async mutate<T>(mutator: (state: StorageState) => T | Promise<T>): Promise<T> {
    const next = structuredClone(this.state);
    const result = await mutator(next);
    this.state = next;
    return result;
  }
}

let syncItems: Record<string, unknown>;
let syncGetCount: number;
let syncSetCount: number;

beforeEach(() => {
  syncItems = {};
  syncGetCount = 0;
  syncSetCount = 0;
  vi.stubGlobal("chrome", {
    runtime: { lastError: undefined },
    storage: {
      sync: {
        get: (keys: string[] | null, callback: (items: Record<string, unknown>) => void) => {
          syncGetCount += 1;
          if (!keys) callback(structuredClone(syncItems));
          else callback(Object.fromEntries(keys.filter((key) => key in syncItems).map((key) => [key, structuredClone(syncItems[key])])));
        },
        set: (items: Record<string, unknown>, callback: () => void) => {
          syncSetCount += 1;
          Object.assign(syncItems, structuredClone(items));
          callback();
        },
        setAccessLevel: (_options: unknown, callback: () => void) => callback()
      }
    }
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("browser sync compaction", () => {
  it("round-trips compact article, media, and fallback keys", () => {
    for (const key of ["rtv:786788", "rtv365:175232950", "url:/posebno/dolg-naslov"]) {
      expect(decodeArticleKey(encodeArticleKey(key))).toBe(key);
    }
  });

  it("keeps the newest entries within Chrome sync quotas", () => {
    const history = Object.fromEntries(
      Array.from({ length: MAX_SYNC_ENTRIES + 200 }, (_, index) => [`rtv:${index}`, historyRecord(index)])
    );
    const payload = buildSyncPayload(history, "generation-a", 0);
    const snapshot = parseSyncSnapshot(payload);

    expect(snapshot?.entries.size).toBe(MAX_SYNC_ENTRIES);
    expect(snapshot?.entries.has(`rtv:${MAX_SYNC_ENTRIES + 199}`)).toBe(true);
    expect(snapshot?.entries.has("rtv:0")).toBe(false);
    const totalBytes = Object.entries(payload)
      .reduce((sum, [key, value]) => sum + key.length + JSON.stringify(value).length, 0);
    expect(totalBytes).toBeLessThanOrEqual(90_000);
    for (const [key, value] of Object.entries(payload)) {
      expect(key.length + JSON.stringify(value).length).toBeLessThanOrEqual(7_600);
    }
  });

  it("merges remote IDs into permanent local history without deleting metadata", () => {
    const state = emptyState();
    state.history["rtv:1"] = historyRecord(1);
    const changed = mergeRemoteEntries(state, new Map([
      ["rtv:1", 5],
      ["rtv365:175232950", 6]
    ]));

    expect(changed).toBe(true);
    expect(state.history["rtv:1"]?.lastTitle).toBe("Naslov 1");
    expect(state.history["rtv:1"]?.lastSeenAt).toBe(5 * DAY_MS);
    expect(state.history["rtv365:175232950"]).toMatchObject({
      articleId: "175232950",
      firstSeenAt: 6 * DAY_MS,
      lastSeenAt: 6 * DAY_MS
    });
  });

  it("ignores buckets from an obsolete reset generation", () => {
    const payload = buildSyncPayload({ "rtv:1": historyRecord(1) }, "old", 0);
    const newMetaPayload = buildSyncPayload({}, "new", 100);
    const mixed = { ...payload, rtvShadapSyncMeta: newMetaPayload.rtvShadapSyncMeta };

    expect(parseSyncSnapshot(mixed)?.entries.size).toBe(0);
  });

  it("does not read or write the sync payload while the device is local-only", async () => {
    const repository = new FakeRepository(emptyState());
    repository.state.settings.syncMode = "local";
    const manager = new BrowserSyncManager(repository as unknown as Repository, vi.fn());

    await manager.initialize();

    expect(syncGetCount).toBe(0);
    expect(syncSetCount).toBe(0);
  });

  it("replaces synced history with a new empty generation on global reset", async () => {
    const state = emptyState();
    state.settings.syncMode = "browser";
    state.sync = { generation: "old-generation", resetAt: 0 };
    state.history = { "rtv:1": historyRecord(1) };
    syncItems = buildSyncPayload(state.history, "old-generation", 0);
    const repository = new FakeRepository(state);
    const manager = new BrowserSyncManager(repository as unknown as Repository, vi.fn());

    await manager.resetHistory();

    const remote = parseSyncSnapshot(syncItems);
    expect(repository.state.history).toEqual({});
    expect(remote?.entries.size).toBe(0);
    expect(remote?.meta.g).not.toBe("old-generation");
    expect(repository.state.sync).toEqual({
      generation: remote?.meta.g,
      resetAt: remote?.meta.r
    });
  });

  it("drops pre-reset offline history but preserves marks made after the remote reset", async () => {
    const resetAt = 10 * DAY_MS + 1_000;
    syncItems = buildSyncPayload({ "rtv:12": historyRecord(12) }, "new-generation", resetAt);

    const state = emptyState();
    state.settings.syncMode = "browser";
    state.sync = { generation: "old-generation", resetAt: 5 * DAY_MS };
    state.history = {
      "rtv:9": historyRecord(9),
      "rtv:11": historyRecord(11)
    };
    const repository = new FakeRepository(state);
    const onRemoteHistoryChanged = vi.fn();
    const manager = new BrowserSyncManager(
      repository as unknown as Repository,
      onRemoteHistoryChanged
    );

    await manager.initialize();

    expect(repository.state.history["rtv:9"]).toBeUndefined();
    expect(repository.state.history["rtv:11"]).toBeDefined();
    expect(repository.state.history["rtv:12"]).toBeDefined();
    expect(repository.state.sync).toEqual({ generation: "new-generation", resetAt });
    expect(parseSyncSnapshot(syncItems)?.entries.has("rtv:9")).toBe(false);
    expect(parseSyncSnapshot(syncItems)?.entries.has("rtv:11")).toBe(true);
    expect(parseSyncSnapshot(syncItems)?.entries.has("rtv:12")).toBe(true);
    expect(onRemoteHistoryChanged).toHaveBeenCalledOnce();
  });
});
