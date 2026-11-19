import { ApiError } from "@/lib/api/api-client";

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (Array.isArray(error.details)) return error.details.map(String).join(" ");
    if (error.details && typeof error.details === "object") {
      const messages = Object.values(error.details as Record<string, unknown>)
        .flatMap((value) => Array.isArray(value) ? value : [value])
        .map((value) => typeof value === "string" ? value : JSON.stringify(value));
      if (messages.length) return messages.join(" ");
    }
    return error.message;
  }

  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
