import * as vscode from "vscode";
import { LanguageProvider, PackageInfo } from "../../core/types";
import { parseNpmDependencies } from "./parser";
import { fetchLatestNpmVersion, fetchNpmVersions } from "./registry";
import { formatUpdatedVersion, shouldIgnoreVersion } from "../../utils/semver";

export class NpmProvider implements LanguageProvider {
  id = "npm";
  displayName = "npm";
  fileNames = ["package.json"];

  parseDocument(document: vscode.TextDocument): PackageInfo[] {
    return parseNpmDependencies(document);
  }

  async getLatestVersion(packageName: string): Promise<string | null> {
    return fetchLatestNpmVersion(packageName);
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
