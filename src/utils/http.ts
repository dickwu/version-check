import * as http from "http";
import * as https from "https";

type Headers = Record<string, string>;

export async function getJson<T>(
  url: string,
  headers: Headers = {},
  timeoutMs = 10000
): Promise<T> {
  const mergedHeaders: Headers = {
    "User-Agent": "version-check-vscode",
    Accept: "application/json",
    ...headers
  };

  return new Promise<T>((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const req = client.request(url, { method: "GET", headers: mergedHeaders }, (res) => {
      const status = res.statusCode ?? 0;
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        if (status < 200 || status >= 300) {
          reject(new Error(`HTTP ${status} for ${url}`));
          return;
        }
        try {
          resolve(JSON.parse(data) as T);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Request timeout after ${timeoutMs}ms`));
    });
    req.on("error", reject);
    req.end();
  });
}

export async function getText(
  url: string,
  headers: Headers = {},
  timeoutMs = 10000
): Promise<string> {
  const mergedHeaders: Headers = {
    "User-Agent": "version-check-vscode",
    Accept: "*/*",
    ...headers
  };

  return new Promise<string>((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const req = client.request(url, { method: "GET", headers: mergedHeaders }, (res) => {
      const status = res.statusCode ?? 0;
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        if (status < 200 || status >= 300) {
          reject(new Error(`HTTP ${status} for ${url}`));
          return;
        }
        resolve(data);
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Request timeout after ${timeoutMs}ms`));
    });
    req.on("error", reject);
    req.end();
  });
}
