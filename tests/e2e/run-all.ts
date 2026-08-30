/**
 * Goat WebView Wave 11 Master E2E Test Suite Entrypoint
 * Executes all 4 Tiers (Tier 1: Feature Coverage, Tier 2: Boundary/Corner,
 * Tier 3: Pairwise Combinations, Tier 4: Real-World Scenarios).
 */

import { runAllSuites, clearSuites } from './harness/test-runner.ts';
import { registerTier1R1AndroidSpiTests } from './tier1-feature-coverage/tier1-r1-android-spi.spec.ts';
import { registerTier1R2IOSBridgeTests } from './tier1-feature-coverage/tier1-r2-ios-bridge.spec.ts';
import { registerTier1R3Phase5DemockTests } from './tier1-feature-coverage/tier1-r3-phase5-demock.spec.ts';
import { registerTier1R4FlutterChannelTests } from './tier1-feature-coverage/tier1-r4-flutter-channel.spec.ts';
import { registerTier1R5SecurityHardeningTests } from './tier1-feature-coverage/tier1-r5-security-hardening.spec.ts';
import { registerTier1R6ReactNativeTests } from './tier1-feature-coverage/tier1-r6-react-native.spec.ts';
import { registerTier1R7GatesAndInfraTests } from './tier1-feature-coverage/tier1-r7-gates-and-infra.spec.ts';
import { registerTier2BoundaryTests } from './tier2-boundary-corner/tier2-boundary-corner.spec.ts';
import { registerTier3CrossFeatureTests } from './tier3-cross-feature/tier3-cross-feature.spec.ts';
import { registerTier4RealWorldScenariosTests } from './tier4-real-world-scenarios/tier4-real-world-scenarios.spec.ts';

// Section 16: Security & Networking (HTTP Auth Task 10204 & Declarative Content-Blocker Task 10205)
import { registerSection16Tier1CoverageTests } from './section16/tier1-section16-coverage.spec.ts';
import { registerSection16Tier2BoundaryTests } from './section16/tier2-boundary-corner.spec.ts';
import { registerSection16Tier3CrossFeatureTests } from './section16/tier3-cross-feature.spec.ts';
import { registerSection16Tier4RealWorldScenariosTests } from './section16/tier4-real-world-scenarios.spec.ts';

// Task 10200: Event Coalescer & High-Frequency Throttling
import { registerCoalescerTier1CoverageTests } from './coalescer/tier1-coalescer-coverage.spec.ts';
import { registerCoalescerTier2BoundaryTests } from './coalescer/tier2-boundary-corner.spec.ts';
import { registerCoalescerTier3CrossFeatureTests } from './coalescer/tier3-cross-feature.spec.ts';
import { registerCoalescerTier4RealWorldScenariosTests } from './coalescer/tier4-real-world-scenarios.spec.ts';

// Task 10183: Popup Window Open & Target _Blank Modal/Browser Handler (GoatPopupManager)
import { registerTier1PopupCoverageTests } from './popup/tier1-popup-coverage.spec.ts';
import { registerTier2BoundaryCornerTests } from './popup/tier2-boundary-corner.spec.ts';
import { registerTier3CrossFeatureTests as registerPopupTier3CrossFeatureTests } from './popup/tier3-cross-feature.spec.ts';
import { registerTier4RealWorldScenariosTests as registerPopupTier4RealWorldScenariosTests } from './popup/tier4-real-world-scenarios.spec.ts';

// Task 10206: Adaptable Payment Gateway Proxy & Secure Provider Adapter SPI
import { registerTier1PaymentCoverageTests } from './payment/tier1-payment-coverage.spec.ts';
import { registerTier2BoundaryCornerTests as registerPaymentTier2BoundaryCornerTests } from './payment/tier2-boundary-corner.spec.ts';
import { registerTier3CrossFeatureTests as registerPaymentTier3CrossFeatureTests } from './payment/tier3-cross-feature.spec.ts';
import { registerTier4RealWorldScenariosTests as registerPaymentTier4RealWorldScenariosTests } from './payment/tier4-real-world-scenarios.spec.ts';

// Task 10201: Cross-MiniApp Launch & Windowed Presentation Bridge (GoatCrossMiniAppManager)
import { registerTier1CrossMiniAppCoverageTests } from './cross-miniapp/tier1-cross-miniapp-coverage.spec.ts';
import { registerTier2CrossMiniAppBoundaryTests } from './cross-miniapp/tier2-boundary-corner.spec.ts';
import { registerTier3CrossMiniAppTests } from './cross-miniapp/tier3-cross-feature.spec.ts';
import { registerTier4CrossMiniAppScenarios } from './cross-miniapp/tier4-real-world-scenarios.spec.ts';

