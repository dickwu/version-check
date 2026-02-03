"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.VersionCodeLensProvider = void 0;
const vscode = __importStar(require("vscode"));
const semver_1 = require("../utils/semver");
const CACHE_NOT_FOUND = "__NOT_FOUND__";
class VersionCodeLensProvider {
    constructor(providers, cache) {
        this.providers = providers;
        this.cache = cache;
        this.emitter = new vscode.EventEmitter();
        this.onDidChangeCodeLenses = this.emitter.event;
        this.changeListener = vscode.workspace.onDidChangeTextDocument((e) => {
            if (this.findProvider(e.document.fileName)) {
                this.refresh();
            }
        });
    }
    dispose() {
        this.changeListener?.dispose();
        this.emitter.dispose();
    }
    refresh() {
        this.emitter.fire();
    }
    async provideCodeLenses(document, token) {
        const provider = this.findProvider(document.fileName);
        if (!provider) {
            return [];
        }
        const packages = provider.parseDocument(document);
        const lenses = [];
        for (const info of packages) {
            if (token.isCancellationRequested) {
                break;
            }
            if (provider.shouldSkipVersion?.(info.currentVersion)) {
                continue;
            }
            const cacheKey = `${provider.id}:${info.name}`;
            let latestVersion = this.cache.get(cacheKey);
            let notFound = false;
            if (!latestVersion) {
                try {
                    latestVersion = await provider.getLatestVersion(info.name) ?? undefined;
                }
                catch {
                    latestVersion = undefined;
                }
                if (latestVersion) {
                    this.cache.set(cacheKey, latestVersion);
                }
                else {
                    this.cache.set(cacheKey, CACHE_NOT_FOUND);
                    notFound = true;
                }
            }
            else if (latestVersion === CACHE_NOT_FOUND) {
                notFound = true;
                latestVersion = undefined;
            }
            if (notFound) {
                info.updateAvailable = false;
                lenses.push(new vscode.CodeLens(info.range, {
                    title: `⚠ Version not found for ${info.name}`,
                    command: "versionCheck.updateDependency",
                    arguments: [document.uri, provider.id, info, undefined]
                }));
                continue;
            }
            if (!latestVersion) {
                continue;
            }
            const updateAvailable = (0, semver_1.isVersionOutdated)(info.currentVersion, latestVersion);
            if (!updateAvailable) {
                continue;
            }
            info.latestVersion = latestVersion;
            info.updateAvailable = true;
            lenses.push(new vscode.CodeLens(info.range, {
                title: `Choose version (latest ${latestVersion})`,
                command: "versionCheck.updateDependency",
                arguments: [document.uri, provider.id, info, latestVersion]
            }));
        }
        return lenses;
    }
    findProvider(fileName) {
        return this.providers.find((provider) => provider.fileNames.some((name) => fileName.endsWith(name)));
    }
}
exports.VersionCodeLensProvider = VersionCodeLensProvider;
//# sourceMappingURL=codeLensProvider.js.map