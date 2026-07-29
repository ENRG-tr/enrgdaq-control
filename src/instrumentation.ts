/**
 * Server-side instrumentation - runs once at server boot.
 * Sets up a background job to periodically check for runs that
 * need to be auto-stopped (scheduled end time passed, or DAQ
 * jobs no longer alive). This ensures runs are stopped even
 * when no client has the web app open.
 */

const RUN_CHECK_INTERVAL_MS = 5000; // Check every 5 seconds

export async function register() {
  // Only run in Node.js runtime (not Edge, not during build)
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // Dynamic import to ensure all server-only dependencies
  // are only loaded in the Node.js runtime.
  const { RunController } = await import('./lib/runs');

  console.log(
    `[Instrumentation] Starting background run checker every ${
      RUN_CHECK_INTERVAL_MS / 1000
    }s`,
  );

  // Periodically check for runs that need auto-stopping.
  // This is the background job the user asked for: it runs
  // independently of any client polling and stops runs even
  // when nobody has the web app open.
  const interval = setInterval(async () => {
    try {
      await RunController.checkAndStopExpiredRuns();
    } catch (e) {
      console.error('[Instrumentation] Background run check failed:', e);
    }
  }, RUN_CHECK_INTERVAL_MS);

  // Clean up on graceful shutdown
  if (typeof process !== 'undefined') {
    process.on('beforeExit', () => {
      clearInterval(interval);
    });
    process.on('SIGTERM', () => {
      clearInterval(interval);
    });
    process.on('SIGINT', () => {
      clearInterval(interval);
    });
  }
}
