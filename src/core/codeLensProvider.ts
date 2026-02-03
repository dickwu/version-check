import * as vscode from "vscode";
import { VersionCache } from "./cache";
import { LanguageProvider, PackageInfo } from "./types";
import { isVersionOutdated } from "../utils/semver";

const CACHE_NOT_FOUND = "__NOT_FOUND__";

interface ResolvedPackage {
  info: PackageInfo;
  latestVersion: string | undefined;
  notFound: boolean;
}

export class VersionCodeLensProvider implements vscode.CodeLensProvider {
  private emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this.emitter.event;
  private changeListener: vscode.Disposable | undefined;

  constructor(
    private providers: LanguageProvider[],
    private cache: VersionCache
  ) {
    this.changeListener = vscode.workspace.onDidChangeTextDocument((e) => {
      if (this.findProvider(e.document.fileName)) {
        this.refresh();
      }
    });
  }

  private getIgnorePatterns(): string[] {
    const config = vscode.workspace.getConfiguration("versionCheck");
    return config.get<string[]>("ignorePrereleasePatterns", []);
  }

  dispose() {
    this.changeListener?.dispose();
    this.emitter.dispose();
  }

  refresh() {
    this.emitter.fire();
  }

  async provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
    const provider = this.findProvider(document.fileName);
    if (!provider) {
      return [];
    }
    const packages = provider.parseDocument(document);
    const lenses: vscode.CodeLens[] = [];
    const sectionUpdates = new Map<string, { packages: ResolvedPackage[]; firstLine: number }>();
    const ignorePatterns = this.getIgnorePatterns();

    for (const info of packages) {
      if (token.isCancellationRequested) {
        break;
      }
      if (provider.shouldSkipVersion?.(info.currentVersion)) {
        continue;
      }

      const cacheKey = `${provider.id}:${info.name}`;
      let latestVersion = this.cache.get(cacheKey);
      let notFound = false;

      if (!latestVersion) {
        try {
          latestVersion = await provider.getLatestVersion(info.name, ignorePatterns) ?? undefined;
        } catch {
          latestVersion = undefined;
        }
        if (latestVersion) {
          this.cache.set(cacheKey, latestVersion);
        } else {
          this.cache.set(cacheKey, CACHE_NOT_FOUND);
          notFound = true;
        }
      } else if (latestVersion === CACHE_NOT_FOUND) {
        notFound = true;
        latestVersion = undefined;
      }

      if (notFound) {
        info.updateAvailable = false;
        lenses.push(
          new vscode.CodeLens(info.range, {
            title: `⚠ Version not found for ${info.name}`,
            command: "versionCheck.updateDependency",
            arguments: [document.uri, provider.id, info, undefined]
          })
        );
        continue;
      }

      if (!latestVersion) {
        continue;
      }

      const updateAvailable = isVersionOutdated(info.currentVersion, latestVersion);
      if (!updateAvailable) {
        continue;
      }

      info.latestVersion = latestVersion;
      info.updateAvailable = true;

      const section = info.dependencyGroup ?? "default";
      if (!sectionUpdates.has(section)) {
        sectionUpdates.set(section, { packages: [], firstLine: info.range.start.line });
      }
      const sectionData = sectionUpdates.get(section)!;
      sectionData.packages.push({ info, latestVersion, notFound: false });
      if (info.range.start.line < sectionData.firstLine) {
        sectionData.firstLine = info.range.start.line;
      }

      lenses.push(
        new vscode.CodeLens(info.range, {
          title: `Choose version (latest ${latestVersion})`,
          command: "versionCheck.updateDependency",
          arguments: [document.uri, provider.id, info, latestVersion]
        })
      );
    }

    for (const [section, data] of sectionUpdates) {
      if (data.packages.length < 2) {
        continue;
      }
      const updateAllRange = new vscode.Range(
        new vscode.Position(data.firstLine, 0),
        new vscode.Position(data.firstLine, 0)
      );
      const updates = data.packages.map((pkg) => ({
        info: pkg.info,
        latestVersion: pkg.latestVersion
      }));
      lenses.push(
        new vscode.CodeLens(updateAllRange, {
          title: `⬆ Update all ${data.packages.length} in ${section}`,
          command: "versionCheck.updateAllInSection",
          arguments: [document.uri, provider.id, updates]
        })
      );
    }

    return lenses;
  }

  private findProvider(fileName: string): LanguageProvider | undefined {
    return this.providers.find((provider) =>
      provider.fileNames.some((name) => fileName.endsWith(name))
    );
  }
}
