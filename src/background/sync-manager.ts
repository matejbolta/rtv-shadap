import { restrictSyncStorageAccess, storageSyncGet, storageSyncSet } from "../shared/chrome-api";
import type { ArticleHistoryRecord, StorageState } from "../shared/models";
import type { Repository } from "./repository";

export const SYNC_META_KEY = "rtvShadapSyncMeta";
export const SYNC_BUCKET_COUNT = 16;
export const MAX_SYNC_ENTRIES = 3_000;

const SYNC_BUCKET_PREFIX = "rtvShadapSyncBucket";
const SYNC_SCHEMA_VERSION = 1;
const MAX_SYNC_ITEM_BYTES = 7_600;
const MAX_SYNC_TOTAL_BYTES = 90_000;
const DAY_MS = 86_400_000;

export interface SyncMeta {
  v: 1;
  g: string;
  r: number;
}

export interface SyncSnapshot {
  meta: SyncMeta;
  entries: Map<string, number>;
}

interface SyncBucket {
  v: 1;
  g: string;
  e: Array<[string, number]>;
}

export class BrowserSyncManager {
  private queue = Promise.resolve();

  constructor(
    private readonly repository: Repository,
    private readonly onRemoteHistoryChanged: () => void
  ) {}

  initialize(): Promise<void> {
    return this.enqueue(async () => {
      await restrictSyncStorageAccess().catch(() => undefined);
      await this.reconcile();
    });
  }

  pushLocalChanges(): Promise<void> {
    return this.enqueue(() => this.reconcile());
  }

  handleStorageChange(changes: Record<string, chrome.storage.StorageChange>): Promise<void> {
    if (!Object.keys(changes).some(isSyncStorageKey)) return Promise.resolve();
    return this.enqueue(() => this.reconcile());
  }

  resetHistory(): Promise<void> {
    return this.enqueue(async () => {
      const current = await this.repository.read();
      if (current.settings.syncMode !== "browser") {
        await this.repository.mutate((state) => {
          state.history = {};
        });
        return;
      }

      const generation = createGeneration();
      const resetAt = Date.now();
      await this.repository.mutate((state) => {
        state.history = {};
        state.sync = { generation, resetAt };
      });
      const remote = await storageSyncGet(syncStorageKeys());
      await writeChangedPayload(remote, buildSyncPayload({}, generation, resetAt));
    });
  }

  private enqueue(task: () => Promise<void>): Promise<void> {
    const run = this.queue.then(task);
    this.queue = run.then(() => undefined, () => undefined);
    return run;
  }

  private async reconcile(): Promise<void> {
    let local = await this.repository.read();
    if (local.settings.syncMode !== "browser") return;

    const remoteItems = await storageSyncGet(syncStorageKeys());
    const remote = parseSyncSnapshot(remoteItems);
    if (!remote) {
      const generation = local.sync.generation ?? createGeneration();
      const resetAt = local.sync.resetAt;
      if (local.sync.generation !== generation) {
        await this.repository.mutate((state) => {
          state.sync = { generation, resetAt };
        });
        local = await this.repository.read();
      }
      await writeChangedPayload(remoteItems, buildSyncPayload(local.history, generation, resetAt));
      return;
    }

    if (local.sync.generation && local.sync.resetAt > remote.meta.r) {
      await writeChangedPayload(
        remoteItems,
        buildSyncPayload(local.history, local.sync.generation, local.sync.resetAt)
      );
      return;
    }

    const knewGeneration = Boolean(local.sync.generation);
    let historyChanged = false;
    await this.repository.mutate((state) => {
      if (state.settings.syncMode !== "browser") return;
      const remoteResetIsNewer = knewGeneration && remote.meta.r > state.sync.resetAt;
      if (remoteResetIsNewer) {
        const historyAfterReset = Object.fromEntries(
          Object.entries(state.history).filter(([, record]) => record.lastSeenAt > remote.meta.r)
        );
        historyChanged = Object.keys(historyAfterReset).length !== Object.keys(state.history).length;
        state.history = historyAfterReset;
      }
      state.sync = { generation: remote.meta.g, resetAt: remote.meta.r };
      historyChanged = mergeRemoteEntries(state, remote.entries) || historyChanged;
    });

    local = await this.repository.read();
    if (local.settings.syncMode !== "browser") return;
    await writeChangedPayload(
      remoteItems,
      buildSyncPayload(local.history, remote.meta.g, remote.meta.r)
    );
    if (historyChanged) this.onRemoteHistoryChanged();
  }
}

export function buildSyncPayload(
  history: Record<string, ArticleHistoryRecord>,
  generation: string,
  resetAt: number
): Record<string, unknown> {
  const meta: SyncMeta = { v: SYNC_SCHEMA_VERSION, g: generation, r: resetAt };
  const buckets = Array.from({ length: SYNC_BUCKET_COUNT }, () => [] as Array<[string, number]>);
  const entries = Object.values(history)
    .map((record) => [encodeArticleKey(record.key), toEpochDay(record.lastSeenAt)] as [string, number])
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_SYNC_ENTRIES);

  for (const entry of entries) buckets[bucketIndex(entry[0])]?.push(entry);

  for (let index = 0; index < buckets.length; index += 1) {
    const bucket = buckets[index];
    if (!bucket) continue;
    while (bucket.length > 0 && itemBytes(syncBucketKey(index), toBucket(generation, bucket)) > MAX_SYNC_ITEM_BYTES) {
      bucket.pop();
    }
  }

  let payload = payloadFromBuckets(meta, buckets);
  while (payloadBytes(payload) > MAX_SYNC_TOTAL_BYTES) {
    const oldestBucket = findOldestBucket(buckets);
    if (oldestBucket == null) break;
    buckets[oldestBucket]?.pop();
    payload = payloadFromBuckets(meta, buckets);
  }
  return payload;
}

