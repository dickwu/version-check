import * as vscode from "vscode";
import { LanguageProvider } from "./types";

export class VersionCodeActionProvider implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  constructor(private providers: LanguageProvider[]) { }

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection
  ): vscode.CodeAction[] {
    const provider = this.findProvider(document.fileName);
    if (!provider) {
      return [];
    }
    const packages = provider.parseDocument(document);
    const target = packages.find((info) => {
      if (info.range.intersection(range)) {
        return true;
      }
      return info.range.contains(range.start) || range.contains(info.range.start);
    });
    if (!target) {
      return [];
    }

    const action = new vscode.CodeAction(
      "Choose dependency version",
      vscode.CodeActionKind.QuickFix
    );
    action.isPreferred = true;
    action.command = {
      title: "Choose dependency version",
      command: "versionCheck.updateDependency",
      arguments: [document.uri, provider.id, target]
    };
    return [action];
  }

  private findProvider(fileName: string): LanguageProvider | undefined {
    return this.providers.find((provider) =>
      provider.fileNames.some((name) => fileName.endsWith(name))
    );
  }
}
