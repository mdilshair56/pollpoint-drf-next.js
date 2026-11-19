export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initializeSessionRuntime } = await import(
      "./lib/server/session-runtime"
    );
    initializeSessionRuntime();
  }
}
