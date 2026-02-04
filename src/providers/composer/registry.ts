import { getJson } from "../../utils/http";
import { compareSemver, extractSemver } from "../../utils/semver";

type PackagistResponse = {
  package?: {
    versions?: Record<string, unknown>;
  };
};

type CacheEntry<T> = {
  value: T;
  timestamp: number;
};

const latestCache = new Map<string, CacheEntry<string | null>>();
const versionsCache = new Map<string, CacheEntry<string[] | null>>();
let cacheTtlMs = 300_000; // 5 minutes default

export function setComposerCacheTtl(ttlMs: number) {
  cacheTtlMs = ttlMs;
}

export function clearComposerCache() {
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

export async function fetchLatestComposerVersion(packageName: string): Promise<string | null> {
  const cached = getCached(latestCache, packageName);
  if (cached !== undefined) {
    return cached;
  }

  const versions = await fetchComposerVersions(packageName);
  if (!versions) {
    setCached(latestCache, packageName, null);
    return null;
  }
  const result = pickLatestVersion(versions);

  setCached(latestCache, packageName, result);
  return result;
}

export async function fetchComposerVersions(packageName: string): Promise<string[] | null> {
  const cached = getCached(versionsCache, packageName);
  if (cached !== undefined) {
    return cached;
  }

  const [vendor, name] = packageName.split("/");
  if (!vendor || !name) {
    return null;
  }
  const url = `https://packagist.org/packages/${encodeURIComponent(vendor)}/${encodeURIComponent(name)}.json`;
  const response = await getJson<PackagistResponse>(url);
  const versions = response.package?.versions ? Object.keys(response.package.versions) : [];
  const result = versions.length ? versions : null;

  setCached(versionsCache, packageName, result);
  return result;
}

function pickLatestVersion(versions: string[]): string | null {
  let bestVersion: string | null = null;
  let bestSemver: ReturnType<typeof extractSemver> | null = null;

  for (const version of versions) {
    const semver = extractSemver(version);
    if (!semver) {
      continue;
    }
    if (!bestSemver || compareSemver(bestSemver, semver) < 0) {
      bestSemver = semver;
      bestVersion = version;
    }
  }
  return bestVersion;
}
