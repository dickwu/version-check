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
exports.getJson = getJson;
exports.getText = getText;
const http = __importStar(require("http"));
const https = __importStar(require("https"));
async function getJson(url, headers = {}, timeoutMs = 10000) {
    const mergedHeaders = {
        "User-Agent": "version-check-vscode",
        Accept: "application/json",
        ...headers
    };
    return new Promise((resolve, reject) => {
        const client = url.startsWith("https:") ? https : http;
        const req = client.request(url, { method: "GET", headers: mergedHeaders }, (res) => {
            const status = res.statusCode ?? 0;
            let data = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => {
                data += chunk;
            });
            res.on("end", () => {
                if (status < 200 || status >= 300) {
                    reject(new Error(`HTTP ${status} for ${url}`));
                    return;
                }
                try {
                    resolve(JSON.parse(data));
                }
                catch (error) {
                    reject(error);
                }
            });
        });
        req.setTimeout(timeoutMs, () => {
            req.destroy(new Error(`Request timeout after ${timeoutMs}ms`));
        });
        req.on("error", reject);
        req.end();
    });
}
async function getText(url, headers = {}, timeoutMs = 10000) {
    const mergedHeaders = {
        "User-Agent": "version-check-vscode",
        Accept: "*/*",
        ...headers
    };
    return new Promise((resolve, reject) => {
        const client = url.startsWith("https:") ? https : http;
        const req = client.request(url, { method: "GET", headers: mergedHeaders }, (res) => {
            const status = res.statusCode ?? 0;
            let data = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => {
                data += chunk;
            });
            res.on("end", () => {
                if (status < 200 || status >= 300) {
                    reject(new Error(`HTTP ${status} for ${url}`));
                    return;
                }
                resolve(data);
            });
        });
        req.setTimeout(timeoutMs, () => {
            req.destroy(new Error(`Request timeout after ${timeoutMs}ms`));
        });
        req.on("error", reject);
        req.end();
    });
}
//# sourceMappingURL=http.js.map