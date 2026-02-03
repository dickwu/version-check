import * as vscode from "vscode";
import { LanguageProvider, PackageInfo } from "../../core/types";
import { parseGoDependencies } from "./parser";
import { fetchLatestGoVersion, fetchGoVersions } from "./registry";
import { formatUpdatedVersion, shouldIgnoreVersion } from "../../utils/semver";

export class GoProvider implements LanguageProvider {
  id = "go";
  displayName = "Go";
  fileNames = ["go.mod"];

  parseDocument(document: vscode.TextDocument): PackageInfo[] {
    return parseGoDependencies(document);
  }

  async getLatestVersion(packageName: string): Promise<string | null> {
    return fetchLatestGoVersion(packageName);
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
