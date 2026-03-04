/**
 * Global test setup.
 * Runs before every test file.
 */

// Ensure we never accidentally connect to the production database.
// The test helpers set DATABASE_URL to ":memory:" via vi.mock, but
// this belt-and-suspenders guard catches edge cases.
process.env.NODE_ENV = "test";

// Suppress console.error noise from expected error paths in tests
const originalError = console.error;
beforeEach(() => {
  console.error = (...args: unknown[]) => {
    // Allow the real call but only for non-expected internal errors
    const msg = String(args[0] ?? "");
    if (
      msg.includes("[ingest/session]") ||
      msg.includes("[ingest/events]") ||
      msg.includes("[ai-insights]")
    ) {
      return; // suppress expected error logs from route handlers
    }
    originalError(...args);
  };
});

afterEach(() => {
  console.error = originalError;
});
