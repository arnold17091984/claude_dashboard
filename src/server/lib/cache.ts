/**
 * Simple in-memory TTL cache.
 *
 * No external dependencies. Each entry stores the value and the expiry
 * timestamp (ms since epoch). Stale entries are evicted lazily on access
 * and eagerly by the optional periodic sweep.
 */

const MAX_ENTRIES = 500;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  insertedAt: number;
}

class TTLCache {
  private store = new Map<string, CacheEntry<unknown>>();

  /**
   * Read a cached value.
   * Returns `undefined` when the key is missing or has expired.
   */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /**
   * Store a value with a TTL (in seconds).
   * When the store exceeds MAX_ENTRIES, evict the oldest entry by insertion order.
   */
  set<T>(key: string, value: T, ttlSeconds: number): void {
    // If updating an existing key, delete first so it moves to "newest" position.
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= MAX_ENTRIES) {
      // Evict the oldest entry (Map preserves insertion order).
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
      insertedAt: Date.now(),
    });
  }

  /**
   * Remove a single key.
   */
  delete(key: string): void {
    this.store.delete(key);
  }

  /**
   * Remove all keys whose names start with a given prefix.
   * Useful for invalidating a whole route family (e.g. "overview:").
   */
  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Wipe the entire cache.
   */
  clear(): void {
    this.store.clear();
  }

  /** Current number of live (non-expired) entries. */
  get size(): number {
    const now = Date.now();
    let count = 0;
    for (const entry of this.store.values()) {
      if (entry.expiresAt > now) count++;
    }
    return count;
  }
}

// Singleton shared across the entire Node.js process.
export const cache = new TTLCache();

// ---------------------------------------------------------------------------
// TTL constants (seconds)
// ---------------------------------------------------------------------------
export const TTL = {
  /** Overview KPIs + activity chart */
  OVERVIEW: 60,
  /** User ranking table */
  RANKING: 60,
  /** Tool / model aggregations */
  AGGREGATIONS: 120,
} as const;

// ---------------------------------------------------------------------------
// Cache key helpers
// ---------------------------------------------------------------------------
export function overviewKey(period: string): string {
  return `overview:${period}`;
}

export function rankingKey(period: string, sortBy: string): string {
  return `ranking:${period}:${sortBy}`;
}

export function toolsUsageKey(period: string): string {
  return `tools:usage:${period}`;
}

export function toolsTrendKey(period: string): string {
  return `tools:trend:${period}`;
}

export function modelsUsageKey(period: string): string {
  return `models:usage:${period}`;
}

export function modelsCostKey(period: string): string {
  return `models:cost:${period}`;
}

/**
 * Call this after any ingest operation to purge stale dashboard data.
 * We don't know exactly which periods were affected, so we drop all
 * cached aggregations.
 */
export function invalidateAll(): void {
  cache.clear();
}
