"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoProvider = void 0;
const parser_1 = require("./parser");
const registry_1 = require("./registry");
const semver_1 = require("../../utils/semver");
class GoProvider {
    constructor() {
        this.id = "go";
        this.displayName = "Go";
        this.fileNames = ["go.mod"];
    }
    parseDocument(document) {
        return (0, parser_1.parseGoDependencies)(document);
    }
    async getLatestVersion(packageName, ignorePatterns) {
        const latest = await (0, registry_1.fetchLatestGoVersion)(packageName);
        if (!latest || !ignorePatterns?.length) {
            return latest;
        }
        if (!(0, semver_1.isPrerelease)(latest, ignorePatterns)) {
            return latest;
        }
        const versions = await (0, registry_1.fetchGoVersions)(packageName);
        if (!versions) {
            return null;
        }
        const stable = versions.filter((v) => !(0, semver_1.isPrerelease)(v, ignorePatterns));
        return pickLatest(stable);
    }
    async getAvailableVersions(packageName) {
        return (0, registry_1.fetchGoVersions)(packageName);
    }
    formatUpdatedVersion(currentVersion, latestVersion) {
        return (0, semver_1.formatUpdatedVersion)(currentVersion, latestVersion);
    }
    shouldSkipVersion(currentVersion) {
        return (0, semver_1.shouldIgnoreVersion)(currentVersion);
    }
}
exports.GoProvider = GoProvider;
function pickLatest(versions) {
    let best = null;
    let bestSemver = null;
    for (const v of versions) {
        const semver = (0, semver_1.extractSemver)(v);
        if (!semver)
            continue;
        if (!bestSemver || (0, semver_1.compareSemver)(bestSemver, semver) < 0) {
            bestSemver = semver;
            best = v;
        }
    }
    return best;
}
//# sourceMappingURL=index.js.map