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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const cache_1 = require("./core/cache");
const codeLensProvider_1 = require("./core/codeLensProvider");
const codeActionProvider_1 = require("./core/codeActionProvider");
const npm_1 = require("./providers/npm");
const cargo_1 = require("./providers/cargo");
const go_1 = require("./providers/go");
const composer_1 = require("./providers/composer");
const semver_1 = require("./utils/semver");
const PROVIDER_SELECTORS = {
    npm: [{ pattern: "**/package.json" }],
    cargo: [{ pattern: "**/Cargo.toml" }],
    go: [{ pattern: "**/go.mod" }],
    composer: [{ pattern: "**/composer.json" }]
};
function activate(context) {
    const config = vscode.workspace.getConfiguration("versionCheck");
    const providersConfig = config.get("providers", {});
    const ttlSeconds = config.get("cacheTtlSeconds", 300);
    const allProviders = [
        new npm_1.NpmProvider(),
        new cargo_1.CargoProvider(),
        new go_1.GoProvider(),
        new composer_1.ComposerProvider()
    ];
    const enabledProviders = allProviders.filter((provider) => {
        const enabled = providersConfig[provider.id];
        return enabled !== false;
    });
    const cache = new cache_1.VersionCache(ttlSeconds * 1000);
    const codeLensProvider = new codeLensProvider_1.VersionCodeLensProvider(enabledProviders, cache);
    const codeActionProvider = new codeActionProvider_1.VersionCodeActionProvider(enabledProviders);
    context.subscriptions.push({ dispose: () => codeLensProvider.dispose() });
    for (const provider of enabledProviders) {
        const selector = PROVIDER_SELECTORS[provider.id];
        if (!selector) {
            continue;
        }
        context.subscriptions.push(vscode.languages.registerCodeLensProvider(selector, codeLensProvider));
        context.subscriptions.push(vscode.languages.registerCodeActionsProvider(selector, codeActionProvider, {
            providedCodeActionKinds: codeActionProvider_1.VersionCodeActionProvider.providedCodeActionKinds
        }));
    }
    context.subscriptions.push(vscode.commands.registerCommand("versionCheck.updateDependency", async (uri, providerId, info, latest) => {
        const provider = enabledProviders.find((item) => item.id === providerId);
        if (!provider) {
            return;
        }
        if (provider.shouldSkipVersion?.(info.currentVersion)) {
            return;
        }
        const documentUri = uri instanceof vscode.Uri ? uri : vscode.Uri.parse(String(uri));
        const chosenVersion = await pickVersion(provider, info, latest);
        if (!chosenVersion) {
            return;
        }
        const newVersion = provider.formatUpdatedVersion(info.currentVersion, chosenVersion);
        const edit = new vscode.WorkspaceEdit();
        edit.replace(documentUri, coerceRange(info.range), newVersion);
        await vscode.workspace.applyEdit(edit);
        codeLensProvider.refresh();
    }));
    context.subscriptions.push(vscode.commands.registerCommand("versionCheck.updateAllInSection", async (uri, providerId, updates) => {
        const provider = enabledProviders.find((item) => item.id === providerId);
        if (!provider || !updates.length) {
            return;
        }
        const documentUri = uri instanceof vscode.Uri ? uri : vscode.Uri.parse(String(uri));
        const edit = new vscode.WorkspaceEdit();
        const sortedUpdates = [...updates].sort((a, b) => b.info.range.start.line - a.info.range.start.line);
        for (const { info, latestVersion } of sortedUpdates) {
            if (!latestVersion) {
                continue;
            }
            const newVersion = provider.formatUpdatedVersion(info.currentVersion, latestVersion);
            edit.replace(documentUri, coerceRange(info.range), newVersion);
        }
        await vscode.workspace.applyEdit(edit);
        codeLensProvider.refresh();
    }));
    context.subscriptions.push(vscode.commands.registerCommand("versionCheck.refresh", () => {
        cache.clear();
        codeLensProvider.fullRefresh();
    }));
}
function deactivate() { }
function coerceRange(range) {
    if (range instanceof vscode.Range) {
        return range;
    }
    return new vscode.Range(new vscode.Position(range.start.line, range.start.character), new vscode.Position(range.end.line, range.end.character));
}
function getIgnorePatterns() {
    const config = vscode.workspace.getConfiguration("versionCheck");
    return config.get("ignorePrereleasePatterns", []);
}
async function pickVersion(provider, info, latestHint) {
    const ignorePatterns = getIgnorePatterns();
    const quickPick = vscode.window.createQuickPick();
    quickPick.placeholder = `Select version for ${info.name}`;
    quickPick.matchOnDescription = true;
    let latest = latestHint;
    let available = undefined;
    let closed = false;
    const updateItems = () => {
        quickPick.items = buildVersionPickItems(info, latest, available);
    };
    updateItems();
    quickPick.busy = true;
    const latestPromise = latest
        ? Promise.resolve(latest)
        : provider.getLatestVersion(info.name, ignorePatterns).catch(() => null);
    const availablePromise = provider.getAvailableVersions(info.name).catch(() => null);
    latestPromise.then((value) => {
        if (closed || !value || value === latest) {
            return;
        }
        latest = value;
        updateItems();
    });
    availablePromise.then((versions) => {
        if (closed) {
            return;
        }
        available = versions;
        updateItems();
    });
    Promise.allSettled([latestPromise, availablePromise]).then(() => {
        if (!closed) {
            quickPick.busy = false;
        }
    });
    return new Promise((resolve) => {
        quickPick.onDidAccept(async () => {
            const selection = quickPick.selectedItems[0];
            if (!selection) {
                return;
            }
            closed = true;
            quickPick.hide();
            quickPick.dispose();
            if (selection.action === "custom") {
                const value = await promptVersionInput(info, latest);
                resolve(value);
                return;
            }
            if (selection.version) {
                resolve(selection.version);
                return;
            }
            resolve(null);
        });
        quickPick.onDidHide(() => {
            if (closed) {
                return;
            }
            closed = true;
            quickPick.dispose();
            resolve(null);
        });
        quickPick.show();
    });
}
async function promptVersionInput(info, latest) {
    const value = await vscode.window.showInputBox({
        prompt: `Enter version for ${info.name}`,
        value: latest
    });
    return value?.trim() || null;
}
function sortVersionsDesc(versions) {
    const unique = Array.from(new Set(versions.map((version) => version.trim()).filter(Boolean)));
    return unique.sort((a, b) => {
        const aSemver = (0, semver_1.extractSemver)(a);
        const bSemver = (0, semver_1.extractSemver)(b);
        if (aSemver && bSemver) {
            return (0, semver_1.compareSemver)(bSemver, aSemver);
        }
        if (aSemver) {
            return -1;
        }
        if (bSemver) {
            return 1;
        }
        return b.localeCompare(a);
    });
}
function buildVersionPickItems(info, latest, available) {
    const versions = available?.length ? available : [];
    const merged = latest ? [...versions, latest] : [...versions];
    const sorted = sortVersionsDesc(merged);
    const items = [
        {
            label: "Custom...",
            description: "Enter version manually",
            action: "custom"
        }
    ];
    for (const version of sorted) {
        items.push({
            label: version,
            description: describeVersion(version, info.currentVersion, latest),
            version
        });
    }
    return items;
}
function describeVersion(version, currentVersion, latest) {
    if (latest && isSameVersion(version, latest)) {
        return "latest";
    }
    if (isSameVersion(version, currentVersion)) {
        return "current";
    }
    return undefined;
}
function isSameVersion(left, right) {
    if (!left || !right) {
        return false;
    }
    const leftSemver = (0, semver_1.extractSemver)(left);
    const rightSemver = (0, semver_1.extractSemver)(right);
    if (leftSemver && rightSemver) {
        return (0, semver_1.compareSemver)(leftSemver, rightSemver) === 0;
    }
    return left.trim() === right.trim();
}
//# sourceMappingURL=extension.js.map