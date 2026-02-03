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
exports.parseComposerDependencies = parseComposerDependencies;
const vscode = __importStar(require("vscode"));
const jsonc_parser_1 = require("jsonc-parser");
const DEP_SECTIONS = ["require", "require-dev"];
function parseComposerDependencies(document) {
    const text = document.getText();
    const root = (0, jsonc_parser_1.parseTree)(text);
    if (!root) {
        return [];
    }
    const results = [];
    for (const section of DEP_SECTIONS) {
        const sectionNode = (0, jsonc_parser_1.findNodeAtLocation)(root, [section]);
        if (!sectionNode || sectionNode.type !== "object" || !sectionNode.children) {
            continue;
        }
        for (const propertyNode of sectionNode.children) {
            const [keyNode, valueNode] = propertyNode.children ?? [];
            if (!keyNode || !valueNode) {
                continue;
            }
            if (keyNode.type !== "string" || valueNode.type !== "string") {
                continue;
            }
            const name = String(keyNode.value ?? "");
            const currentVersion = String(valueNode.value ?? "");
            const range = valueNodeRange(document, valueNode);
            if (!name || !currentVersion || !range) {
                continue;
            }
            results.push({
                name,
                currentVersion,
                range,
                updateAvailable: false,
                dependencyGroup: section
            });
        }
    }
    return results;
}
function valueNodeRange(document, valueNode) {
    if (valueNode.type !== "string" || valueNode.length < 2) {
        return null;
    }
    const start = valueNode.offset + 1;
    const end = valueNode.offset + valueNode.length - 1;
    return new vscode.Range(document.positionAt(start), document.positionAt(end));
}
//# sourceMappingURL=parser.js.map