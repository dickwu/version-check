import { getJson, getText } from "../../utils/http";

type GoLatestResponse = {
  Version?: string;
};

export async function fetchLatestGoVersion(modulePath: string): Promise<string | null> {
  const encoded = encodeURIComponent(modulePath);
  const url = `https://proxy.golang.org/${encoded}/@latest`;
  const response = await getJson<GoLatestResponse>(url);
  return response.Version ?? null;
}

export async function fetchGoVersions(modulePath: string): Promise<string[] | null> {
  const encoded = encodeURIComponent(modulePath);
  const url = `https://proxy.golang.org/${encoded}/@v/list`;
  const response = await getText(url);
  const versions = response
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return versions.length ? versions : null;
}
