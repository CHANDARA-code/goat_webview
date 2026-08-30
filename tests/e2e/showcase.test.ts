/**
 * SuperApp Showcase Master E2E Test Entrypoint
 * Executes the complete 4-Tier Showcase Test Suite
 */

import { runAllSuites, clearSuites } from './harness/test-runner.ts';
import { registerTier1ShowcaseCoverageTests } from './showcase/tier1-showcase-coverage.spec.ts';
import { registerTier2ShowcaseBoundaryTests } from './showcase/tier2-boundary-corner.spec.ts';
import { registerTier3ShowcaseCrossFeatureTests } from './showcase/tier3-cross-feature.spec.ts';
import { registerTier4ShowcaseRealWorldTests } from './showcase/tier4-real-world-scenarios.spec.ts';

async function main() {
  clearSuites();
  registerTier1ShowcaseCoverageTests();
  registerTier2ShowcaseBoundaryTests();
  registerTier3ShowcaseCrossFeatureTests();
  registerTier4ShowcaseRealWorldTests();
  const res = await runAllSuites();
  if (res.totalFailed > 0) process.exit(1);
  console.log(`✅ [showcase.test.ts] ${res.totalPassed}/${res.totalTests} tests passed`);
}

main().catch(() => process.exit(1));
