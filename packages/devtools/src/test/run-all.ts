#!/usr/bin/env node
/**
 * run-all.ts — Master E2E Test Suite Runner for Goat Mini-App DevTools Studio IDE
 * Executes all 4 Tiers (Tier 1: Feature Coverage, Tier 2: Boundary & Corner,
 * Tier 3: Cross-Feature Interactions, Tier 4: Real-World Applications).
 */

import { globalRunner } from './harness/test-runner.ts';
import { registerR1Tests } from './tier1-feature-coverage/r1-workspace-monaco.spec.ts';
import { registerR2Tests } from './tier1-feature-coverage/r2-simulator-dual-thread.spec.ts';
import { registerR3Tests } from './tier1-feature-coverage/r3-hardware-sensors.spec.ts';
import { registerR4Tests } from './tier1-feature-coverage/r4-multi-lane-debugger.spec.ts';
import { registerR5Tests } from './tier1-feature-coverage/r5-build-packaging-cli.spec.ts';
import { registerTier2Tests } from './tier2-boundary-corner/tier2-boundary-corner.spec.ts';
import { registerTier3Tests } from './tier3-cross-feature/tier3-cross-feature.spec.ts';
import { registerTier4Tests } from './tier4-real-world-scenarios/tier4-real-world-scenarios.spec.ts';

async function main() {
  // Register all tiers
  registerR1Tests();
  registerR2Tests();
  registerR3Tests();
  registerR4Tests();
  registerR5Tests();
  registerTier2Tests();
  registerTier3Tests();
  registerTier4Tests();

  // Run all test cases
  const results = await globalRunner.run();

  if (results.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal error running DevTools Studio test suite:', err);
  process.exit(1);
});
