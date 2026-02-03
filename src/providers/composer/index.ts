import * as vscode from "vscode";
import { LanguageProvider, PackageInfo } from "../../core/types";
import { parseComposerDependencies } from "./parser";
import { fetchComposerVersions } from "./registry";
import { formatUpdatedVersion, shouldIgnoreVersion, isPrerelease, extractSemver, compareSemver } from "../../utils/semver";

export class ComposerProvider implements LanguageProvider {
  id = "composer";
  displayName = "Composer";
  fileNames = ["composer.json"];

  parseDocument(document: vscode.TextDocument): PackageInfo[] {
    return parseComposerDependencies(document);
  }

  async getLatestVersion(packageName: string, ignorePatterns?: string[]): Promise<string | null> {
    const versions = await fetchComposerVersions(packageName);
    if (!versions) {
      return null;
    }
    const filtered = ignorePatterns?.length
      ? versions.filter((v) => !isPrerelease(v, ignorePatterns))
      : versions;
    return pickLatest(filtered);
  }

  async getAvailableVersions(packageName: string): Promise<string[] | null> {
    return fetchComposerVersions(packageName);
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
