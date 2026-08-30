/**
 * Goat WebView Task 10200 Event Coalescing Master E2E Test Runner
 *
 * Executes 4-Tier Opaque-Box Verification Suite for:
 * - Task 10200: Generic Bridge Event Coalescing & Trailing-Edge Throttling (GoatEventCoalescer)
 */

import { runAllSuites, clearSuites } from '../harness/test-runner.ts';
import { registerCoalescerTier1CoverageTests } from './tier1-coalescer-coverage.spec.ts';
import { registerCoalescerTier2BoundaryTests } from './tier2-boundary-corner.spec.ts';
import { registerCoalescerTier3CrossFeatureTests } from './tier3-cross-feature.spec.ts';
import { registerCoalescerTier4RealWorldScenariosTests } from './tier4-real-world-scenarios.spec.ts';

export async function runCoalescerSuites() {
  console.log('================================================================================');
  console.log('⚡ [Goat WebView Task 10200] Event Coalescer 4-Tier E2E Test Suite');
  console.log('================================================================================\n');

  clearSuites();

  console.log('📦 Registering Tier 1: Feature Coverage (35 tests across 7 features)...');
  registerCoalescerTier1CoverageTests();

  console.log('🛡️  Registering Tier 2: Boundary & Corner Cases (35 tests across 7 features)...');
  registerCoalescerTier2BoundaryTests();

  console.log('🔄 Registering Tier 3: Cross-Feature Interactions (8 complex scenarios)...');
  registerCoalescerTier3CrossFeatureTests();

  console.log('🌐 Registering Tier 4: Real-World SuperApp Workflows (4 full-lifecycle scenarios)...');
  registerCoalescerTier4RealWorldScenariosTests();

  console.log('\n🚀 Executing Task 10200 Event Coalescer E2E Test Suites...\n');

  const summary = await runAllSuites();

  console.log('--------------------------------------------------------------------------------');
  console.log('📊 Task 10200 E2E Test Execution Summary:');
  console.log('--------------------------------------------------------------------------------');
  console.log(`Total Test Suites: ${summary.totalSuites}`);
  console.log(`Total Test Cases:  ${summary.totalTests}`);
  console.log(`Passed:            ${summary.totalPassed} ✅`);
  console.log(`Failed:            ${summary.totalFailed} ${summary.totalFailed > 0 ? '❌' : ''}`);
  console.log(`Total Duration:    ${summary.durationMs}ms`);
  console.log('--------------------------------------------------------------------------------\n');

  if (summary.totalFailed > 0) {
    console.error(`❌ [FAILED] ${summary.totalFailed} test(s) failed in Coalescer E2E Suite:`);
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

  console.log('🎉 [SUCCESS] 100% Task 10200 Event Coalescer E2E Tests Passed!');
  return summary;
}

// Auto-run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runCoalescerSuites().catch((err) => {
    console.error('Fatal error running Coalescer E2E suite:', err);
    process.exit(1);
  });
}
