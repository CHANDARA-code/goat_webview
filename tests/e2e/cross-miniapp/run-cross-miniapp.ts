/**
 * Goat WebView Task 10201 Cross-MiniApp Launch & Windowed Presentation Master E2E Runner
 *
 * Executes 4-Tier Opaque-Box Verification Suite for:
 * - Task 10201: Cross-MiniApp Launch & Windowed Presentation Bridge (`GoatCrossMiniAppManager`)
 *   Tiers 1–4 across Android, iOS, React Native Fabric, Flutter PlatformView, and Web SDK.
 */

import { runAllSuites, clearSuites } from '../harness/test-runner.ts';
import { registerTier1CrossMiniAppCoverageTests } from './tier1-cross-miniapp-coverage.spec.ts';
import { registerTier2CrossMiniAppBoundaryTests } from './tier2-boundary-corner.spec.ts';
import { registerTier3CrossMiniAppTests } from './tier3-cross-feature.spec.ts';
import { registerTier4CrossMiniAppScenarios } from './tier4-real-world-scenarios.spec.ts';

export async function runCrossMiniAppSuites() {
  console.log('================================================================================');
  console.log('🪟 [Goat WebView Task 10201] Cross-MiniApp Launch & Presentation 4-Tier E2E Test Suite');
  console.log('================================================================================\n');

  clearSuites();

  console.log('📦 Registering Tier 1: Feature Coverage (50 tests across 10 features)...');
  registerTier1CrossMiniAppCoverageTests();

  console.log('🛡️  Registering Tier 2: Boundary & Corner Cases (50 tests across 7 edge domains)...');
  registerTier2CrossMiniAppBoundaryTests();

  console.log('🔄 Registering Tier 3: Cross-Feature Interactions (6 complex pairwise scenarios)...');
  registerTier3CrossMiniAppTests();

  console.log('🌐 Registering Tier 4: Real-World SuperApp Workflows (4 full-lifecycle scenarios)...');
  registerTier4CrossMiniAppScenarios();

  console.log('\n🚀 Executing Task 10201 Cross-MiniApp Manager E2E Test Suites...\n');

  const summary = await runAllSuites();

  console.log('--------------------------------------------------------------------------------');
  console.log('📊 Task 10201 E2E Test Execution Summary:');
  console.log('--------------------------------------------------------------------------------');
  console.log(`Total Test Suites: ${summary.totalSuites}`);
  console.log(`Total Test Cases:  ${summary.totalTests}`);
  console.log(`Passed:            ${summary.totalPassed} ✅`);
  console.log(`Failed:            ${summary.totalFailed} ${summary.totalFailed > 0 ? '❌' : ''}`);
  console.log(`Total Duration:    ${summary.durationMs}ms`);
  console.log('--------------------------------------------------------------------------------\n');

  if (summary.totalFailed > 0) {
    console.error(`❌ [FAILED] ${summary.totalFailed} test(s) failed in Cross-MiniApp E2E Suite:`);
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

  console.log('🎉 [SUCCESS] 100% Task 10201 Cross-MiniApp Manager E2E Tests Passed!');
  return summary;
}

// Auto-run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runCrossMiniAppSuites().catch((err) => {
    console.error('Fatal error running Cross-MiniApp E2E suite:', err);
    process.exit(1);
  });
}
