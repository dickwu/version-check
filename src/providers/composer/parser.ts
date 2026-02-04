import * as vscode from "vscode";
import { parseTree, findNodeAtLocation, Node } from "jsonc-parser";
import { PackageInfo } from "../../core/types";

const DEP_SECTIONS = ["require", "require-dev"];

/**
 * Check if package name is a platform requirement (not a real Packagist package)
 * Platform packages: php, ext-*, lib-*, hhvm, composer-*
 */
function isPlatformPackage(name: string): boolean {
  const lowerName = name.toLowerCase();
  return (
    lowerName === "php" ||
    lowerName === "hhvm" ||
    lowerName.startsWith("ext-") ||
    lowerName.startsWith("lib-") ||
    lowerName.startsWith("composer-")
  );
}

export function parseComposerDependencies(document: vscode.TextDocument): PackageInfo[] {
  const text = document.getText();
  const root = parseTree(text);
  if (!root) {
    return [];
  }

  const results: PackageInfo[] = [];
  for (const section of DEP_SECTIONS) {
    const sectionNode = findNodeAtLocation(root, [section]);
    if (!sectionNode || sectionNode.type !== "object" || !sectionNode.children) {
      continue;
    }
    for (const propertyNode of sectionNode.children) {
      const [keyNode, valueNode] = propertyNode.children ?? [];
      if (!keyNode || !valueNode) {
        continue;
      }
      if (keyNode.type !== "string" || valueNode.type !== "string") {
        continue;
      }
      const name = String(keyNode.value ?? "");
      const currentVersion = String(valueNode.value ?? "");
      const range = valueNodeRange(document, valueNode);
      if (!name || !currentVersion || !range) {
        continue;
      }
      // Skip platform packages (php, ext-*, lib-*, hhvm, composer-*)
      if (isPlatformPackage(name)) {
        continue;
      }
      results.push({
        name,
        currentVersion,
        range,
        updateAvailable: false,
        dependencyGroup: section
      });
    }
  }
  return results;
}

function valueNodeRange(
  document: vscode.TextDocument,
  valueNode: Node
): vscode.Range | null {
  if (valueNode.type !== "string" || valueNode.length < 2) {
    return null;
  }
  const start = valueNode.offset + 1;
  const end = valueNode.offset + valueNode.length - 1;
  return new vscode.Range(document.positionAt(start), document.positionAt(end));
}
