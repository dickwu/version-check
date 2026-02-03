"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSemver = parseSemver;
exports.extractSemver = extractSemver;
exports.compareSemver = compareSemver;
exports.shouldIgnoreVersion = shouldIgnoreVersion;
exports.isVersionOutdated = isVersionOutdated;
exports.formatUpdatedVersion = formatUpdatedVersion;
exports.isPrerelease = isPrerelease;
exports.filterStableVersions = filterStableVersions;
exports.pickLatestStable = pickLatestStable;
const SEMVER_REGEX = /(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/;
function parseSemver(input) {
    const match = SEMVER_REGEX.exec(input);
    if (!match) {
        return null;
    }
    return {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3]),
        prerelease: match[4]
    };
}
function extractSemver(input) {
    const trimmed = input.trim().replace(/^v/, "");
    return parseSemver(trimmed);
}
function compareSemver(a, b) {
    if (a.major !== b.major) {
        return a.major < b.major ? -1 : 1;
    }
    if (a.minor !== b.minor) {
        return a.minor < b.minor ? -1 : 1;
    }
    if (a.patch !== b.patch) {
        return a.patch < b.patch ? -1 : 1;
    }
    if (!a.prerelease && b.prerelease) {
        return 1;
    }
    if (a.prerelease && !b.prerelease) {
        return -1;
    }
    if (a.prerelease && b.prerelease && a.prerelease !== b.prerelease) {
        return a.prerelease < b.prerelease ? -1 : 1;
    }
    return 0;
}
function shouldIgnoreVersion(currentVersion) {
    const trimmed = currentVersion.trim();
    if (!trimmed) {
        return true;
    }
    if (trimmed === "*" || trimmed.toLowerCase() === "latest") {
        return true;
    }
    if (/^(workspace:|file:|link:|path:|git:|github:|http:|https:)/i.test(trimmed)) {
        return true;
    }
    if (/^dev-/i.test(trimmed)) {
        return true;
    }
    return false;
}
function isVersionOutdated(currentVersion, latestVersion) {
    if (shouldIgnoreVersion(currentVersion)) {
        return false;
    }
    const current = extractSemver(currentVersion);
    const latest = extractSemver(latestVersion);
    if (!current || !latest) {
        return false;
    }
    return compareSemver(current, latest) < 0;
}
function formatUpdatedVersion(currentVersion, latestVersion) {
    const trimmed = currentVersion.trim();
    const latestTrimmed = latestVersion.trim();
    const latestSemver = extractSemver(latestTrimmed);
    const prefixMatch = latestSemver ? trimmed.match(/^(\\^|~|>=|<=|>|<|=)/) : null;
    const prefix = prefixMatch ? prefixMatch[1] : "";
    const latest = trimmed.startsWith("v") && !latestTrimmed.startsWith("v")
        ? `v${latestTrimmed}`
        : latestTrimmed;
    return `${prefix}${latest}`;
}
function isPrerelease(version, patterns) {
    if (!patterns.length) {
        return false;
    }
    const lower = version.toLowerCase();
    return patterns.some((pattern) => lower.includes(pattern.toLowerCase()));
}
function filterStableVersions(versions, patterns) {
    if (!patterns.length) {
        return versions;
    }
    return versions.filter((v) => !isPrerelease(v, patterns));
}
function pickLatestStable(versions, patterns) {
    const stable = filterStableVersions(versions, patterns);
    if (!stable.length) {
        return null;
    }
    let best = null;
    let bestSemver = null;
    for (const version of stable) {
        const semver = extractSemver(version);
        if (!semver) {
            continue;
        }
        if (!bestSemver || compareSemver(bestSemver, semver) < 0) {
            bestSemver = semver;
            best = version;
        }
    }
    return best;
}
//# sourceMappingURL=semver.js.map