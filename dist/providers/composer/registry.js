"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchLatestComposerVersion = fetchLatestComposerVersion;
exports.fetchComposerVersions = fetchComposerVersions;
const http_1 = require("../../utils/http");
const semver_1 = require("../../utils/semver");
async function fetchLatestComposerVersion(packageName) {
    const versions = await fetchComposerVersions(packageName);
    if (!versions) {
        return null;
    }
    return pickLatestVersion(versions);
}
async function fetchComposerVersions(packageName) {
    const [vendor, name] = packageName.split("/");
    if (!vendor || !name) {
        return null;
    }
    const url = `https://packagist.org/packages/${encodeURIComponent(vendor)}/${encodeURIComponent(name)}.json`;
    const response = await (0, http_1.getJson)(url);
    const versions = response.package?.versions ? Object.keys(response.package.versions) : [];
    return versions.length ? versions : null;
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