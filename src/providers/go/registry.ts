import { getJson, getText } from "../../utils/http";

type GoLatestResponse = {
  Version?: string;
};

type CacheEntry<T> = {
  value: T;
  timestamp: number;
};

const latestCache = new Map<string, CacheEntry<string | null>>();
const versionsCache = new Map<string, CacheEntry<string[] | null>>();
let cacheTtlMs = 300_000; // 5 minutes default

export function setGoCacheTtl(ttlMs: number) {
  cacheTtlMs = ttlMs;
}

export function clearGoCache() {
  latestCache.clear();
  versionsCache.clear();
}

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) {
    return undefined;
  }
  if (Date.now() - entry.timestamp > cacheTtlMs) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCached<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T) {
  cache.set(key, { value, timestamp: Date.now() });
}

export async function fetchLatestGoVersion(modulePath: string): Promise<string | null> {
  const cached = getCached(latestCache, modulePath);
  if (cached !== undefined) {
    return cached;
  }

  const encoded = encodeURIComponent(modulePath);
  const url = `https://proxy.golang.org/${encoded}/@latest`;
  const response = await getJson<GoLatestResponse>(url);
  const result = response.Version ?? null;

  setCached(latestCache, modulePath, result);
  return result;
}

export async function fetchGoVersions(modulePath: string): Promise<string[] | null> {
  const cached = getCached(versionsCache, modulePath);
  if (cached !== undefined) {
    return cached;
  }

  const encoded = encodeURIComponent(modulePath);
  const url = `https://proxy.golang.org/${encoded}/@v/list`;
  const response = await getText(url);
  const versions = response
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const result = versions.length ? versions : null;

  setCached(versionsCache, modulePath, result);
  return result;
}
