"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setGoCacheTtl = setGoCacheTtl;
exports.clearGoCache = clearGoCache;
exports.fetchLatestGoVersion = fetchLatestGoVersion;
exports.fetchGoVersions = fetchGoVersions;
const http_1 = require("../../utils/http");
const latestCache = new Map();
const versionsCache = new Map();
let cacheTtlMs = 300000; // 5 minutes default
function setGoCacheTtl(ttlMs) {
    cacheTtlMs = ttlMs;
}
function clearGoCache() {
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
async function fetchLatestGoVersion(modulePath) {
    const cached = getCached(latestCache, modulePath);
    if (cached !== undefined) {
        return cached;
    }
    const encoded = encodeURIComponent(modulePath);
    const url = `https://proxy.golang.org/${encoded}/@latest`;
    const response = await (0, http_1.getJson)(url);
    const result = response.Version ?? null;
    setCached(latestCache, modulePath, result);
    return result;
}
async function fetchGoVersions(modulePath) {
    const cached = getCached(versionsCache, modulePath);
    if (cached !== undefined) {
        return cached;
    }
    const encoded = encodeURIComponent(modulePath);
    const url = `https://proxy.golang.org/${encoded}/@v/list`;
    const response = await (0, http_1.getText)(url);
    const versions = response
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    const result = versions.length ? versions : null;
    setCached(versionsCache, modulePath, result);
    return result;
}
//# sourceMappingURL=registry.js.map