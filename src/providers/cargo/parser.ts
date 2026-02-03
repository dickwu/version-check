import * as vscode from "vscode";
import { parse } from "smol-toml";
import { PackageInfo } from "../../core/types";

const SECTION_KEYS = ["dependencies", "dev-dependencies", "build-dependencies"];

type RangeMap = Map<string, vscode.Range>;

export function parseCargoDependencies(document: vscode.TextDocument): PackageInfo[] {
  const text = document.getText();
  let data: Record<string, unknown>;
  try {
    data = parse(text) as Record<string, unknown>;
  } catch {
    return [];
  }

  const rangeMap = findDependencyRanges(document);
  const results: PackageInfo[] = [];

  for (const section of SECTION_KEYS) {
    const sectionData = data[section];
    if (!sectionData || typeof sectionData !== "object") {
      continue;
    }
    for (const [name, rawValue] of Object.entries(sectionData)) {
      const version = extractVersion(rawValue);
      if (!version) {
        continue;
      }
      const rangeKey = `${section}:${name}`;
      const range = rangeMap.get(rangeKey);
      if (!range) {
        continue;
      }
      results.push({
        name,
        currentVersion: version,
        range,
        updateAvailable: false,
        dependencyGroup: section
      });
    }
  }

  return results;
}

function extractVersion(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object") {
    const version = (value as { version?: unknown }).version;
    if (typeof version === "string") {
      return version;
    }
  }
  return null;
}

function findDependencyRanges(document: vscode.TextDocument): RangeMap {
  const rangeMap: RangeMap = new Map();
  const lines = document.getText().split(/\r?\n/);
  let currentSection: string | null = null;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const headerMatch = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (headerMatch) {
      currentSection = normalizeSection(headerMatch[1]);
      continue;
    }
    if (!currentSection) {
      continue;
    }
    const lineWithoutComment = line.split("#")[0];
    if (!lineWithoutComment.trim()) {
      continue;
    }

    const inlineTableMatch = lineWithoutComment.match(/^\s*([A-Za-z0-9_-]+)\s*=\s*\{[^}]*\}/);
    if (inlineTableMatch) {
      const nameMatch = lineWithoutComment.match(/^\s*([A-Za-z0-9_-]+)\s*=/);
      const versionMatch = lineWithoutComment.match(/version\s*=\s*"([^"]+)"/);
      if (nameMatch && versionMatch) {
        const name = nameMatch[1];
        const version = versionMatch[1];
        const versionIndex = line.indexOf(`"${version}"`) + 1;
        if (versionIndex > 0) {
          const range = new vscode.Range(
            new vscode.Position(lineIndex, versionIndex),
            new vscode.Position(lineIndex, versionIndex + version.length)
          );
          rangeMap.set(`${currentSection}:${name}`, range);
        }
      }
      continue;
    }

    const simpleMatch = lineWithoutComment.match(/^\s*([A-Za-z0-9_-]+)\s*=\s*"([^"]+)"/);
    if (simpleMatch) {
      const name = simpleMatch[1];
      const version = simpleMatch[2];
      const versionIndex = line.indexOf(`"${version}"`) + 1;
      if (versionIndex > 0) {
        const range = new vscode.Range(
          new vscode.Position(lineIndex, versionIndex),
          new vscode.Position(lineIndex, versionIndex + version.length)
        );
        rangeMap.set(`${currentSection}:${name}`, range);
      }
    }
  }

  return rangeMap;
}

function normalizeSection(sectionName: string): string | null {
  if (SECTION_KEYS.includes(sectionName)) {
    return sectionName;
  }
  if (sectionName.endsWith(".dependencies")) {
    return "dependencies";
  }
  if (sectionName.endsWith(".dev-dependencies")) {
    return "dev-dependencies";
  }
  if (sectionName.endsWith(".build-dependencies")) {
    return "build-dependencies";
  }
  return null;
}
