/**
 * test-runner.ts — Standalone Hermetic Test Runner & Assertion Framework
 * Zero external dependencies. Fast, deterministic, and colored ANSI output.
 */

export interface TestCase {
  suiteName: string;
  name: string;
  fn: () => void | Promise<void>;
  passed?: boolean;
  error?: Error;
  durationMs?: number;
}

export class TestRunner {
  private suites: { name: string; cases: TestCase[] }[] = [];
  private currentSuiteName: string = 'Default';

  describe(name: string, fn: () => void): void {
    const prevSuite = this.currentSuiteName;
    this.currentSuiteName = name;
    this.suites.push({ name, cases: [] });
    fn();
    this.currentSuiteName = prevSuite;
  }

  it(name: string, fn: () => void | Promise<void>): void {
    let suite = this.suites.find((s) => s.name === this.currentSuiteName);
    if (!suite) {
      suite = { name: this.currentSuiteName, cases: [] };
      this.suites.push(suite);
    }
    suite.cases.push({
      suiteName: this.currentSuiteName,
      name,
      fn,
    });
  }

  async run(): Promise<{ total: number; passed: number; failed: number; durationMs: number; suites: any[] }> {
    const startTime = Date.now();
    let total = 0;
    let passed = 0;
    let failed = 0;

    console.log('\n' + '='.repeat(80));
    console.log('🧪 [Goat DevTools Studio] Comprehensive 4-Tier E2E Test Suite');
    console.log('='.repeat(80) + '\n');

    for (const suite of this.suites) {
      console.log(`📦 \x1b[1m\x1b[34m${suite.name}\x1b[0m`);
      for (const tc of suite.cases) {
        total++;
        const testStart = performance.now();
        try {
          await tc.fn();
          tc.passed = true;
          tc.durationMs = Math.round((performance.now() - testStart) * 100) / 100;
          passed++;
          console.log(`  \x1b[32m✔\x1b[0m ${tc.name} \x1b[90m(${tc.durationMs}ms)\x1b[0m`);
        } catch (err: any) {
          tc.passed = false;
          tc.error = err;
          tc.durationMs = Math.round((performance.now() - testStart) * 100) / 100;
          failed++;
          console.log(`  \x1b[31m✖\x1b[0m ${tc.name} \x1b[90m(${tc.durationMs}ms)\x1b[0m`);
          console.log(`    \x1b[31mError: ${err.message || err}\x1b[0m`);
          if (err.stack) {
            const cleanStack = err.stack
              .split('\n')
              .slice(1, 4)
              .map((l: string) => `      \x1b[90m${l.trim()}\x1b[0m`)
              .join('\n');
            console.log(cleanStack);
          }
        }
      }
      console.log('');
    }

    const durationMs = Date.now() - startTime;
    console.log('='.repeat(80));
    if (failed === 0) {
      console.log(`\x1b[32m\x1b[1m🎉 ALL ${passed}/${total} TESTS PASSED (100%) in ${durationMs}ms\x1b[0m`);
    } else {
      console.log(`\x1b[31m\x1b[1m❌ ${failed}/${total} TESTS FAILED in ${durationMs}ms\x1b[0m`);
    }
    console.log('='.repeat(80) + '\n');

    return { total, passed, failed, durationMs, suites: this.suites };
  }
}

// Global default runner instance
export const globalRunner = new TestRunner();
export const describe = (name: string, fn: () => void) => globalRunner.describe(name, fn);
export const it = (name: string, fn: () => void | Promise<void>) => globalRunner.it(name, fn);

// Fluent assertion matchers
export function expect(actual: any) {
  return {
    toBe(expected: any) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(actual)} to be ${JSON.stringify(expected)}`);
      }
    },
    toEqual(expected: any) {
      const a = JSON.stringify(actual);
      const b = JSON.stringify(expected);
      if (a !== b) {
        throw new Error(`Expected ${a} to equal ${b}`);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected ${JSON.stringify(actual)} to be truthy`);
      }
    },
    toBeFalsy() {
      if (actual) {
        throw new Error(`Expected ${JSON.stringify(actual)} to be falsy`);
      }
    },
    toBeDefined() {
      if (actual === undefined) {
        throw new Error(`Expected value to be defined`);
      }
    },
    toBeUndefined() {
      if (actual !== undefined) {
        throw new Error(`Expected ${JSON.stringify(actual)} to be undefined`);
      }
    },
    toBeNull() {
      if (actual !== null) {
        throw new Error(`Expected ${JSON.stringify(actual)} to be null`);
      }
    },
    not: {
      toBe(expected: any) {
        if (actual === expected) {
          throw new Error(`Expected ${JSON.stringify(actual)} not to be ${JSON.stringify(expected)}`);
        }
      },
      toBeNull() {
        if (actual === null) {
          throw new Error(`Expected value not to be null`);
        }
      },
      toBeUndefined() {
        if (actual === undefined) {
          throw new Error(`Expected value not to be undefined`);
        }
      },
    },
    toBeGreaterThan(expected: number) {
      if (typeof actual !== 'number' || actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeLessThan(expected: number) {
      if (typeof actual !== 'number' || actual >= expected) {
        throw new Error(`Expected ${actual} to be less than ${expected}`);
      }
    },
    toBeGreaterThanOrEqual(expected: number) {
      if (typeof actual !== 'number' || actual < expected) {
        throw new Error(`Expected ${actual} to be >= ${expected}`);
      }
    },
    toBeLessThanOrEqual(expected: number) {
      if (typeof actual !== 'number' || actual > expected) {
        throw new Error(`Expected ${actual} to be <= ${expected}`);
      }
    },
    toContain(expected: any) {
      if (typeof actual === 'string') {
        if (!actual.includes(expected)) {
          throw new Error(`Expected string to contain '${expected}'`);
        }
      } else if (Array.isArray(actual)) {
        if (!actual.includes(expected)) {
          throw new Error(`Expected array to contain ${JSON.stringify(expected)}`);
        }
      } else if (actual && typeof actual === 'object') {
        if (!(expected in actual)) {
          throw new Error(`Expected object to have key '${expected}'`);
        }
      } else {
        throw new Error(`Cannot check toContain on ${typeof actual}`);
      }
    },
    toHaveLength(expected: number) {
      if (!actual || typeof actual.length !== 'number' || actual.length !== expected) {
        throw new Error(`Expected length to be ${expected}, got ${actual?.length}`);
      }
    },
    toThrow(expectedMessageSnippet?: string) {
      if (typeof actual !== 'function') {
        throw new Error(`Expected function for toThrow`);
      }
      let threw = false;
      let thrownError: any = null;
      try {
        actual();
      } catch (e: any) {
        threw = true;
        thrownError = e;
      }
      if (!threw) {
        throw new Error(`Expected function to throw an error, but it returned cleanly.`);
      }
      if (expectedMessageSnippet && !thrownError?.message?.includes(expectedMessageSnippet)) {
        throw new Error(`Expected error message to include '${expectedMessageSnippet}', got '${thrownError?.message}'`);
      }
    },
  };
}
