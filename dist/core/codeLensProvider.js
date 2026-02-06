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
    constructor(providers, cache, extensionContext) {
        this.providers = providers;
        this.cache = cache;
        this.extensionContext = extensionContext;
        this.emitter = new vscode.EventEmitter();
        this.onDidChangeCodeLenses = this.emitter.event;
        /** Cached document states for incremental updates */
        this.documentStates = new Map();
        /** Lines that changed since last check, per document URI */
        this.changedLines = new Map();
        /** Force full refresh flag per document */
        this.forceFullRefresh = new Set();
        /** Stored decoration ranges per document for reapplication on editor switch */
        this.decorationRanges = new Map();
        this.changeListener = vscode.workspace.onDidChangeTextDocument((e) => {
            if (!this.findProvider(e.document.fileName)) {
                return;
            }
            const uri = e.document.uri.toString();
            // Track which lines changed
            if (!this.changedLines.has(uri)) {
                this.changedLines.set(uri, new Set());
            }
            const changed = this.changedLines.get(uri);
            for (const change of e.contentChanges) {
                const startLine = change.range.start.line;
                const endLine = change.range.end.line;
                // Mark all lines in the change range as dirty
                for (let line = startLine; line <= endLine; line++) {
                    changed.add(line);
                }
                // If lines were added/removed, we need to adjust line tracking
                // For simplicity, if newlines change, mark subsequent lines as needing re-check
                const oldLineCount = endLine - startLine + 1;
                const newLineCount = change.text.split("\n").length;
                if (oldLineCount !== newLineCount) {
                    // Line shift occurred - invalidate all lines after the change
                    this.invalidateLinesAfter(uri, startLine);
                }
            }
            this.refresh();
        });
        this.greenDeco = this.createDotDecoration("resources/gutter-green.svg");
        this.yellowDeco = this.createDotDecoration("resources/gutter-yellow.svg");
        this.redDeco = this.createDotDecoration("resources/gutter-red.svg");
        this.greyDeco = this.createDotDecoration("resources/gutter-grey.svg");
        this.editorListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor) {
                this.reapplyDecorations(editor);
            }
        });
    }
    createDotDecoration(relativePath) {
        const iconPath = this.extensionContext.asAbsolutePath(relativePath);
        return vscode.window.createTextEditorDecorationType({
            gutterIconPath: iconPath,
            gutterIconSize: "60%"
        });
    }
    reapplyDecorations(editor) {
        const uri = editor.document.uri.toString();
        const ranges = this.decorationRanges.get(uri);
        if (!ranges) {
            editor.setDecorations(this.greenDeco, []);
            editor.setDecorations(this.yellowDeco, []);
            editor.setDecorations(this.redDeco, []);
            editor.setDecorations(this.greyDeco, []);
            return;
        }
        editor.setDecorations(this.greenDeco, ranges.green);
        editor.setDecorations(this.yellowDeco, ranges.yellow);
        editor.setDecorations(this.redDeco, ranges.red);
        editor.setDecorations(this.greyDeco, ranges.grey);
    }
    applyDecorations(document, green, yellow, red, grey) {
        const uri = document.uri.toString();
        this.decorationRanges.set(uri, { green, yellow, red, grey });
        const editor = vscode.window.visibleTextEditors.find((e) => e.document.uri.toString() === uri);
        if (editor) {
            editor.setDecorations(this.greenDeco, green);
            editor.setDecorations(this.yellowDeco, yellow);
            editor.setDecorations(this.redDeco, red);
            editor.setDecorations(this.greyDeco, grey);
        }
    }
    /** Invalidate all cached data for lines after a certain point */
    invalidateLinesAfter(uri, afterLine) {
        const state = this.documentStates.get(uri);
        if (!state) {
            return;
        }
        // Remove cached data for all lines after the change point
        for (const line of state.resolvedByLine.keys()) {
            if (line >= afterLine) {
                state.resolvedByLine.delete(line);
            }
        }
    }
    getIgnorePatterns() {
        const config = vscode.workspace.getConfiguration("versionCheck");
        return config.get("ignorePrereleasePatterns", []);
    }
    dispose() {
        this.changeListener?.dispose();
        this.editorListener?.dispose();
        this.emitter.dispose();
        this.greenDeco.dispose();
        this.yellowDeco.dispose();
        this.redDeco.dispose();
        this.greyDeco.dispose();
        this.documentStates.clear();
        this.changedLines.clear();
        this.forceFullRefresh.clear();
        this.decorationRanges.clear();
    }
    refresh() {
        this.emitter.fire();
    }
    /** Force a full refresh, clearing all cached state */
    fullRefresh() {
        for (const uri of this.documentStates.keys()) {
            this.forceFullRefresh.add(uri);
        }
        this.decorationRanges.clear();
        this.emitter.fire();
    }
    /** Clear state for a specific document */
    clearDocumentState(uri) {
        this.documentStates.delete(uri);
        this.changedLines.delete(uri);
        this.forceFullRefresh.add(uri);
        this.decorationRanges.delete(uri);
    }
    async provideCodeLenses(document, token) {
        const provider = this.findProvider(document.fileName);
        if (!provider) {
            return [];
        }
        const uri = document.uri.toString();
        const packages = provider.parseDocument(document);
        const lenses = [];
        const sectionUpdates = new Map();
        const ignorePatterns = this.getIgnorePatterns();
        const greenRanges = [];
        const yellowRanges = [];
        const redRanges = [];
        const greyRanges = [];
        // Get or create document state
        let state = this.documentStates.get(uri);
        const isFullRefresh = this.forceFullRefresh.has(uri) || !state;
        if (isFullRefresh) {
            state = { resolvedByLine: new Map(), version: document.version };
            this.documentStates.set(uri, state);
            this.forceFullRefresh.delete(uri);
        }
        // Get changed lines for this document
        const changed = this.changedLines.get(uri) ?? new Set();
        // Clear changed lines after reading
        this.changedLines.delete(uri);
        // Build a map of current packages by name for quick lookup
        const currentPackagesByName = new Map();
        for (const pkg of packages) {
            currentPackagesByName.set(pkg.name, pkg);
        }
        for (const info of packages) {
            if (token.isCancellationRequested) {
                break;
            }
            if (provider.shouldSkipVersion?.(info.currentVersion)) {
                continue;
            }
            const line = info.range.start.line;
            const lineChanged = isFullRefresh || changed.has(line);
            // Try to reuse cached resolved data if line didn't change
            let resolved;
            if (!lineChanged) {
                // Look for cached data - check if package name and version match
                for (const [cachedLine, cachedResolved] of state.resolvedByLine) {
                    if (cachedResolved.info.name === info.name &&
                        cachedResolved.info.currentVersion === info.currentVersion) {
                        resolved = cachedResolved;
                        // Update the range to current position (may have shifted)
                        resolved.info.range = info.range;
                        break;
                    }
                }
            }
            if (!resolved) {
                // Need to resolve this package
                resolved = await this.resolvePackage(provider, info, ignorePatterns);
            }
            // Update state with current line position
            state.resolvedByLine.set(line, resolved);
            if (resolved.notFound) {
                info.updateAvailable = false;
                const decoLine = new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER);
                greyRanges.push(decoLine);
                lenses.push(new vscode.CodeLens(info.range, {
                    title: `⚠ Version not found for ${info.name}`,
                    command: "versionCheck.updateDependency",
                    arguments: [document.uri, provider.id, info, undefined]
                }));
                continue;
            }
            if (!resolved.latestVersion) {
                const decoLine = new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER);
                greyRanges.push(decoLine);
                continue;
            }
            const updateAvailable = (0, semver_1.isVersionOutdated)(info.currentVersion, resolved.latestVersion);
            const decoRange = new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER);
            if (!updateAvailable) {
                greenRanges.push(decoRange);
                lenses.push(new vscode.CodeLens(info.range, {
                    title: `✓ Latest (${resolved.latestVersion})`,
                    command: "versionCheck.updateDependency",
                    arguments: [document.uri, provider.id, info, resolved.latestVersion]
                }));
                continue;
            }
            info.latestVersion = resolved.latestVersion;
            info.updateAvailable = true;
            const diffLevel = (0, semver_1.getVersionDiffLevel)(info.currentVersion, resolved.latestVersion);
            if (diffLevel === "major") {
                redRanges.push(decoRange);
            }
            else {
                yellowRanges.push(decoRange);
            }
            const section = info.dependencyGroup ?? "default";
            if (!sectionUpdates.has(section)) {
                sectionUpdates.set(section, { packages: [], firstLine: info.range.start.line });
            }
            const sectionData = sectionUpdates.get(section);
            sectionData.packages.push({ info, latestVersion: resolved.latestVersion, notFound: false });
            if (info.range.start.line < sectionData.firstLine) {
                sectionData.firstLine = info.range.start.line;
            }
            lenses.push(new vscode.CodeLens(info.range, {
                title: `Choose version (latest ${resolved.latestVersion})`,
                command: "versionCheck.updateDependency",
                arguments: [document.uri, provider.id, info, resolved.latestVersion]
            }));
        }
        // Clean up stale entries from state (packages that no longer exist)
        const currentLines = new Set(packages.map(p => p.range.start.line));
        for (const line of state.resolvedByLine.keys()) {
            if (!currentLines.has(line)) {
                state.resolvedByLine.delete(line);
            }
        }
        state.version = document.version;
        for (const [section, data] of sectionUpdates) {
            if (data.packages.length < 2) {
                continue;
            }
            const updateAllRange = new vscode.Range(new vscode.Position(data.firstLine, 0), new vscode.Position(data.firstLine, 0));
            const updates = data.packages.map((pkg) => ({
                info: pkg.info,
                latestVersion: pkg.latestVersion
            }));
            lenses.push(new vscode.CodeLens(updateAllRange, {
                title: `⬆ Update all ${data.packages.length} in ${section}`,
                command: "versionCheck.updateAllInSection",
                arguments: [document.uri, provider.id, updates]
            }));
        }
        this.applyDecorations(document, greenRanges, yellowRanges, redRanges, greyRanges);
        return lenses;
    }
    /** Resolve a single package's latest version */
    async resolvePackage(provider, info, ignorePatterns) {
        const cacheKey = `${provider.id}:${info.name}`;
        let latestVersion = this.cache.get(cacheKey);
        let notFound = false;
        if (!latestVersion) {
            try {
                latestVersion = await provider.getLatestVersion(info.name, ignorePatterns) ?? undefined;
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
        return { info, latestVersion, notFound };
    }
    findProvider(fileName) {
        return this.providers.find((provider) => provider.fileNames.some((name) => fileName.endsWith(name)));
    }
}
exports.VersionCodeLensProvider = VersionCodeLensProvider;
//# sourceMappingURL=codeLensProvider.js.map