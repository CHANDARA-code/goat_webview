/**
 * SuperApp Showcase Master 4-Tier E2E Test Suite Runner
 * Runs Tier 1 (Feature Coverage), Tier 2 (Boundary & Corner), Tier 3 (Cross-Feature),
 * and Tier 4 (Real-World Scenarios) across all 4 Domain Mini-Apps, 18 Bridge Domains,
 * and Floating Developer Debug HUD.
 */

import { runAllSuites, clearSuites } from '../harness/test-runner.ts';
import { registerTier1ShowcaseCoverageTests } from './tier1-showcase-coverage.spec.ts';
import { registerTier2ShowcaseBoundaryTests } from './tier2-boundary-corner.spec.ts';
import { registerTier3ShowcaseCrossFeatureTests } from './tier3-cross-feature.spec.ts';
import { registerTier4ShowcaseRealWorldTests } from './tier4-real-world-scenarios.spec.ts';

async function main() {
  console.log('================================================================================');
  console.log('🐐 [Goat WebView] SuperApp Showcase 4-Tier Opaque-Box E2E Test Suite');
  console.log('   (4 Domain Mini-Apps + 18 Bridge Domains + Floating Developer Debug HUD)');
  console.log('================================================================================\n');

  clearSuites();

  console.log('📦 Registering Tier 1: Showcase Feature Coverage Suites...');
  registerTier1ShowcaseCoverageTests();

  console.log('🛡️  Registering Tier 2: Showcase Boundary & Corner Cases Suites...');
  registerTier2ShowcaseBoundaryTests();

  console.log('🔄 Registering Tier 3: Showcase Cross-Feature Integration Suites...');
  registerTier3ShowcaseCrossFeatureTests();

  console.log('🌐 Registering Tier 4: Showcase Real-World Production Scenarios...');
  registerTier4ShowcaseRealWorldTests();

  console.log('\n🚀 Executing SuperApp Showcase Hermetic E2E Tests...\n');

  const summary = await runAllSuites();

  console.log('--------------------------------------------------------------------------------');
  console.log('📊 SuperApp Showcase E2E Test Execution Summary:');
  console.log('--------------------------------------------------------------------------------');
  console.log(`Total Test Suites: ${summary.totalSuites}`);
  console.log(`Total Test Cases:  ${summary.totalTests}`);
  console.log(`Passed:            ${summary.totalPassed} ✅`);
  console.log(`Failed:            ${summary.totalFailed} ${summary.totalFailed > 0 ? '❌' : ''}`);
  console.log(`Total Duration:    ${summary.durationMs}ms`);
  console.log('--------------------------------------------------------------------------------\n');

  if (summary.totalFailed > 0) {
    console.error(`❌ [FAILED] ${summary.totalFailed} test(s) failed in SuperApp Showcase Suite:`);
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

  console.log('🎉 [SUCCESS] 100% SuperApp Showcase E2E Tests Passed! Parity & HUD Verified.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error in SuperApp Showcase E2E Test Runner:', err);
  process.exit(1);
});
