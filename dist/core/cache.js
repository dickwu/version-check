"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VersionCache = void 0;
class VersionCache {
    constructor(ttlMs) {
        this.ttlMs = ttlMs;
        this.entries = new Map();
    }
    setTtl(ttlMs) {
        this.ttlMs = ttlMs;
    }
    get(key) {
        const entry = this.entries.get(key);
        if (!entry) {
            return undefined;
        }
        if (Date.now() - entry.timestamp > this.ttlMs) {
            this.entries.delete(key);
            return undefined;
        }
        return entry.value;
    }
    set(key, value) {
        this.entries.set(key, { value, timestamp: Date.now() });
    }
    clear() {
        this.entries.clear();
    }
}
exports.VersionCache = VersionCache;
//# sourceMappingURL=cache.js.map