/**
 * Embedded Floating Developer Debug HUD E2E Test Entrypoint
 * Tests IPC tracing, warm-path latency benchmarking, and hardware overrides.
 */

import { runAllSuites, clearSuites } from './harness/test-runner.ts';
import { registerTier1ShowcaseCoverageTests } from './showcase/tier1-showcase-coverage.spec.ts';
import { registerTier3ShowcaseCrossFeatureTests } from './showcase/tier3-cross-feature.spec.ts';

async function main() {
  clearSuites();
  registerTier1ShowcaseCoverageTests();
  registerTier3ShowcaseCrossFeatureTests();
  const res = await runAllSuites();
  if (res.totalFailed > 0) process.exit(1);
  console.log(`✅ [hud.test.ts] ${res.totalPassed}/${res.totalTests} tests passed`);
}

main().catch(() => process.exit(1));
