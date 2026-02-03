"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CargoProvider = void 0;
const parser_1 = require("./parser");
const registry_1 = require("./registry");
const semver_1 = require("../../utils/semver");
class CargoProvider {
    constructor() {
        this.id = "cargo";
        this.displayName = "Cargo";
        this.fileNames = ["Cargo.toml"];
    }
    parseDocument(document) {
        return (0, parser_1.parseCargoDependencies)(document);
    }
    async getLatestVersion(packageName, ignorePatterns) {
        const latest = await (0, registry_1.fetchLatestCargoVersion)(packageName);
        if (!latest || !ignorePatterns?.length) {
            return latest;
        }
        if (!(0, semver_1.isPrerelease)(latest, ignorePatterns)) {
            return latest;
        }
        const versions = await (0, registry_1.fetchCargoVersions)(packageName);
        if (!versions) {
            return null;
        }
        const stable = versions.filter((v) => !(0, semver_1.isPrerelease)(v, ignorePatterns));
        return pickLatest(stable);
    }
    async getAvailableVersions(packageName) {
        return (0, registry_1.fetchCargoVersions)(packageName);
    }
    formatUpdatedVersion(currentVersion, latestVersion) {
        return (0, semver_1.formatUpdatedVersion)(currentVersion, latestVersion);
    }
    shouldSkipVersion(currentVersion) {
        return (0, semver_1.shouldIgnoreVersion)(currentVersion);
    }
}
exports.CargoProvider = CargoProvider;
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