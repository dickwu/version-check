"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setComposerCacheTtl = setComposerCacheTtl;
exports.clearComposerCache = clearComposerCache;
exports.fetchLatestComposerVersion = fetchLatestComposerVersion;
exports.fetchComposerVersions = fetchComposerVersions;
const http_1 = require("../../utils/http");
const semver_1 = require("../../utils/semver");
const latestCache = new Map();
const versionsCache = new Map();
let cacheTtlMs = 300000; // 5 minutes default
function setComposerCacheTtl(ttlMs) {
    cacheTtlMs = ttlMs;
}
function clearComposerCache() {
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
async function fetchLatestComposerVersion(packageName) {
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
async function fetchComposerVersions(packageName) {
    const cached = getCached(versionsCache, packageName);
    if (cached !== undefined) {
        return cached;
    }
    const [vendor, name] = packageName.split("/");
    if (!vendor || !name) {
        return null;
    }
    const url = `https://packagist.org/packages/${encodeURIComponent(vendor)}/${encodeURIComponent(name)}.json`;
    const response = await (0, http_1.getJson)(url);
    const versions = response.package?.versions ? Object.keys(response.package.versions) : [];
    const result = versions.length ? versions : null;
    setCached(versionsCache, packageName, result);
    return result;
}
function pickLatestVersion(versions) {
    let bestVersion = null;
    let bestSemver = null;
    for (const version of versions) {
        const semver = (0, semver_1.extractSemver)(version);
        if (!semver) {
            continue;
        }
        if (!bestSemver || (0, semver_1.compareSemver)(bestSemver, semver) < 0) {
            bestSemver = semver;
            bestVersion = version;
        }
    }
    return bestVersion;
}
//# sourceMappingURL=registry.js.map