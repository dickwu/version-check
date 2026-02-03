import * as vscode from "vscode";
import { LanguageProvider, PackageInfo } from "../../core/types";
import { parseCargoDependencies } from "./parser";
import { fetchLatestCargoVersion, fetchCargoVersions } from "./registry";
import { formatUpdatedVersion, shouldIgnoreVersion } from "../../utils/semver";

export class CargoProvider implements LanguageProvider {
  id = "cargo";
  displayName = "Cargo";
  fileNames = ["Cargo.toml"];

  parseDocument(document: vscode.TextDocument): PackageInfo[] {
    return parseCargoDependencies(document);
  }

  async getLatestVersion(packageName: string): Promise<string | null> {
    return fetchLatestCargoVersion(packageName);
  }

  async getAvailableVersions(packageName: string): Promise<string[] | null> {
    return fetchCargoVersions(packageName);
  }

  formatUpdatedVersion(currentVersion: string, latestVersion: string): string {
    return formatUpdatedVersion(currentVersion, latestVersion);
  }

  shouldSkipVersion(currentVersion: string): boolean {
    return shouldIgnoreVersion(currentVersion);
  }
}
