import * as vscode from "vscode";
import { VersionCache } from "./cache";
import { LanguageProvider, PackageInfo } from "./types";
import { isVersionOutdated, getVersionDiffLevel } from "../utils/semver";

const CACHE_NOT_FOUND = "__NOT_FOUND__";

interface ResolvedPackage {
  info: PackageInfo;
  latestVersion: string | undefined;
  notFound: boolean;
}

/** Tracks resolved package data per line for incremental updates */
interface DocumentState {
  /** Map of line number to resolved package data */
  resolvedByLine: Map<number, ResolvedPackage>;
  /** Document version when this state was captured */
  version: number;
}

export class VersionCodeLensProvider implements vscode.CodeLensProvider {
  private emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this.emitter.event;
  private changeListener: vscode.Disposable | undefined;

  /** Cached document states for incremental updates */
  private documentStates = new Map<string, DocumentState>();
  /** Lines that changed since last check, per document URI */
  private changedLines = new Map<string, Set<number>>();
  /** Force full refresh flag per document */
  private forceFullRefresh = new Set<string>();

  /** Gutter dot decorations for version status */
  private greenDeco: vscode.TextEditorDecorationType;
  private yellowDeco: vscode.TextEditorDecorationType;
  private redDeco: vscode.TextEditorDecorationType;
  /** Stored decoration ranges per document for reapplication on editor switch */
  private decorationRanges = new Map<string, { green: vscode.Range[]; yellow: vscode.Range[]; red: vscode.Range[] }>();
  private editorListener: vscode.Disposable | undefined;

