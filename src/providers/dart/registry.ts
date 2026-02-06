import { getJson } from "../../utils/http";

type PubPackageResponse = {
  latest?: {
    version?: string;
  };
  versions?: Array<{
    version?: string;
  }>;
};

type CacheEntry<T> = {
  value: T;
  timestamp: number;
};

const latestCache = new Map<string, CacheEntry<string | null>>();
const versionsCache = new Map<string, CacheEntry<string[] | null>>();
let cacheTtlMs = 300_000; // 5 minutes default

export function setDartCacheTtl(ttlMs: number) {
  cacheTtlMs = ttlMs;
}

export function clearDartCache() {
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

export async function fetchLatestDartVersion(packageName: string): Promise<string | null> {
  const cached = getCached(latestCache, packageName);
  if (cached !== undefined) {
    return cached;
  }

  const encoded = encodeURIComponent(packageName);
  const url = `https://pub.dev/api/packages/${encoded}`;
  const response = await getJson<PubPackageResponse>(url);
  const result = response.latest?.version ?? null;

  setCached(latestCache, packageName, result);
  return result;
}

export async function fetchDartVersions(packageName: string): Promise<string[] | null> {
  const cached = getCached(versionsCache, packageName);
  if (cached !== undefined) {
    return cached;
  }

  const encoded = encodeURIComponent(packageName);
  const url = `https://pub.dev/api/packages/${encoded}`;
  const response = await getJson<PubPackageResponse>(url);
  const versions = response.versions
    ?.map((v) => v.version)
    .filter((v): v is string => typeof v === "string") ?? [];
  const result = versions.length ? versions : null;

  setCached(versionsCache, packageName, result);
  return result;
}
