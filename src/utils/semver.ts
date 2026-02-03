export type Semver = {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
};

const SEMVER_REGEX = /(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/;

export function parseSemver(input: string): Semver | null {
  const match = SEMVER_REGEX.exec(input);
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4]
  };
}

export function extractSemver(input: string): Semver | null {
  const trimmed = input.trim().replace(/^v/, "");
  return parseSemver(trimmed);
}

export function compareSemver(a: Semver, b: Semver): number {
  if (a.major !== b.major) {
    return a.major < b.major ? -1 : 1;
  }
  if (a.minor !== b.minor) {
    return a.minor < b.minor ? -1 : 1;
  }
  if (a.patch !== b.patch) {
    return a.patch < b.patch ? -1 : 1;
  }
  if (!a.prerelease && b.prerelease) {
    return 1;
  }
  if (a.prerelease && !b.prerelease) {
    return -1;
  }
  if (a.prerelease && b.prerelease && a.prerelease !== b.prerelease) {
    return a.prerelease < b.prerelease ? -1 : 1;
  }
  return 0;
}

export function shouldIgnoreVersion(currentVersion: string): boolean {
  const trimmed = currentVersion.trim();
  if (!trimmed) {
    return true;
  }
  if (trimmed === "*" || trimmed.toLowerCase() === "latest") {
    return true;
  }
  if (/^(workspace:|file:|link:|path:|git:|github:|http:|https:)/i.test(trimmed)) {
    return true;
  }
  if (/^dev-/i.test(trimmed)) {
    return true;
  }
  return false;
}

export function isVersionOutdated(currentVersion: string, latestVersion: string): boolean {
  if (shouldIgnoreVersion(currentVersion)) {
    return false;
  }
  const current = extractSemver(currentVersion);
  const latest = extractSemver(latestVersion);
  if (!current || !latest) {
    return false;
  }
  return compareSemver(current, latest) < 0;
}

export function formatUpdatedVersion(currentVersion: string, latestVersion: string): string {
  const trimmed = currentVersion.trim();
  const latestTrimmed = latestVersion.trim();
  const latestSemver = extractSemver(latestTrimmed);
  const prefixMatch = latestSemver ? trimmed.match(/^(\\^|~|>=|<=|>|<|=)/) : null;
  const prefix = prefixMatch ? prefixMatch[1] : "";
  const latest = trimmed.startsWith("v") && !latestTrimmed.startsWith("v")
    ? `v${latestTrimmed}`
    : latestTrimmed;
  return `${prefix}${latest}`;
}
