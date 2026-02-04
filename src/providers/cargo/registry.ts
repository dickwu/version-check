import { getJson } from "../../utils/http";

type CrateResponse = {
  crate?: {
    max_version?: string;
  };
};

type CrateVersionsResponse = {
  versions?: Array<{
    num?: string;
  }>;
};

type CacheEntry<T> = {
  value: T;
  timestamp: number;
};

const latestCache = new Map<string, CacheEntry<string | null>>();
const versionsCache = new Map<string, CacheEntry<string[] | null>>();
let cacheTtlMs = 300_000; // 5 minutes default

export function setCargoCacheTtl(ttlMs: number) {
  cacheTtlMs = ttlMs;
}

export function clearCargoCache() {
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

let lastRequestAt = 0;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestAt;
  if (elapsed < 1000) {
    await delay(1000 - elapsed);
  }
  lastRequestAt = Date.now();
}

async function request<T>(url: string): Promise<T> {
  await rateLimit();
  return getJson<T>(url, {
    "User-Agent": "version-check-vscode"
  });
}

export async function fetchLatestCargoVersion(crateName: string): Promise<string | null> {
  const cached = getCached(latestCache, crateName);
  if (cached !== undefined) {
    return cached;
  }

  const url = `https://crates.io/api/v1/crates/${encodeURIComponent(crateName)}`;
  const response = await request<CrateResponse>(url);
  const result = response.crate?.max_version ?? null;

  setCached(latestCache, crateName, result);
  return result;
}

export async function fetchCargoVersions(crateName: string): Promise<string[] | null> {
  const cached = getCached(versionsCache, crateName);
  if (cached !== undefined) {
    return cached;
  }

  const url = `https://crates.io/api/v1/crates/${encodeURIComponent(crateName)}/versions`;
  const response = await request<CrateVersionsResponse>(url);
  const versions = (response.versions ?? [])
    .map((item) => item.num)
    .filter((value): value is string => Boolean(value));
  const result = versions.length ? versions : null;

  setCached(versionsCache, crateName, result);
  return result;
}
