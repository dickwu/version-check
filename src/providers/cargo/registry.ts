import { getJson } from "../../utils/http";

type CrateResponse = {
  crate?: {
    max_version?: string;
  };
};

type CrateVersionsResponse = {
  versions?: Array<{
    num?: string;
  }>;
};

let lastRequestAt = 0;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestAt;
  if (elapsed < 1000) {
    await delay(1000 - elapsed);
  }
  lastRequestAt = Date.now();
}

async function request<T>(url: string): Promise<T> {
  await rateLimit();
  return getJson<T>(url, {
    "User-Agent": "version-check-vscode"
  });
}

export async function fetchLatestCargoVersion(crateName: string): Promise<string | null> {
  const url = `https://crates.io/api/v1/crates/${encodeURIComponent(crateName)}`;
  const response = await request<CrateResponse>(url);
  return response.crate?.max_version ?? null;
}

export async function fetchCargoVersions(crateName: string): Promise<string[] | null> {
  const url = `https://crates.io/api/v1/crates/${encodeURIComponent(crateName)}/versions`;
  const response = await request<CrateVersionsResponse>(url);
  const versions = (response.versions ?? [])
    .map((item) => item.num)
    .filter((value): value is string => Boolean(value));
  return versions.length ? versions : null;
}
