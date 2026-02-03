import * as vscode from "vscode";
import { LanguageProvider, PackageInfo } from "../../core/types";
import { parseGoDependencies } from "./parser";
import { fetchLatestGoVersion, fetchGoVersions } from "./registry";
import { formatUpdatedVersion, shouldIgnoreVersion, isPrerelease, extractSemver, compareSemver } from "../../utils/semver";

export class GoProvider implements LanguageProvider {
  id = "go";
  displayName = "Go";
  fileNames = ["go.mod"];

  parseDocument(document: vscode.TextDocument): PackageInfo[] {
    return parseGoDependencies(document);
  }

  async getLatestVersion(packageName: string, ignorePatterns?: string[]): Promise<string | null> {
    const latest = await fetchLatestGoVersion(packageName);
    if (!latest || !ignorePatterns?.length) {
      return latest;
    }
    if (!isPrerelease(latest, ignorePatterns)) {
      return latest;
    }
    const versions = await fetchGoVersions(packageName);
    if (!versions) {
      return null;
    }
    const stable = versions.filter((v) => !isPrerelease(v, ignorePatterns));
    return pickLatest(stable);
  }

  async getAvailableVersions(packageName: string): Promise<string[] | null> {
    return fetchGoVersions(packageName);
  }

  formatUpdatedVersion(currentVersion: string, latestVersion: string): string {
    return formatUpdatedVersion(currentVersion, latestVersion);
  }

  shouldSkipVersion(currentVersion: string): boolean {
    return shouldIgnoreVersion(currentVersion);
  }
}

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
