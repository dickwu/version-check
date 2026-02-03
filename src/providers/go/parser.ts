import * as vscode from "vscode";
import { PackageInfo } from "../../core/types";

export function parseGoDependencies(document: vscode.TextDocument): PackageInfo[] {
  const lines = document.getText().split(/\r?\n/);
  const results: PackageInfo[] = [];
  let inRequireBlock = false;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const trimmed = line.trim();

    if (trimmed.startsWith("require") && trimmed.endsWith("(")) {
      inRequireBlock = true;
      continue;
    }
    if (inRequireBlock && trimmed.startsWith(")")) {
      inRequireBlock = false;
      continue;
    }

    const lineWithoutComment = line.split("//")[0];
    if (!lineWithoutComment.trim()) {
      continue;
    }

    if (trimmed.startsWith("require ") && !inRequireBlock) {
      const info = parseRequireLine(lineWithoutComment, lineIndex);
      if (info) {
        results.push(info);
      }
      continue;
    }

    if (inRequireBlock) {
      const info = parseRequireLine(lineWithoutComment, lineIndex);
      if (info) {
        results.push(info);
      }
    }
  }

  return results;
}

function parseRequireLine(line: string, lineIndex: number): PackageInfo | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("require ")) {
    return parseSingleRequire(trimmed, line, lineIndex);
  }
  const tokens = trimmed.split(/\s+/);
  if (tokens.length < 2) {
    return null;
  }
  return buildPackageInfo(tokens[0], tokens[1], line, lineIndex);
}

function parseSingleRequire(
  trimmed: string,
  originalLine: string,
  lineIndex: number
): PackageInfo | null {
  const tokens = trimmed.replace(/^require\s+/, "").split(/\s+/);
  if (tokens.length < 2) {
    return null;
  }
  return buildPackageInfo(tokens[0], tokens[1], originalLine, lineIndex);
}

function buildPackageInfo(
  moduleName: string,
  version: string,
  line: string,
  lineIndex: number
): PackageInfo | null {
  const versionIndex = line.indexOf(version);
  if (versionIndex < 0) {
    return null;
  }
  return {
    name: moduleName,
    currentVersion: version,
    range: new vscode.Range(
      new vscode.Position(lineIndex, versionIndex),
      new vscode.Position(lineIndex, versionIndex + version.length)
    ),
    updateAvailable: false,
    dependencyGroup: "require"
  };
}
