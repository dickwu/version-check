import * as vscode from "vscode";
import { VersionCache } from "./cache";
import { LanguageProvider } from "./types";
import { isVersionOutdated } from "../utils/semver";

const CACHE_NOT_FOUND = "__NOT_FOUND__";

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
          latestVersion = await provider.getLatestVersion(info.name) ?? undefined;
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
      lenses.push(
        new vscode.CodeLens(info.range, {
          title: `Choose version (latest ${latestVersion})`,
          command: "versionCheck.updateDependency",
          arguments: [document.uri, provider.id, info, latestVersion]
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
