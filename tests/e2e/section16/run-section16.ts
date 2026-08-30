/**
 * Goat WebView Section 16 Security & Networking Master E2E Test Runner
 *
 * Executes 4-Tier Verification Suite for:
 * - Task 10204: HTTP Basic/Digest Auth Challenge Handling & Credential Persistence
 * - Task 10205: Declarative Content-Blocker Allowlist Enforcement
 */

import { runAllSuites, clearSuites } from '../harness/test-runner.ts';
import { registerSection16Tier1CoverageTests } from './tier1-section16-coverage.spec.ts';
import { registerSection16Tier2BoundaryTests } from './tier2-boundary-corner.spec.ts';
import { registerSection16Tier3CrossFeatureTests } from './tier3-cross-feature.spec.ts';
import { registerSection16Tier4RealWorldScenariosTests } from './tier4-real-world-scenarios.spec.ts';

export async function runSection16Suites() {
  console.log('================================================================================');
  console.log('🔒 [Goat WebView Section 16] Security & Networking 4-Tier E2E Test Suite');
  console.log('================================================================================\n');

  clearSuites();

  console.log('📦 Registering Tier 1: Feature Coverage (80 tests across 16 features)...');
  registerSection16Tier1CoverageTests();

  console.log('🛡️  Registering Tier 2: Boundary & Corner Cases (80 tests across 16 features)...');
  registerSection16Tier2BoundaryTests();

  console.log('🔄 Registering Tier 3: Cross-Feature Interactions (8 complex scenarios)...');
  registerSection16Tier3CrossFeatureTests();

  console.log('🌐 Registering Tier 4: Real-World SuperApp Workflows (4 full-lifecycle scenarios)...');
  registerSection16Tier4RealWorldScenariosTests();

  console.log('\n🚀 Executing Section 16 E2E Test Suites...\n');

  const summary = await runAllSuites();

  console.log('--------------------------------------------------------------------------------');
  console.log('📊 Section 16 E2E Test Execution Summary:');
  console.log('--------------------------------------------------------------------------------');
  console.log(`Total Test Suites: ${summary.totalSuites}`);
  console.log(`Total Test Cases:  ${summary.totalTests}`);
  console.log(`Passed:            ${summary.totalPassed} ✅`);
  console.log(`Failed:            ${summary.totalFailed} ${summary.totalFailed > 0 ? '❌' : ''}`);
  console.log(`Total Duration:    ${summary.durationMs}ms`);
  console.log('--------------------------------------------------------------------------------\n');

  if (summary.totalFailed > 0) {
    console.error(`❌ [FAILED] ${summary.totalFailed} test(s) failed in Section 16 E2E Suite:`);
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

  console.log('🎉 [SUCCESS] 100% Section 16 Security & Networking E2E Tests Passed!');
  return summary;
}

// Auto-run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSection16Suites().catch((err) => {
    console.error('Fatal error running Section 16 E2E suite:', err);
    process.exit(1);
  });
}
