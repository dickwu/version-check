"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComposerProvider = void 0;
const parser_1 = require("./parser");
const registry_1 = require("./registry");
const semver_1 = require("../../utils/semver");
class ComposerProvider {
    constructor() {
        this.id = "composer";
        this.displayName = "Composer";
        this.fileNames = ["composer.json"];
    }
    parseDocument(document) {
        return (0, parser_1.parseComposerDependencies)(document);
    }
    async getLatestVersion(packageName) {
        return (0, registry_1.fetchLatestComposerVersion)(packageName);
    }
    async getAvailableVersions(packageName) {
        return (0, registry_1.fetchComposerVersions)(packageName);
    }
    formatUpdatedVersion(currentVersion, latestVersion) {
        return (0, semver_1.formatUpdatedVersion)(currentVersion, latestVersion);
    }
    shouldSkipVersion(currentVersion) {
        return (0, semver_1.shouldIgnoreVersion)(currentVersion);
    }
}
exports.ComposerProvider = ComposerProvider;
//# sourceMappingURL=index.js.map