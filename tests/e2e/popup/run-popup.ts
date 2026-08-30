/**
 * Goat WebView Task 10183 Popup Manager Master E2E Test Runner
 *
 * Executes 4-Tier Opaque-Box Verification Suite for:
 * - Task 10183: Popup Window Open & Target _Blank Modal/Browser Handler (GoatPopupManager)
 *   Tiers 1–4 across Android, iOS, React Native Fabric, and Flutter PlatformView.
 */

import { runAllSuites, clearSuites } from '../harness/test-runner.ts';
import { registerTier1PopupCoverageTests } from './tier1-popup-coverage.spec.ts';
import { registerTier2BoundaryCornerTests } from './tier2-boundary-corner.spec.ts';
import { registerTier3CrossFeatureTests } from './tier3-cross-feature.spec.ts';
import { registerTier4RealWorldScenariosTests } from './tier4-real-world-scenarios.spec.ts';

export async function runPopupSuites() {
  console.log('================================================================================');
  console.log('🪟 [Goat WebView Task 10183] Popup Manager 4-Tier E2E Test Suite');
  console.log('================================================================================\n');

  clearSuites();

  console.log('📦 Registering Tier 1: Feature Coverage (60 tests across 12 features)...');
  registerTier1PopupCoverageTests();

  console.log('🛡️  Registering Tier 2: Boundary & Corner Cases (60 tests across 12 edge cases)...');
  registerTier2BoundaryCornerTests();

  console.log('🔄 Registering Tier 3: Cross-Feature Interactions (8 complex pairwise scenarios)...');
  registerTier3CrossFeatureTests();

  console.log('🌐 Registering Tier 4: Real-World SuperApp Workflows (4 full-lifecycle scenarios)...');
  registerTier4RealWorldScenariosTests();

  console.log('\n🚀 Executing Task 10183 Popup Manager E2E Test Suites...\n');

  const summary = await runAllSuites();

  console.log('--------------------------------------------------------------------------------');
  console.log('📊 Task 10183 E2E Test Execution Summary:');
  console.log('--------------------------------------------------------------------------------');
  console.log(`Total Test Suites: ${summary.totalSuites}`);
  console.log(`Total Test Cases:  ${summary.totalTests}`);
  console.log(`Passed:            ${summary.totalPassed} ✅`);
  console.log(`Failed:            ${summary.totalFailed} ${summary.totalFailed > 0 ? '❌' : ''}`);
  console.log(`Total Duration:    ${summary.durationMs}ms`);
  console.log('--------------------------------------------------------------------------------\n');

  if (summary.totalFailed > 0) {
    console.error(`❌ [FAILED] ${summary.totalFailed} test(s) failed in Popup Manager E2E Suite:`);
    for (const s of summary.summaries) {
      for (const r of s.results) {
        if (!r.passed) {
          console.error(`  - [${r.suite}] ${r.name}`);
          if (r.error) {
            console.error(`    ${r.error.stack || r.error.message}`);
          }
        }
      }
    }
    process.exit(1);
  }

  console.log('🎉 [SUCCESS] 100% Task 10183 Popup Manager E2E Tests Passed!');
  return summary;
}

// Auto-run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runPopupSuites().catch((err) => {
    console.error('Fatal error running Popup Manager E2E suite:', err);
    process.exit(1);
  });
}
