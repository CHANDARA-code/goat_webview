/**
 * Mini-Apps E2E Test Entrypoint
 * Tests all 4 Domain Mini-Apps (E-Commerce, IoT, Field Service, Secure Biometric Vault)
 */

import { runAllSuites, clearSuites } from './harness/test-runner.ts';
import { registerTier1ShowcaseCoverageTests } from './showcase/tier1-showcase-coverage.spec.ts';
import { registerTier2ShowcaseBoundaryTests } from './showcase/tier2-boundary-corner.spec.ts';

async function main() {
  clearSuites();
  registerTier1ShowcaseCoverageTests();
  registerTier2ShowcaseBoundaryTests();
  const res = await runAllSuites();
  if (res.totalFailed > 0) process.exit(1);
  console.log(`✅ [miniapps.test.ts] ${res.totalPassed}/${res.totalTests} tests passed`);
}

main().catch(() => process.exit(1));
