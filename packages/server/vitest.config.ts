import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Retry flaky network/socket tests up to 2 additional times before marking as failed.
    // The manifest-asset suite spins up real HTTP servers; under high concurrent load
    // (verify-packages running all 10 packages in parallel) the OS socket backlog can
    // cause a transient "socket hang up" on the first connection attempt.
    retry: 2,
    testTimeout: 30000,
  },
});
