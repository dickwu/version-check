"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchLatestCargoVersion = fetchLatestCargoVersion;
exports.fetchCargoVersions = fetchCargoVersions;
const http_1 = require("../../utils/http");
let lastRequestAt = 0;
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function rateLimit() {
    const now = Date.now();
    const elapsed = now - lastRequestAt;
    if (elapsed < 1000) {
        await delay(1000 - elapsed);
    }
    lastRequestAt = Date.now();
}
async function request(url) {
    await rateLimit();
    return (0, http_1.getJson)(url, {
        "User-Agent": "version-check-vscode"
    });
}
async function fetchLatestCargoVersion(crateName) {
    const url = `https://crates.io/api/v1/crates/${encodeURIComponent(crateName)}`;
    const response = await request(url);
    return response.crate?.max_version ?? null;
}
async function fetchCargoVersions(crateName) {
    const url = `https://crates.io/api/v1/crates/${encodeURIComponent(crateName)}/versions`;
    const response = await request(url);
    const versions = (response.versions ?? [])
        .map((item) => item.num)
        .filter((value) => Boolean(value));
    return versions.length ? versions : null;
}
//# sourceMappingURL=registry.js.map