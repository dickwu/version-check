"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setDartCacheTtl = setDartCacheTtl;
exports.clearDartCache = clearDartCache;
exports.fetchLatestDartVersion = fetchLatestDartVersion;
exports.fetchDartVersions = fetchDartVersions;
const http_1 = require("../../utils/http");
const latestCache = new Map();
const versionsCache = new Map();
let cacheTtlMs = 300000; // 5 minutes default
function setDartCacheTtl(ttlMs) {
    cacheTtlMs = ttlMs;
}
function clearDartCache() {
    latestCache.clear();
    versionsCache.clear();
}
function getCached(cache, key) {
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
function setCached(cache, key, value) {
    cache.set(key, { value, timestamp: Date.now() });
}
async function fetchLatestDartVersion(packageName) {
    const cached = getCached(latestCache, packageName);
    if (cached !== undefined) {
        return cached;
    }
    const encoded = encodeURIComponent(packageName);
    const url = `https://pub.dev/api/packages/${encoded}`;
    const response = await (0, http_1.getJson)(url);
    const result = response.latest?.version ?? null;
    setCached(latestCache, packageName, result);
    return result;
}
async function fetchDartVersions(packageName) {
    const cached = getCached(versionsCache, packageName);
    if (cached !== undefined) {
        return cached;
    }
    const encoded = encodeURIComponent(packageName);
    const url = `https://pub.dev/api/packages/${encoded}`;
    const response = await (0, http_1.getJson)(url);
    const versions = response.versions
        ?.map((v) => v.version)
        .filter((v) => typeof v === "string") ?? [];
    const result = versions.length ? versions : null;
    setCached(versionsCache, packageName, result);
    return result;
}
//# sourceMappingURL=registry.js.map