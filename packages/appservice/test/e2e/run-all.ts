/**
 * Master E2E & Multi-Tier Test Runner for @goat/appservice
 */

import { runRegistrySuites } from './harness/test-runner.ts';

// Import Tier 1 Feature Coverage specs
import './tier1-feature-coverage/f01-worker-runtime.spec.ts';
import './tier1-feature-coverage/f02-bridge-proxy.spec.ts';
import './tier1-feature-coverage/f03-lifecycle.spec.ts';
import './tier1-feature-coverage/f04-vdom-diff-patch.spec.ts';
import './tier1-feature-coverage/f05-ipc-batching.spec.ts';
import './tier1-feature-coverage/f06-appview-renderer.spec.ts';
import './tier1-feature-coverage/f07-android-host.spec.ts';
import './tier1-feature-coverage/f08-ios-host.spec.ts';
import './tier1-feature-coverage/f09-crossplatform-bindings.spec.ts';
import './tier1-feature-coverage/f10-telemetry-observability.spec.ts';
import './tier1-feature-coverage/f11-hermetic-mock.spec.ts';
import './tier1-feature-coverage/f12-quality-gates.spec.ts';

// Import Advanced Tiers
import './tier2-boundary-corner/tier2-boundary-corner.spec.ts';
import './tier3-pairwise-combinations/tier3-pairwise-combinations.spec.ts';
import './tier4-real-world-scenarios/tier4-real-world-scenarios.spec.ts';
import './tier5-adversarial-hardening/tier5-adversarial.spec.ts';

console.log('🚀 Running @goat/appservice Multi-Tier E2E Suites...\n');

const report = await runRegistrySuites(false);

console.log('\n===============================================================');
console.log(`📋 Test Execution Summary: ${report.totalSuites} Suites, ${report.totalTests} Tests`);
console.log(`   Passed: ${report.totalPassed} | Failed: ${report.totalFailed} | Duration: ${report.totalDurationMs}ms`);
console.log('===============================================================\n');

if (!report.success) {
  console.error('❌ E2E Multi-Tier Tests Failed!');
  process.exit(1);
} else {
  console.log('🎉 All Multi-Tier E2E Test Suites Passed 100%!\n');
  process.exit(0);
}
