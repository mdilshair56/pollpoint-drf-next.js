import { randomUUID } from "node:crypto";

declare global {
  var __pollpointSessionRuntimeId: string | undefined;
}

export function initializeSessionRuntime(): void {
  globalThis.__pollpointSessionRuntimeId ??= randomUUID();
}

export function getSessionRuntimeId(): string {
  initializeSessionRuntime();
  return globalThis.__pollpointSessionRuntimeId!;
}
