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
    async getLatestVersion(packageName) {
        return (0, registry_1.fetchLatestGoVersion)(packageName);
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
//# sourceMappingURL=index.js.map