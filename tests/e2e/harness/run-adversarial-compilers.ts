/**
 * Runner for Adversarial Compilers Verification Harness
 */
import { runAllSuites } from './test-runner.ts';
import './adversarial-compilers.spec.ts';

async function main() {
  console.log('===============================================================');
  console.log('🚀 Running Adversarial Verification on @goat/compiler-taro & @goat/compiler-uniapp');
  console.log('===============================================================\n');

  const summary = await runAllSuites();

  for (const s of summary.summaries) {
    console.log(`\n▶ ${s.name} (${s.durationMs}ms)`);
    for (const res of s.results) {
      if (res.passed) {
        console.log(`  ✔ ${res.name} (${res.durationMs}ms)`);
      } else {
        console.error(`  ✖ ${res.name} (${res.durationMs}ms)`);
        console.error(`    Error: ${res.error?.message}`);
        if (res.error?.stack) {
          console.error(`    ${res.error.stack.split('\n').slice(1, 4).join('\n    ')}`);
        }
      }
    }
  }

  console.log('\n===============================================================');
  console.log(`Total Suites: ${summary.totalSuites}`);
  console.log(`Total Tests:  ${summary.totalTests}`);
  console.log(`Passed:       ${summary.totalPassed}`);
  console.log(`Failed:       ${summary.totalFailed}`);
  console.log(`Duration:     ${summary.durationMs}ms`);
  console.log('===============================================================');

  if (summary.totalFailed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
