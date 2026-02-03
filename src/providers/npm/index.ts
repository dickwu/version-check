import * as vscode from "vscode";
import { LanguageProvider, PackageInfo } from "../../core/types";
import { parseNpmDependencies } from "./parser";
import { fetchLatestNpmVersion, fetchNpmVersions } from "./registry";
import { formatUpdatedVersion, shouldIgnoreVersion, isPrerelease } from "../../utils/semver";

export class NpmProvider implements LanguageProvider {
  id = "npm";
  displayName = "npm";
  fileNames = ["package.json"];

  parseDocument(document: vscode.TextDocument): PackageInfo[] {
    return parseNpmDependencies(document);
  }

  async getLatestVersion(packageName: string, ignorePatterns?: string[]): Promise<string | null> {
    const latest = await fetchLatestNpmVersion(packageName);
    if (!latest || !ignorePatterns?.length) {
      return latest;
    }
    if (!isPrerelease(latest, ignorePatterns)) {
      return latest;
    }
    const versions = await fetchNpmVersions(packageName);
    if (!versions) {
      return null;
    }
    const stable = versions.filter((v) => !isPrerelease(v, ignorePatterns));
    return pickLatest(stable);
  }

  async getAvailableVersions(packageName: string): Promise<string[] | null> {
    return fetchNpmVersions(packageName);
  }

  formatUpdatedVersion(currentVersion: string, latestVersion: string): string {
    return formatUpdatedVersion(currentVersion, latestVersion);
  }

  shouldSkipVersion(currentVersion: string): boolean {
    return shouldIgnoreVersion(currentVersion);
  }
}

import { extractSemver, compareSemver } from "../../utils/semver";

function pickLatest(versions: string[]): string | null {
  let best: string | null = null;
  let bestSemver: ReturnType<typeof extractSemver> | null = null;
  for (const v of versions) {
    const semver = extractSemver(v);
    if (!semver) continue;
    if (!bestSemver || compareSemver(bestSemver, semver) < 0) {
      bestSemver = semver;
      best = v;
    }
  }
  return best;
}
