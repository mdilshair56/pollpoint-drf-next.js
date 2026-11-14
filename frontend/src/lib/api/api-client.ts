export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ApiClient {
  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    let response: Response;

    try {
      response = await fetch(path, {
        ...options,
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...options.headers,
        },
      });
    } catch {
      throw new ApiError(
        "Cannot reach the application server. Check that Next.js and Django are running.",
        0,
      );
    }

    const responseText = await response.text();
    let payload: unknown = null;
    if (responseText) {
      try {
        payload = JSON.parse(responseText);
      } catch {
        payload = responseText;
      }
    }

    if (!response.ok) {
      const data = payload as {
        message?: string;
        detail?: string;
        errors?: unknown;
      } | null;
      throw new ApiError(
        data?.message ?? data?.detail ?? "Request failed with status " + response.status + ".",
        response.status,
        data?.errors ?? payload,
      );
    }

    return payload as T;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "GET" });
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "DELETE" });
  }
}

export const apiClient = new ApiClient();
