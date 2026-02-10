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
exports.parseCargoDependencies = parseCargoDependencies;
const vscode = __importStar(require("vscode"));
const smol_toml_1 = require("smol-toml");
const SECTION_KEYS = ["dependencies", "dev-dependencies", "build-dependencies"];
function parseCargoDependencies(document) {
    const text = document.getText();
    let data;
    try {
        data = (0, smol_toml_1.parse)(text);
    }
    catch {
        return [];
    }
    const rangeMap = findDependencyRanges(document);
    const results = [];
    // Process top-level dependency sections
    for (const section of SECTION_KEYS) {
        const sectionData = data[section];
        if (sectionData && typeof sectionData === "object") {
            collectDependencies(sectionData, section, rangeMap, results);
        }
    }
    // Process workspace.dependencies
    const workspace = data["workspace"];
    if (workspace && typeof workspace === "object") {
        const workspaceDeps = workspace["dependencies"];
        if (workspaceDeps && typeof workspaceDeps === "object") {
            collectDependencies(workspaceDeps, "workspace.dependencies", rangeMap, results);
        }
    }
    // Process target-specific dependencies (e.g., [target.'cfg(...)'.dependencies])
    const target = data["target"];
    if (target && typeof target === "object") {
        for (const [targetName, targetData] of Object.entries(target)) {
            if (!targetData || typeof targetData !== "object") {
                continue;
            }
            for (const section of SECTION_KEYS) {
                const sectionData = targetData[section];
                if (sectionData && typeof sectionData === "object") {
                    const sectionKey = `target.${normalizeTargetName(targetName)}.${section}`;
                    collectDependencies(sectionData, sectionKey, rangeMap, results);
                }
            }
        }
    }
    return results;
}
function collectDependencies(sectionData, section, rangeMap, results) {
    for (const [name, rawValue] of Object.entries(sectionData)) {
        const version = extractVersion(rawValue);
        if (!version) {
            continue;
        }
        const rangeKey = `${section}:${name}`;
        const range = rangeMap.get(rangeKey);
        if (!range) {
            continue;
        }
        results.push({
            name,
            currentVersion: version,
            range,
            updateAvailable: false,
            dependencyGroup: section
        });
    }
}
function extractVersion(value) {
    if (typeof value === "string") {
        return value;
    }
    if (value && typeof value === "object") {
        const version = value.version;
        if (typeof version === "string") {
            return version;
        }
    }
    return null;
}
function findDependencyRanges(document) {
    const rangeMap = new Map();
    const lines = document.getText().split(/\r?\n/);
    let currentSection = null;
    let currentPackageSection = null;
    let inMultilineTable = false;
    let multilinePackageName = null;
    let multilineSection = null;
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const line = lines[lineIndex];
        const headerMatch = line.match(/^\s*\[([^\]]+)\]\s*$/);
        if (headerMatch) {
            const rawSection = headerMatch[1];
            currentSection = normalizeSection(rawSection);
            currentPackageSection = parsePackageSection(rawSection);
            inMultilineTable = false;
            multilinePackageName = null;
            multilineSection = null;
            continue;
        }
        const lineWithoutComment = line.split("#")[0];
        if (!lineWithoutComment.trim()) {
            continue;
        }
        // Handle package-specific sections like [dependencies.serde]
        if (currentPackageSection) {
            const versionMatch = lineWithoutComment.match(/^\s*version\s*=\s*"([^"]+)"/);
            if (versionMatch) {
                const version = versionMatch[1];
                const versionIndex = line.indexOf(`"${version}"`) + 1;
                if (versionIndex > 0) {
                    const range = new vscode.Range(new vscode.Position(lineIndex, versionIndex), new vscode.Position(lineIndex, versionIndex + version.length));
                    rangeMap.set(`${currentPackageSection.section}:${currentPackageSection.name}`, range);
                }
            }
            continue;
        }
        if (!currentSection) {
            continue;
        }
        // Handle multi-line inline table - looking for version inside
        if (inMultilineTable && multilinePackageName && multilineSection) {
            const versionMatch = lineWithoutComment.match(/version\s*=\s*"([^"]+)"/);
            if (versionMatch) {
                const version = versionMatch[1];
                const versionIndex = line.indexOf(`"${version}"`) + 1;
                if (versionIndex > 0) {
                    const range = new vscode.Range(new vscode.Position(lineIndex, versionIndex), new vscode.Position(lineIndex, versionIndex + version.length));
                    rangeMap.set(`${multilineSection}:${multilinePackageName}`, range);
                }
            }
            if (lineWithoutComment.includes("}")) {
                inMultilineTable = false;
                multilinePackageName = null;
                multilineSection = null;
            }
            continue;
        }
        // Parse package name (can be quoted or unquoted)
        const nameMatch = lineWithoutComment.match(/^\s*(?:"([^"]+)"|([A-Za-z0-9_-]+))\s*=/);
        if (!nameMatch) {
            continue;
        }
        const name = nameMatch[1] ?? nameMatch[2];
        // Check for inline table start (may span multiple lines)
        const hasTableStart = lineWithoutComment.includes("{");
        const hasTableEnd = lineWithoutComment.includes("}");
        if (hasTableStart && !hasTableEnd) {
            // Multi-line inline table starts here
            inMultilineTable = true;
            multilinePackageName = name;
            multilineSection = currentSection;
            // Check if version is on this line
            const versionMatch = lineWithoutComment.match(/version\s*=\s*"([^"]+)"/);
            if (versionMatch) {
                const version = versionMatch[1];
                const versionIndex = line.indexOf(`"${version}"`) + 1;
                if (versionIndex > 0) {
                    const range = new vscode.Range(new vscode.Position(lineIndex, versionIndex), new vscode.Position(lineIndex, versionIndex + version.length));
                    rangeMap.set(`${currentSection}:${name}`, range);
                    inMultilineTable = false;
                    multilinePackageName = null;
                    multilineSection = null;
                }
            }
            continue;
        }
        if (hasTableStart && hasTableEnd) {
            // Single-line inline table
            const versionMatch = lineWithoutComment.match(/version\s*=\s*"([^"]+)"/);
            if (versionMatch) {
                const version = versionMatch[1];
                const versionIndex = line.indexOf(`"${version}"`) + 1;
                if (versionIndex > 0) {
                    const range = new vscode.Range(new vscode.Position(lineIndex, versionIndex), new vscode.Position(lineIndex, versionIndex + version.length));
                    rangeMap.set(`${currentSection}:${name}`, range);
                }
            }
            continue;
        }
        // Simple version string: name = "version"
        const simpleMatch = lineWithoutComment.match(/^\s*(?:"[^"]+"|[A-Za-z0-9_-]+)\s*=\s*"([^"]+)"\s*$/);
        if (simpleMatch) {
            const version = simpleMatch[1];
            const versionIndex = line.lastIndexOf(`"${version}"`) + 1;
            if (versionIndex > 0) {
                const range = new vscode.Range(new vscode.Position(lineIndex, versionIndex), new vscode.Position(lineIndex, versionIndex + version.length));
                rangeMap.set(`${currentSection}:${name}`, range);
            }
        }
    }
    return rangeMap;
}
function normalizeSection(sectionName) {
    // Direct match for standard sections
    if (SECTION_KEYS.includes(sectionName)) {
        return sectionName;
    }
    // workspace.dependencies
    if (sectionName === "workspace.dependencies") {
        return "workspace.dependencies";
    }
    // Target-specific dependencies: target.'cfg(...)'.dependencies or target.x86_64-unknown-linux-gnu.dependencies
    const targetMatch = sectionName.match(/^target\.(.+)\.(dependencies|dev-dependencies|build-dependencies)$/);
    if (targetMatch) {
        const [, targetName, section] = targetMatch;
        return `target.${normalizeTargetName(targetName)}.${section}`;
    }
    return null;
}
/** Parse package-specific sections like [dependencies.serde] */
function parsePackageSection(sectionName) {
    for (const section of SECTION_KEYS) {
        const prefix = `${section}.`;
        if (sectionName.startsWith(prefix)) {
            const name = sectionName.slice(prefix.length);
            if (name && !name.includes(".")) {
                return { section, name };
            }
        }
    }
    // Also handle workspace.dependencies.package
    if (sectionName.startsWith("workspace.dependencies.")) {
        const name = sectionName.slice("workspace.dependencies.".length);
        if (name && !name.includes(".")) {
            return { section: "workspace.dependencies", name };
        }
    }
    return null;
}
function normalizeTargetName(targetName) {
    const trimmed = targetName.trim();
    if ((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
        (trimmed.startsWith("\"") && trimmed.endsWith("\""))) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}
//# sourceMappingURL=parser.js.map