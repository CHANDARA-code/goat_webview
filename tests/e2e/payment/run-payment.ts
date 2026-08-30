/**
 * Goat WebView Task 10206 Payment Gateway Proxy & Security Gate Master E2E Test Runner
 *
 * Executes 4-Tier Opaque-Box Verification Suite for:
 * - Task 10206: Adaptable Payment Gateway Proxy & Secure Provider Adapter SPI
 *   Tiers 1-4 across Android, iOS, React Native, and Flutter.
 */

import { runAllSuites, clearSuites } from '../harness/test-runner.ts';
import { registerTier1PaymentCoverageTests } from './tier1-payment-coverage.spec.ts';
import { registerTier2BoundaryCornerTests } from './tier2-boundary-corner.spec.ts';
import { registerTier3CrossFeatureTests } from './tier3-cross-feature.spec.ts';
import { registerTier4RealWorldScenariosTests } from './tier4-real-world-scenarios.spec.ts';

export async function runPaymentSuites() {
  console.log('================================================================================');
  console.log('💳 [Goat WebView Task 10206] Payment Gateway Proxy 4-Tier E2E Test Suite');
  console.log('================================================================================\n');

  clearSuites();

  console.log('📦 Registering Tier 1: Feature Coverage (F1-F12)...');
  registerTier1PaymentCoverageTests();

  console.log('🛡️  Registering Tier 2: Boundary & Corner Cases...');
  registerTier2BoundaryCornerTests();

  console.log('🔄 Registering Tier 3: Cross-Feature Interactions...');
  registerTier3CrossFeatureTests();

  console.log('🌐 Registering Tier 4: Real-World SuperApp Workflows...');
  registerTier4RealWorldScenariosTests();

  console.log('\n🚀 Executing Task 10206 Payment Gateway E2E Test Suites...\n');

  const summary = await runAllSuites();

  console.log('--------------------------------------------------------------------------------');
  console.log('📊 Task 10206 E2E Test Execution Summary:');
  console.log('--------------------------------------------------------------------------------');
  console.log(`Total Test Suites: ${summary.totalSuites}`);
  console.log(`Total Test Cases:  ${summary.totalTests}`);
  console.log(`Passed:            ${summary.totalPassed} ✅`);
  console.log(`Failed:            ${summary.totalFailed} ${summary.totalFailed > 0 ? '❌' : ''}`);
  console.log(`Total Duration:    ${summary.durationMs}ms`);
  console.log('--------------------------------------------------------------------------------\n');

  if (summary.totalFailed > 0) {
    console.error(`❌ [FAILED] ${summary.totalFailed} test(s) failed in Payment Gateway E2E Suite:`);
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

  console.log('🎉 [Goat WebView Task 10206] 100% Payment Gateway Proxy E2E Suite Passed!');
  return summary;
}

// Auto-run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runPaymentSuites().catch((err) => {
    console.error('Fatal error running Payment Gateway E2E suite:', err);
    process.exit(1);
  });
}