// SuperApp Showcase (4 Domain Mini-Apps + 18 Bridge Domains + Developer Debug HUD)
import { registerTier1ShowcaseCoverageTests } from './showcase/tier1-showcase-coverage.spec.ts';
import { registerTier2ShowcaseBoundaryTests } from './showcase/tier2-boundary-corner.spec.ts';
import { registerTier3ShowcaseCrossFeatureTests } from './showcase/tier3-cross-feature.spec.ts';
import { registerTier4ShowcaseRealWorldTests } from './showcase/tier4-real-world-scenarios.spec.ts';

async function main() {
  console.log('================================================================================');
  console.log('🐐 [Goat WebView] Master 4-Tier Opaque-Box E2E Test Suite');
  console.log('   (Foundational Engine + Section 16 + Task 10200 Coalescer + Task 10183 Popup + Task 10206 Payments + Task 10201 Cross-MiniApp + SuperApp Showcase)');
  console.log('================================================================================\n');

  clearSuites();

  // Tier 1: Feature Coverage (Category-Partition)
  console.log('📦 Registering Tier 1: Feature Coverage Suites...');
  registerTier1R1AndroidSpiTests();
  registerTier1R2IOSBridgeTests();
  registerTier1R3Phase5DemockTests();
  registerTier1R4FlutterChannelTests();
  registerTier1R5SecurityHardeningTests();
  registerTier1R6ReactNativeTests();
  registerTier1R7GatesAndInfraTests();
  registerSection16Tier1CoverageTests();
  registerCoalescerTier1CoverageTests();
  registerTier1PopupCoverageTests();
  registerTier1PaymentCoverageTests();
  registerTier1CrossMiniAppCoverageTests();
  registerTier1ShowcaseCoverageTests();

  // Tier 2: Boundary & Corner Cases (BVA)
  console.log('🛡️  Registering Tier 2: Boundary & Corner Cases Suites...');
  registerTier2BoundaryTests();
  registerSection16Tier2BoundaryTests();
  registerCoalescerTier2BoundaryTests();
  registerTier2BoundaryCornerTests();
  registerPaymentTier2BoundaryCornerTests();
  registerTier2CrossMiniAppBoundaryTests();
  registerTier2ShowcaseBoundaryTests();

  // Tier 3: Cross-Feature Interactions (Pairwise Combinatorial)
  console.log('🔄 Registering Tier 3: Cross-Feature & Pairwise Integration Suites...');
  registerTier3CrossFeatureTests();
  registerSection16Tier3CrossFeatureTests();
  registerCoalescerTier3CrossFeatureTests();
  registerPopupTier3CrossFeatureTests();
  registerPaymentTier3CrossFeatureTests();
  registerTier3CrossMiniAppTests();
  registerTier3ShowcaseCrossFeatureTests();

  // Tier 4: Real-World SuperApp Workflows
  console.log('🌐 Registering Tier 4: Real-World SuperApp Production Scenarios...');
  registerTier4RealWorldScenariosTests();
  registerSection16Tier4RealWorldScenariosTests();
  registerCoalescerTier4RealWorldScenariosTests();
  registerPopupTier4RealWorldScenariosTests();
  registerPaymentTier4RealWorldScenariosTests();
  registerTier4CrossMiniAppScenarios();
  registerTier4ShowcaseRealWorldTests();

  console.log('\n🚀 Executing Hermetic E2E Tests...\n');

  const summary = await runAllSuites();

  console.log('--------------------------------------------------------------------------------');
  console.log('📊 Master E2E Test Execution Summary:');
  console.log('--------------------------------------------------------------------------------');
  console.log(`Total Test Suites: ${summary.totalSuites}`);
  console.log(`Total Test Cases:  ${summary.totalTests}`);
  console.log(`Passed:            ${summary.totalPassed} ✅`);
  console.log(`Failed:            ${summary.totalFailed} ${summary.totalFailed > 0 ? '❌' : ''}`);
  console.log(`Total Duration:    ${summary.durationMs}ms`);
  console.log('--------------------------------------------------------------------------------\n');

  if (summary.totalFailed > 0) {
    console.error(`❌ [FAILED] ${summary.totalFailed} test(s) failed in Master E2E Suite:`);
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

  console.log('🎉 [SUCCESS] 100% Master E2E Tests Passed! Wave 11 Feature Suite Verified.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error in Master E2E Test Runner:', err);
  process.exit(1);
});
