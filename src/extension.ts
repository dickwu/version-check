import * as vscode from "vscode";
import { VersionCache } from "./core/cache";
import { VersionCodeLensProvider } from "./core/codeLensProvider";
import { VersionCodeActionProvider } from "./core/codeActionProvider";
import { LanguageProvider, PackageInfo } from "./core/types";
import { NpmProvider } from "./providers/npm";
import { CargoProvider } from "./providers/cargo";
import { GoProvider } from "./providers/go";
import { ComposerProvider } from "./providers/composer";
import { compareSemver, extractSemver } from "./utils/semver";

const PROVIDER_SELECTORS: Record<string, vscode.DocumentSelector> = {
  npm: [{ pattern: "**/package.json" }],
  cargo: [{ pattern: "**/Cargo.toml" }],
  go: [{ pattern: "**/go.mod" }],
  composer: [{ pattern: "**/composer.json" }]
};

export function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration("versionCheck");
  const providersConfig = config.get<Record<string, boolean>>("providers", {});
  const ttlSeconds = config.get<number>("cacheTtlSeconds", 300);

  const allProviders: LanguageProvider[] = [
    new NpmProvider(),
    new CargoProvider(),
    new GoProvider(),
    new ComposerProvider()
  ];

  const enabledProviders = allProviders.filter((provider) => {
    const enabled = providersConfig[provider.id];
    return enabled !== false;
  });

  const cache = new VersionCache(ttlSeconds * 1000);
  const codeLensProvider = new VersionCodeLensProvider(enabledProviders, cache);
  const codeActionProvider = new VersionCodeActionProvider(enabledProviders);

  context.subscriptions.push({ dispose: () => codeLensProvider.dispose() });

  for (const provider of enabledProviders) {
    const selector = PROVIDER_SELECTORS[provider.id];
    if (!selector) {
      continue;
    }
    context.subscriptions.push(
      vscode.languages.registerCodeLensProvider(selector, codeLensProvider)
    );
    context.subscriptions.push(
      vscode.languages.registerCodeActionsProvider(selector, codeActionProvider, {
        providedCodeActionKinds: VersionCodeActionProvider.providedCodeActionKinds
      })
    );
  }

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "versionCheck.updateDependency",
      async (uri: vscode.Uri | string, providerId: string, info: PackageInfo, latest?: string) => {
        const provider = enabledProviders.find((item) => item.id === providerId);
        if (!provider) {
          return;
        }
        if (provider.shouldSkipVersion?.(info.currentVersion)) {
          return;
        }
        const documentUri = uri instanceof vscode.Uri ? uri : vscode.Uri.parse(String(uri));
        const chosenVersion = await pickVersion(provider, info, latest);
        if (!chosenVersion) {
          return;
        }
        const newVersion = provider.formatUpdatedVersion(info.currentVersion, chosenVersion);
        const edit = new vscode.WorkspaceEdit();
        edit.replace(documentUri, coerceRange(info.range), newVersion);
        await vscode.workspace.applyEdit(edit);
        codeLensProvider.refresh();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "versionCheck.updateAllInSection",
      async (
        uri: vscode.Uri | string,
        providerId: string,
        updates: Array<{ info: PackageInfo; latestVersion: string | undefined }>
      ) => {
        const provider = enabledProviders.find((item) => item.id === providerId);
        if (!provider || !updates.length) {
          return;
        }
        const documentUri = uri instanceof vscode.Uri ? uri : vscode.Uri.parse(String(uri));
        const edit = new vscode.WorkspaceEdit();

        const sortedUpdates = [...updates].sort(
          (a, b) => b.info.range.start.line - a.info.range.start.line
        );

        for (const { info, latestVersion } of sortedUpdates) {
          if (!latestVersion) {
            continue;
          }
          const newVersion = provider.formatUpdatedVersion(info.currentVersion, latestVersion);
          edit.replace(documentUri, coerceRange(info.range), newVersion);
        }

        await vscode.workspace.applyEdit(edit);
        codeLensProvider.refresh();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("versionCheck.refresh", () => {
      cache.clear();
      codeLensProvider.refresh();
    })
  );
}

export function deactivate() { }

type VersionPickItem = vscode.QuickPickItem & { version?: string };

function coerceRange(range: vscode.Range | { start: { line: number; character: number }; end: { line: number; character: number } }): vscode.Range {
  if (range instanceof vscode.Range) {
    return range;
  }
  return new vscode.Range(
    new vscode.Position(range.start.line, range.start.character),
    new vscode.Position(range.end.line, range.end.character)
  );
}

async function pickVersion(
  provider: LanguageProvider,
  info: PackageInfo,
  latestHint?: string
): Promise<string | null> {
  let available: string[] | null = null;
  try {
    available = await provider.getAvailableVersions(info.name);
  } catch {
    available = null;
  }
  const sorted = sortVersionsDesc(available ?? []);
  let latest = latestHint;
  if (!latest && sorted.length) {
    latest = sorted[0];
  }
  if (latest && !sorted.includes(latest)) {
    sorted.unshift(latest);
  }

  if (!sorted.length) {
    return promptVersionInput(info, latest);
  }

  const items: VersionPickItem[] = [
    {
      label: "Custom...",
      description: "Enter version manually"
    }
  ];

  for (const version of sorted) {
    items.push({
      label: version,
      description: describeVersion(version, info.currentVersion, latest),
      version
    });
  }

  const pick = await vscode.window.showQuickPick(items, {
    placeHolder: `Select version for ${info.name}`,
    matchOnDescription: true
  });
  if (!pick) {
    return null;
  }
  if (!pick.version) {
    return promptVersionInput(info, latest);
  }
  return pick.version;
}

async function promptVersionInput(
  info: PackageInfo,
  latest?: string
): Promise<string | null> {
  const value = await vscode.window.showInputBox({
    prompt: `Enter version for ${info.name}`,
    value: latest
  });
  return value?.trim() || null;
}

function sortVersionsDesc(versions: string[]): string[] {
  const unique = Array.from(
    new Set(versions.map((version) => version.trim()).filter(Boolean))
  );

  return unique.sort((a, b) => {
    const aSemver = extractSemver(a);
    const bSemver = extractSemver(b);
    if (aSemver && bSemver) {
      return compareSemver(bSemver, aSemver);
    }
    if (aSemver) {
      return -1;
    }
    if (bSemver) {
      return 1;
    }
    return b.localeCompare(a);
  });
}

function describeVersion(
  version: string,
  currentVersion: string,
  latest?: string
): string | undefined {
  if (latest && isSameVersion(version, latest)) {
    return "latest";
  }
  if (isSameVersion(version, currentVersion)) {
    return "current";
  }
  return undefined;
}

function isSameVersion(left: string, right: string): boolean {
  if (!left || !right) {
    return false;
  }
  const leftSemver = extractSemver(left);
  const rightSemver = extractSemver(right);
  if (leftSemver && rightSemver) {
    return compareSemver(leftSemver, rightSemver) === 0;
  }
  return left.trim() === right.trim();
}
