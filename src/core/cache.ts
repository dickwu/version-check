type CacheEntry = {
  value: string;
  timestamp: number;
};

export class VersionCache {
  private ttlMs: number;
  private entries: Map<string, CacheEntry>;

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs;
    this.entries = new Map();
  }

  setTtl(ttlMs: number) {
    this.ttlMs = ttlMs;
  }

  get(key: string): string | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: string) {
    this.entries.set(key, { value, timestamp: Date.now() });
  }

  clear() {
    this.entries.clear();
  }
}
