"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchLatestGoVersion = fetchLatestGoVersion;
exports.fetchGoVersions = fetchGoVersions;
const http_1 = require("../../utils/http");
async function fetchLatestGoVersion(modulePath) {
    const encoded = encodeURIComponent(modulePath);
    const url = `https://proxy.golang.org/${encoded}/@latest`;
    const response = await (0, http_1.getJson)(url);
    return response.Version ?? null;
}
async function fetchGoVersions(modulePath) {
    const encoded = encodeURIComponent(modulePath);
    const url = `https://proxy.golang.org/${encoded}/@v/list`;
    const response = await (0, http_1.getText)(url);
    const versions = response
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    return versions.length ? versions : null;
}
//# sourceMappingURL=registry.js.map