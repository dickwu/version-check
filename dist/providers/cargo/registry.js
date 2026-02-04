"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setCargoCacheTtl = setCargoCacheTtl;
exports.clearCargoCache = clearCargoCache;
exports.fetchLatestCargoVersion = fetchLatestCargoVersion;
exports.fetchCargoVersions = fetchCargoVersions;
const http_1 = require("../../utils/http");
const latestCache = new Map();
const versionsCache = new Map();
let cacheTtlMs = 300000; // 5 minutes default
function setCargoCacheTtl(ttlMs) {
    cacheTtlMs = ttlMs;
}
function clearCargoCache() {
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
let lastRequestAt = 0;
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function rateLimit() {
    const now = Date.now();
    const elapsed = now - lastRequestAt;
    if (elapsed < 1000) {
        await delay(1000 - elapsed);
    }
    lastRequestAt = Date.now();
}
async function request(url) {
    await rateLimit();
    return (0, http_1.getJson)(url, {
        "User-Agent": "version-check-vscode"
    });
}
async function fetchLatestCargoVersion(crateName) {
    const cached = getCached(latestCache, crateName);
    if (cached !== undefined) {
        return cached;
    }
    const url = `https://crates.io/api/v1/crates/${encodeURIComponent(crateName)}`;
    const response = await request(url);
    const result = response.crate?.max_version ?? null;
    setCached(latestCache, crateName, result);
    return result;
}
async function fetchCargoVersions(crateName) {
    const cached = getCached(versionsCache, crateName);
    if (cached !== undefined) {
        return cached;
    }
    const url = `https://crates.io/api/v1/crates/${encodeURIComponent(crateName)}/versions`;
    const response = await request(url);
    const versions = (response.versions ?? [])
        .map((item) => item.num)
        .filter((value) => Boolean(value));
    const result = versions.length ? versions : null;
    setCached(versionsCache, crateName, result);
    return result;
}
//# sourceMappingURL=registry.js.map