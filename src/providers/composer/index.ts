import * as vscode from "vscode";
import { LanguageProvider, PackageInfo } from "../../core/types";
import { parseComposerDependencies } from "./parser";
import { fetchLatestComposerVersion, fetchComposerVersions } from "./registry";
import { formatUpdatedVersion, shouldIgnoreVersion } from "../../utils/semver";

export class ComposerProvider implements LanguageProvider {
  id = "composer";
  displayName = "Composer";
  fileNames = ["composer.json"];

  parseDocument(document: vscode.TextDocument): PackageInfo[] {
    return parseComposerDependencies(document);
  }

  async getLatestVersion(packageName: string): Promise<string | null> {
    return fetchLatestComposerVersion(packageName);
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
