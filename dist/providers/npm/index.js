"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NpmProvider = void 0;
const parser_1 = require("./parser");
const registry_1 = require("./registry");
const semver_1 = require("../../utils/semver");
class NpmProvider {
    constructor() {
        this.id = "npm";
        this.displayName = "npm";
        this.fileNames = ["package.json"];
    }
    parseDocument(document) {
        return (0, parser_1.parseNpmDependencies)(document);
    }
    async getLatestVersion(packageName) {
        return (0, registry_1.fetchLatestNpmVersion)(packageName);
    }
    async getAvailableVersions(packageName) {
        return (0, registry_1.fetchNpmVersions)(packageName);
    }
    formatUpdatedVersion(currentVersion, latestVersion) {
        return (0, semver_1.formatUpdatedVersion)(currentVersion, latestVersion);
    }
    shouldSkipVersion(currentVersion) {
        return (0, semver_1.shouldIgnoreVersion)(currentVersion);
    }
}
exports.NpmProvider = NpmProvider;
//# sourceMappingURL=index.js.map