export function parseSyncSnapshot(items: Record<string, unknown>): SyncSnapshot | null {
  const meta = parseMeta(items[SYNC_META_KEY]);
  if (!meta) return null;
  const entries = new Map<string, number>();
  for (let index = 0; index < SYNC_BUCKET_COUNT; index += 1) {
    const bucket = parseBucket(items[syncBucketKey(index)], meta.g);
    if (!bucket) continue;
    for (const [encodedKey, day] of bucket.e) {
      const key = decodeArticleKey(encodedKey);
      if (!key) continue;
      entries.set(key, Math.max(entries.get(key) ?? 0, day));
    }
  }
  return { meta, entries };
}

export function mergeRemoteEntries(state: StorageState, entries: Map<string, number>): boolean {
  let changed = false;
  for (const [key, day] of entries) {
    const timestamp = day * DAY_MS;
    const existing = state.history[key];
    if (existing) {
      if (timestamp > existing.lastSeenAt) {
        existing.lastSeenAt = timestamp;
        changed = true;
      }
      if (timestamp < existing.firstSeenAt) {
        existing.firstSeenAt = timestamp;
        changed = true;
      }
      continue;
    }
    state.history[key] = {
      key,
      articleId: numericArticleId(key),
      canonicalUrl: "",
      lastTitle: "",
      firstSeenAt: timestamp,
      lastSeenAt: timestamp
    };
    changed = true;
  }
  return changed;
}

export function encodeArticleKey(key: string): string {
  if (/^rtv:\d+$/.test(key)) return `r${key.slice(4)}`;
  if (/^rtv365:\d+$/.test(key)) return `m${key.slice(7)}`;
  if (key.startsWith("url:")) return `u${key.slice(4)}`;
  return `x${key}`;
}

export function decodeArticleKey(encoded: string): string | null {
  if (/^r\d+$/.test(encoded)) return `rtv:${encoded.slice(1)}`;
  if (/^m\d+$/.test(encoded)) return `rtv365:${encoded.slice(1)}`;
  if (encoded.startsWith("u/")) return `url:${encoded.slice(1)}`;
  if (encoded.startsWith("x") && encoded.length > 1) return encoded.slice(1);
  return null;
}

export function syncStorageKeys(): string[] {
  return [SYNC_META_KEY, ...Array.from({ length: SYNC_BUCKET_COUNT }, (_, index) => syncBucketKey(index))];
}

function payloadFromBuckets(meta: SyncMeta, buckets: Array<Array<[string, number]>>): Record<string, unknown> {
  const payload: Record<string, unknown> = { [SYNC_META_KEY]: meta };
  for (let index = 0; index < SYNC_BUCKET_COUNT; index += 1) {
    payload[syncBucketKey(index)] = toBucket(meta.g, buckets[index] ?? []);
  }
  return payload;
}

function toBucket(generation: string, entries: Array<[string, number]>): SyncBucket {
  return { v: SYNC_SCHEMA_VERSION, g: generation, e: entries };
}

function parseMeta(value: unknown): SyncMeta | null {
  if (!isRecord(value)) return null;
  if (value.v !== SYNC_SCHEMA_VERSION || typeof value.g !== "string" || typeof value.r !== "number") return null;
  return { v: SYNC_SCHEMA_VERSION, g: value.g, r: value.r };
}

function parseBucket(value: unknown, generation: string): SyncBucket | null {
  if (!isRecord(value) || value.v !== SYNC_SCHEMA_VERSION || value.g !== generation || !Array.isArray(value.e)) return null;
  const entries = value.e.filter((entry): entry is [string, number] => (
    Array.isArray(entry)
    && typeof entry[0] === "string"
    && typeof entry[1] === "number"
    && Number.isInteger(entry[1])
    && entry[1] >= 0
  ));
  return { v: SYNC_SCHEMA_VERSION, g: generation, e: entries };
}

async function writeChangedPayload(current: Record<string, unknown>, desired: Record<string, unknown>): Promise<void> {
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(desired)) {
    if (JSON.stringify(current[key]) !== JSON.stringify(value)) updates[key] = value;
  }
  if (Object.keys(updates).length > 0) await storageSyncSet(updates);
}

function syncBucketKey(index: number): string {
  return `${SYNC_BUCKET_PREFIX}${index.toString(16).padStart(2, "0")}`;
}

function isSyncStorageKey(key: string): boolean {
  return key === SYNC_META_KEY || key.startsWith(SYNC_BUCKET_PREFIX);
}

function bucketIndex(key: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0) % SYNC_BUCKET_COUNT;
}

function toEpochDay(timestamp: number): number {
  return Math.max(0, Math.floor(timestamp / DAY_MS));
}

function numericArticleId(key: string): string | undefined {
  return /^(?:rtv|rtv365):(\d+)$/.exec(key)?.[1];
}

function createGeneration(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function findOldestBucket(buckets: Array<Array<[string, number]>>): number | null {
  let selected: number | null = null;
  let oldestDay = Number.POSITIVE_INFINITY;
  for (let index = 0; index < buckets.length; index += 1) {
    const last = buckets[index]?.at(-1);
    if (last && last[1] < oldestDay) {
      selected = index;
      oldestDay = last[1];
    }
  }
  return selected;
}

function payloadBytes(payload: Record<string, unknown>): number {
  return Object.entries(payload).reduce((total, [key, value]) => total + itemBytes(key, value), 0);
}

function itemBytes(key: string, value: unknown): number {
  return key.length + JSON.stringify(value).length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