  constructor(
    private providers: LanguageProvider[],
    private cache: VersionCache,
    private extensionUri: vscode.Uri
  ) {
    this.changeListener = vscode.workspace.onDidChangeTextDocument((e) => {
      if (!this.findProvider(e.document.fileName)) {
        return;
      }
      const uri = e.document.uri.toString();

      // Track which lines changed
      if (!this.changedLines.has(uri)) {
        this.changedLines.set(uri, new Set());
      }
      const changed = this.changedLines.get(uri)!;

      for (const change of e.contentChanges) {
        const startLine = change.range.start.line;
        const endLine = change.range.end.line;

        // Mark all lines in the change range as dirty
        for (let line = startLine; line <= endLine; line++) {
          changed.add(line);
        }

        // If lines were added/removed, we need to adjust line tracking
        // For simplicity, if newlines change, mark subsequent lines as needing re-check
        const oldLineCount = endLine - startLine + 1;
        const newLineCount = change.text.split("\n").length;
        if (oldLineCount !== newLineCount) {
          // Line shift occurred - invalidate all lines after the change
          this.invalidateLinesAfter(uri, startLine);
        }
      }

      this.refresh();
    });

    this.greenDeco = this.createDotDecoration("resources/gutter-green.svg");
    this.yellowDeco = this.createDotDecoration("resources/gutter-yellow.svg");
    this.redDeco = this.createDotDecoration("resources/gutter-red.svg");

    this.editorListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        this.reapplyDecorations(editor);
      }
    });
  }

  private createDotDecoration(relativePath: string): vscode.TextEditorDecorationType {
    const iconPath = vscode.Uri.joinPath(this.extensionUri, relativePath);
    return vscode.window.createTextEditorDecorationType({
      gutterIconPath: iconPath,
      gutterIconSize: "contain",
      isWholeLine: true
    });
  }

  private reapplyDecorations(editor: vscode.TextEditor) {
    const uri = editor.document.uri.toString();
    const ranges = this.decorationRanges.get(uri);
    if (!ranges) {
      editor.setDecorations(this.greenDeco, []);
      editor.setDecorations(this.yellowDeco, []);
      editor.setDecorations(this.redDeco, []);
      return;
    }
    editor.setDecorations(this.greenDeco, ranges.green);
    editor.setDecorations(this.yellowDeco, ranges.yellow);
    editor.setDecorations(this.redDeco, ranges.red);
  }

  private applyDecorations(
    document: vscode.TextDocument,
    green: vscode.Range[],
    yellow: vscode.Range[],
    red: vscode.Range[]
  ) {
    const uri = document.uri.toString();
    this.decorationRanges.set(uri, { green, yellow, red });
    const editor = vscode.window.visibleTextEditors.find(
      (e) => e.document.uri.toString() === uri
    );
    if (editor) {
      editor.setDecorations(this.greenDeco, green);
      editor.setDecorations(this.yellowDeco, yellow);
      editor.setDecorations(this.redDeco, red);
    }
  }

  /** Invalidate all cached data for lines after a certain point */
  private invalidateLinesAfter(uri: string, afterLine: number) {
    const state = this.documentStates.get(uri);
    if (!state) {
      return;
    }
    // Remove cached data for all lines after the change point
    for (const line of state.resolvedByLine.keys()) {
      if (line >= afterLine) {
        state.resolvedByLine.delete(line);
      }
    }
  }

  private getIgnorePatterns(): string[] {
    const config = vscode.workspace.getConfiguration("versionCheck");
    return config.get<string[]>("ignorePrereleasePatterns", []);
  }

  dispose() {
    this.changeListener?.dispose();
    this.editorListener?.dispose();
    this.emitter.dispose();
    this.greenDeco.dispose();
    this.yellowDeco.dispose();
    this.redDeco.dispose();
    this.documentStates.clear();
    this.changedLines.clear();
    this.forceFullRefresh.clear();
    this.decorationRanges.clear();
  }

  refresh() {
    this.emitter.fire();
  }

  /** Force a full refresh, clearing all cached state */
  fullRefresh() {
    for (const uri of this.documentStates.keys()) {
      this.forceFullRefresh.add(uri);
    }
    this.decorationRanges.clear();
    this.emitter.fire();
  }

  /** Clear state for a specific document */
  clearDocumentState(uri: string) {
    this.documentStates.delete(uri);
    this.changedLines.delete(uri);
    this.forceFullRefresh.add(uri);
    this.decorationRanges.delete(uri);
  }

  async provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
    const provider = this.findProvider(document.fileName);
    if (!provider) {
      return [];
    }

    const uri = document.uri.toString();
    const packages = provider.parseDocument(document);
    const lenses: vscode.CodeLens[] = [];
    const sectionUpdates = new Map<string, { packages: ResolvedPackage[]; firstLine: number }>();
    const ignorePatterns = this.getIgnorePatterns();
    const greenRanges: vscode.Range[] = [];
    const yellowRanges: vscode.Range[] = [];
    const redRanges: vscode.Range[] = [];

    // Get or create document state
    let state = this.documentStates.get(uri);
    const isFullRefresh = this.forceFullRefresh.has(uri) || !state;

    if (isFullRefresh) {
      state = { resolvedByLine: new Map(), version: document.version };
      this.documentStates.set(uri, state);
      this.forceFullRefresh.delete(uri);
    }

    // Get changed lines for this document
    const changed = this.changedLines.get(uri) ?? new Set<number>();
    // Clear changed lines after reading
    this.changedLines.delete(uri);

    // Build a map of current packages by name for quick lookup
    const currentPackagesByName = new Map<string, PackageInfo>();
    for (const pkg of packages) {
      currentPackagesByName.set(pkg.name, pkg);
    }

    for (const info of packages) {
      if (token.isCancellationRequested) {
        break;
      }
      if (provider.shouldSkipVersion?.(info.currentVersion)) {
        continue;
      }

      const line = info.range.start.line;
      const lineChanged = isFullRefresh || changed.has(line);

      // Try to reuse cached resolved data if line didn't change
      let resolved: ResolvedPackage | undefined;
      if (!lineChanged) {
        // Look for cached data - check if package name and version match
        for (const [cachedLine, cachedResolved] of state!.resolvedByLine) {
          if (cachedResolved.info.name === info.name &&
            cachedResolved.info.currentVersion === info.currentVersion) {
            resolved = cachedResolved;
            // Update the range to current position (may have shifted)
            resolved.info.range = info.range;
            break;
          }
        }
      }

      if (!resolved) {
        // Need to resolve this package
        resolved = await this.resolvePackage(provider, info, ignorePatterns);
      }

      // Update state with current line position
      state!.resolvedByLine.set(line, resolved);

      if (resolved.notFound) {
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

      if (!resolved.latestVersion) {
        continue;
      }

      const updateAvailable = isVersionOutdated(info.currentVersion, resolved.latestVersion);
      const decoRange = info.range.isEmpty
        ? new vscode.Range(line, 0, line, 0)
        : info.range;

      if (!updateAvailable) {
        greenRanges.push(decoRange);
        lenses.push(
          new vscode.CodeLens(info.range, {
            title: `✓ Latest (${resolved.latestVersion})`,
            command: "versionCheck.updateDependency",
            arguments: [document.uri, provider.id, info, resolved.latestVersion]
          })
        );
        continue;
      }

      info.latestVersion = resolved.latestVersion;
      info.updateAvailable = true;

      const diffLevel = getVersionDiffLevel(info.currentVersion, resolved.latestVersion);
      if (diffLevel === "major") {
        redRanges.push(decoRange);
      } else {
        yellowRanges.push(decoRange);
      }

      const section = info.dependencyGroup ?? "default";
      if (!sectionUpdates.has(section)) {
        sectionUpdates.set(section, { packages: [], firstLine: info.range.start.line });
      }
      const sectionData = sectionUpdates.get(section)!;
      sectionData.packages.push({ info, latestVersion: resolved.latestVersion, notFound: false });
      if (info.range.start.line < sectionData.firstLine) {
        sectionData.firstLine = info.range.start.line;
      }

      lenses.push(
        new vscode.CodeLens(info.range, {
          title: `Choose version (latest ${resolved.latestVersion})`,
          command: "versionCheck.updateDependency",
          arguments: [document.uri, provider.id, info, resolved.latestVersion]
        })
      );
    }

    // Clean up stale entries from state (packages that no longer exist)
    const currentLines = new Set(packages.map(p => p.range.start.line));
    for (const line of state!.resolvedByLine.keys()) {
      if (!currentLines.has(line)) {
        state!.resolvedByLine.delete(line);
      }
    }

    state!.version = document.version;

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

    this.applyDecorations(document, greenRanges, yellowRanges, redRanges);

    return lenses;
  }

  /** Resolve a single package's latest version */
  private async resolvePackage(
    provider: LanguageProvider,
    info: PackageInfo,
    ignorePatterns: string[]
  ): Promise<ResolvedPackage> {
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

    return { info, latestVersion, notFound };
  }

  private findProvider(fileName: string): LanguageProvider | undefined {
    return this.providers.find((provider) =>
      provider.fileNames.some((name) => fileName.endsWith(name))
    );
  }
}
