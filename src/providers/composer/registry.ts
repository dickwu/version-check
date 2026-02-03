import { getJson } from "../../utils/http";
import { compareSemver, extractSemver } from "../../utils/semver";

type PackagistResponse = {
  package?: {
    versions?: Record<string, unknown>;
  };
};

export async function fetchLatestComposerVersion(packageName: string): Promise<string | null> {
  const versions = await fetchComposerVersions(packageName);
  if (!versions) {
    return null;
  }
  return pickLatestVersion(versions);
}

export async function fetchComposerVersions(packageName: string): Promise<string[] | null> {
  const [vendor, name] = packageName.split("/");
  if (!vendor || !name) {
    return null;
  }
  const url = `https://packagist.org/packages/${encodeURIComponent(vendor)}/${encodeURIComponent(name)}.json`;
  const response = await getJson<PackagistResponse>(url);
  const versions = response.package?.versions ? Object.keys(response.package.versions) : [];
  return versions.length ? versions : null;
}

function pickLatestVersion(versions: string[]): string | null {
  let bestVersion: string | null = null;
  let bestSemver: ReturnType<typeof extractSemver> | null = null;

  for (const version of versions) {
    const semver = extractSemver(version);
    if (!semver) {
      continue;
    }
    if (!bestSemver || compareSemver(bestSemver, semver) < 0) {
      bestSemver = semver;
      bestVersion = version;
    }
  }
  return bestVersion;
}
