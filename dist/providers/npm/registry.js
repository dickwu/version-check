"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchLatestNpmVersion = fetchLatestNpmVersion;
exports.fetchNpmVersions = fetchNpmVersions;
const http_1 = require("../../utils/http");
async function fetchLatestNpmVersion(packageName) {
    const encoded = encodeURIComponent(packageName);
    const url = `https://registry.npmjs.org/${encoded}/latest`;
    const response = await (0, http_1.getJson)(url);
    return response.version ?? null;
}
async function fetchNpmVersions(packageName) {
    const encoded = encodeURIComponent(packageName);
    const url = `https://registry.npmjs.org/${encoded}`;
    const response = await (0, http_1.getJson)(url);
    const versions = response.versions ? Object.keys(response.versions) : [];
    return versions.length ? versions : null;
}
//# sourceMappingURL=registry.js.map