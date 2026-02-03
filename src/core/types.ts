import * as vscode from "vscode";

export interface PackageInfo {
  name: string;
  currentVersion: string;
  range: vscode.Range;
  latestVersion?: string;
  updateAvailable: boolean;
  dependencyGroup?: string;
}

export interface LanguageProvider {
  id: string;
  displayName: string;
  fileNames: string[];
  parseDocument(document: vscode.TextDocument): PackageInfo[];
  getLatestVersion(packageName: string): Promise<string | null>;
  getAvailableVersions(packageName: string): Promise<string[] | null>;
  formatUpdatedVersion(currentVersion: string, latestVersion: string): string;
  shouldSkipVersion?(currentVersion: string): boolean;
}
