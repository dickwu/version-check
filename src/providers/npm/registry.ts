import { getJson } from "../../utils/http";

type NpmLatestResponse = {
  version?: string;
};

type NpmPackageResponse = {
  versions?: Record<string, unknown>;
};

export async function fetchLatestNpmVersion(packageName: string): Promise<string | null> {
  const encoded = encodeURIComponent(packageName);
  const url = `https://registry.npmjs.org/${encoded}/latest`;
  const response = await getJson<NpmLatestResponse>(url);
  return response.version ?? null;
}

export async function fetchNpmVersions(packageName: string): Promise<string[] | null> {
  const encoded = encodeURIComponent(packageName);
  const url = `https://registry.npmjs.org/${encoded}`;
  const response = await getJson<NpmPackageResponse>(url);
  const versions = response.versions ? Object.keys(response.versions) : [];
  return versions.length ? versions : null;
}
