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
exports.parseGoDependencies = parseGoDependencies;
const vscode = __importStar(require("vscode"));
function parseGoDependencies(document) {
    const lines = document.getText().split(/\r?\n/);
    const results = [];
    let inRequireBlock = false;
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const line = lines[lineIndex];
        const trimmed = line.trim();
        if (trimmed.startsWith("require") && trimmed.endsWith("(")) {
            inRequireBlock = true;
            continue;
        }
        if (inRequireBlock && trimmed.startsWith(")")) {
            inRequireBlock = false;
            continue;
        }
        const lineWithoutComment = line.split("//")[0];
        if (!lineWithoutComment.trim()) {
            continue;
        }
        if (trimmed.startsWith("require ") && !inRequireBlock) {
            const info = parseRequireLine(lineWithoutComment, lineIndex);
            if (info) {
                results.push(info);
            }
            continue;
        }
        if (inRequireBlock) {
            const info = parseRequireLine(lineWithoutComment, lineIndex);
            if (info) {
                results.push(info);
            }
        }
    }
    return results;
}
function parseRequireLine(line, lineIndex) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("require ")) {
        return parseSingleRequire(trimmed, line, lineIndex);
    }
    const tokens = trimmed.split(/\s+/);
    if (tokens.length < 2) {
        return null;
    }
    return buildPackageInfo(tokens[0], tokens[1], line, lineIndex);
}
function parseSingleRequire(trimmed, originalLine, lineIndex) {
    const tokens = trimmed.replace(/^require\s+/, "").split(/\s+/);
    if (tokens.length < 2) {
        return null;
    }
    return buildPackageInfo(tokens[0], tokens[1], originalLine, lineIndex);
}
function buildPackageInfo(moduleName, version, line, lineIndex) {
    const versionIndex = line.indexOf(version);
    if (versionIndex < 0) {
        return null;
    }
    return {
        name: moduleName,
        currentVersion: version,
        range: new vscode.Range(new vscode.Position(lineIndex, versionIndex), new vscode.Position(lineIndex, versionIndex + version.length)),
        updateAvailable: false,
        dependencyGroup: "require"
    };
}
//# sourceMappingURL=parser.js.map