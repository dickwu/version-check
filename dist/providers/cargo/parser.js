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
    for (const section of SECTION_KEYS) {
        const sectionData = data[section];
        if (!sectionData || typeof sectionData !== "object") {
            continue;
        }
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
    return results;
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
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const line = lines[lineIndex];
        const headerMatch = line.match(/^\s*\[([^\]]+)\]\s*$/);
        if (headerMatch) {
            currentSection = normalizeSection(headerMatch[1]);
            continue;
        }
        if (!currentSection) {
            continue;
        }
        const lineWithoutComment = line.split("#")[0];
        if (!lineWithoutComment.trim()) {
            continue;
        }
        const inlineTableMatch = lineWithoutComment.match(/^\s*([A-Za-z0-9_-]+)\s*=\s*\{[^}]*\}/);
        if (inlineTableMatch) {
            const nameMatch = lineWithoutComment.match(/^\s*([A-Za-z0-9_-]+)\s*=/);
            const versionMatch = lineWithoutComment.match(/version\s*=\s*"([^"]+)"/);
            if (nameMatch && versionMatch) {
                const name = nameMatch[1];
                const version = versionMatch[1];
                const versionIndex = line.indexOf(`"${version}"`) + 1;
                if (versionIndex > 0) {
                    const range = new vscode.Range(new vscode.Position(lineIndex, versionIndex), new vscode.Position(lineIndex, versionIndex + version.length));
                    rangeMap.set(`${currentSection}:${name}`, range);
                }
            }
            continue;
        }
        const simpleMatch = lineWithoutComment.match(/^\s*([A-Za-z0-9_-]+)\s*=\s*"([^"]+)"/);
        if (simpleMatch) {
            const name = simpleMatch[1];
            const version = simpleMatch[2];
            const versionIndex = line.indexOf(`"${version}"`) + 1;
            if (versionIndex > 0) {
                const range = new vscode.Range(new vscode.Position(lineIndex, versionIndex), new vscode.Position(lineIndex, versionIndex + version.length));
                rangeMap.set(`${currentSection}:${name}`, range);
            }
        }
    }
    return rangeMap;
}
function normalizeSection(sectionName) {
    if (SECTION_KEYS.includes(sectionName)) {
        return sectionName;
    }
    if (sectionName.endsWith(".dependencies")) {
        return "dependencies";
    }
    if (sectionName.endsWith(".dev-dependencies")) {
        return "dev-dependencies";
    }
    if (sectionName.endsWith(".build-dependencies")) {
        return "build-dependencies";
    }
    return null;
}
//# sourceMappingURL=parser.js.map