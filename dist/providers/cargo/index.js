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
    async getLatestVersion(packageName) {
        return (0, registry_1.fetchLatestCargoVersion)(packageName);
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
//# sourceMappingURL=index.js.map