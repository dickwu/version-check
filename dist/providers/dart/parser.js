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
exports.parseDartDependencies = parseDartDependencies;
const vscode = __importStar(require("vscode"));
const DEP_SECTIONS = [
    "dependencies",
    "dev_dependencies",
    "dependency_overrides"
];
function parseDartDependencies(document) {
    const lines = document.getText().split(/\r?\n/);
    const results = [];
    let currentSection = null;
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const line = lines[lineIndex];
        const trimmed = line.trimEnd();
        // Detect top-level section headers (no leading whitespace, ends with colon)
        const sectionMatch = trimmed.match(/^([a-z_]+)\s*:\s*$/);
        if (sectionMatch) {
            const sectionName = sectionMatch[1];
            if (DEP_SECTIONS.includes(sectionName)) {
                currentSection = sectionName;
            }
            else {
                currentSection = null;
            }
            continue;
        }
        // A non-indented non-empty line that isn't a dependency section resets context
        if (trimmed && !trimmed.startsWith(" ") && !trimmed.startsWith("\t") && !trimmed.startsWith("#")) {
            currentSection = null;
            continue;
        }
        if (!currentSection) {
            continue;
        }
        // Skip comments
        if (trimmed.trimStart().startsWith("#")) {
            continue;
        }
        // Match simple version constraint: `  package_name: ^1.2.3` or `  package_name: ">=1.0.0 <2.0.0"`
        const depMatch = line.match(/^(\s{2,})([a-zA-Z_][a-zA-Z0-9_]*):\s+(.+)$/);
        if (!depMatch) {
            continue;
        }
        const name = depMatch[2];
        let versionRaw = depMatch[3].trim();
        // Skip non-version values (maps like git:, path:, sdk:, hosted:)
        if (versionRaw.startsWith("{") || versionRaw === "" || versionRaw === "null") {
            continue;
        }
        // Remove surrounding quotes if present
        const unquoted = versionRaw.replace(/^['"]|['"]$/g, "");
        // Skip hosted/git/path/sdk dependency maps that start on next line
        if (unquoted === "" || unquoted === "null") {
            continue;
        }
        // Find the version string position in the line
        const versionStart = findVersionStart(line, versionRaw);
        if (versionStart < 0) {
            continue;
        }
        const versionEnd = versionStart + versionRaw.length;
        // If quoted, adjust range to include content inside quotes only
        let rangeStart = versionStart;
        let rangeEnd = versionEnd;
        if ((versionRaw.startsWith("'") && versionRaw.endsWith("'")) ||
            (versionRaw.startsWith('"') && versionRaw.endsWith('"'))) {
            rangeStart = versionStart + 1;
            rangeEnd = versionEnd - 1;
            versionRaw = unquoted;
        }
        results.push({
            name,
            currentVersion: versionRaw,
            range: new vscode.Range(new vscode.Position(lineIndex, rangeStart), new vscode.Position(lineIndex, rangeEnd)),
            updateAvailable: false,
            dependencyGroup: currentSection
        });
    }
    return results;
}
function findVersionStart(line, version) {
    // Find the version after the colon
    const colonIndex = line.indexOf(":");
    if (colonIndex < 0) {
        return -1;
    }
    const afterColon = line.indexOf(version, colonIndex + 1);
    return afterColon;
}
//# sourceMappingURL=parser.js.map