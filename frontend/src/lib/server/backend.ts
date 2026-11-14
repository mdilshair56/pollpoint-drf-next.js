import "server-only";

const rawBaseUrl = process.env.DJANGO_API_BASE_URL;

if (!rawBaseUrl) {
  throw new Error("DJANGO_API_BASE_URL is missing. Add it to frontend/.env.local.");
}

export const DJANGO_API_BASE_URL = rawBaseUrl.replace(/\/+$/, "");

export function djangoUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${DJANGO_API_BASE_URL}${normalizedPath}`;
}

export async function djangoJson<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<{ response: Response; body: T | null }> {
  const response = await fetch(djangoUrl(path), {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  const text = await response.text();
  let body: T | null = null;

  if (text) {
    try {
      body = JSON.parse(text) as T;
    } catch {
      body = null;
    }
  }

  return { response, body };
}
