/**
 * Goat WebView Standalone E2E Test Runner & Assertion Library
 * Zero external dependencies, pure Node.js / TypeScript compatible.
 */

export interface TestCaseResult {
  title: string;
  fullTitle: string;
  passed: boolean;
  durationMs: number;
  error?: Error;
}

export interface TestSuiteResult {
  name: string;
  passed: boolean;
  total: number;
  passedCount: number;
  failedCount: number;
  durationMs: number;
  cases: TestCaseResult[];
}

export interface GlobalTestReport {
  timestamp: string;
  totalSuites: number;
  totalTests: number;
  totalPassed: number;
  totalFailed: number;
  totalDurationMs: number;
  suites: TestSuiteResult[];
  success: boolean;
}

class Expectation<T = unknown> {
  private actual: T;
  private isNot: boolean;

  constructor(actual: T, isNot: boolean = false) {
    this.actual = actual;
    this.isNot = isNot;
  }

  get not(): Expectation<T> {
    return new Expectation(this.actual, !this.isNot);
  }

  toBe(expected: unknown): void {
    const pass = Object.is(this.actual, expected);
    if (this.isNot ? pass : !pass) {
      throw new Error(
        `Assertion Error: expected ${JSON.stringify(this.actual)} ${
          this.isNot ? 'not to be' : 'to be'
        } ${JSON.stringify(expected)}`
      );
    }
  }

  toEqual(expected: unknown): void {
    const actualJson = JSON.stringify(this.actual);
    const expectedJson = JSON.stringify(expected);
    const pass = actualJson === expectedJson;
    if (this.isNot ? pass : !pass) {
      throw new Error(
        `Assertion Error: expected ${actualJson} ${
          this.isNot ? 'not to equal' : 'to equal'
        } ${expectedJson}`
      );
    }
  }

  toBeDefined(): void {
    const pass = this.actual !== undefined;
    if (this.isNot ? pass : !pass) {
      throw new Error(
        `Assertion Error: expected value ${
          this.isNot ? 'to be undefined' : 'to be defined'
        }, but got ${this.actual}`
      );
    }
  }

  toBeUndefined(): void {
    const pass = this.actual === undefined;
    if (this.isNot ? pass : !pass) {
      throw new Error(
        `Assertion Error: expected value ${
          this.isNot ? 'not to be undefined' : 'to be undefined'
        }, but got ${this.actual}`
      );
    }
  }

  toBeNull(): void {
    const pass = this.actual === null;
    if (this.isNot ? pass : !pass) {
      throw new Error(
        `Assertion Error: expected value ${
          this.isNot ? 'not to be null' : 'to be null'
        }, but got ${this.actual}`
      );
    }
  }

  toBeTruthy(): void {
    const pass = Boolean(this.actual);
    if (this.isNot ? pass : !pass) {
      throw new Error(
        `Assertion Error: expected ${this.actual} ${
          this.isNot ? 'to be falsy' : 'to be truthy'
        }`
      );
    }
  }

  toBeFalsy(): void {
    const pass = !this.actual;
    if (this.isNot ? pass : !pass) {
      throw new Error(
        `Assertion Error: expected ${this.actual} ${
          this.isNot ? 'to be truthy' : 'to be falsy'
        }`
      );
    }
  }

  toBeGreaterThan(expected: number): void {
    const pass = (this.actual as number) > expected;
    if (this.isNot ? pass : !pass) {
      throw new Error(
        `Assertion Error: expected ${this.actual} ${
          this.isNot ? 'not to be greater than' : 'to be greater than'
        } ${expected}`
      );
    }
  }

  toBeGreaterThanOrEqual(expected: number): void {
    const pass = (this.actual as number) >= expected;
    if (this.isNot ? pass : !pass) {
      throw new Error(
        `Assertion Error: expected ${this.actual} ${
          this.isNot ? 'not to be greater than or equal to' : 'to be greater than or equal to'
        } ${expected}`
      );
    }
  }

  toBeLessThan(expected: number): void {
    const pass = (this.actual as number) < expected;
    if (this.isNot ? pass : !pass) {
      throw new Error(
        `Assertion Error: expected ${this.actual} ${
          this.isNot ? 'not to be less than' : 'to be less than'
        } ${expected}`
      );
    }
  }

  toBeLessThanOrEqual(expected: number): void {
    const pass = (this.actual as number) <= expected;
    if (this.isNot ? pass : !pass) {
      throw new Error(
        `Assertion Error: expected ${this.actual} ${
          this.isNot ? 'not to be less than or equal to' : 'to be less than or equal to'
        } ${expected}`
      );
    }
  }

  toBeCloseTo(expected: number, delta: number = 0.01): void {
    const pass = Math.abs((this.actual as number) - expected) <= delta;
    if (this.isNot ? pass : !pass) {
      throw new Error(
        `Assertion Error: expected ${this.actual} ${
          this.isNot ? 'not to be close to' : 'to be close to'
        } ${expected} (delta: ${delta})`
      );
    }
  }

  toContain(expected: unknown): void {
    let pass = false;
    if (typeof this.actual === 'string') {
      pass = this.actual.includes(String(expected));
    } else if (Array.isArray(this.actual)) {
      pass = this.actual.includes(expected);
    }
    if (this.isNot ? pass : !pass) {
      throw new Error(
        `Assertion Error: expected ${JSON.stringify(this.actual)} ${
          this.isNot ? 'not to contain' : 'to contain'
        } ${JSON.stringify(expected)}`
      );
    }
  }

  toHaveLength(expected: number): void {
    const length = (this.actual as { length?: number })?.length;
    const pass = length === expected;
    if (this.isNot ? pass : !pass) {
      throw new Error(
        `Assertion Error: expected length ${
          this.isNot ? 'not to be' : 'to be'
        } ${expected}, but got ${length}`
      );
    }
  }

  toThrow(expectedMessagePattern?: string | RegExp): void {
    if (typeof this.actual !== 'function') {
      throw new Error('Assertion Error: toThrow requires a function');
    }
    let threw = false;
    let thrownError: unknown;
    try {
      (this.actual as () => unknown)();
    } catch (err) {
      threw = true;
      thrownError = err;
    }

    if (this.isNot ? threw : !threw) {
      throw new Error(
        `Assertion Error: expected function ${
          this.isNot ? 'not to throw' : 'to throw an error'
        }`
      );
    }

    if (threw && expectedMessagePattern) {
      const msg = thrownError instanceof Error ? thrownError.message : String(thrownError);
      if (typeof expectedMessagePattern === 'string') {
        if (!msg.includes(expectedMessagePattern)) {
          throw new Error(
            `Assertion Error: expected error message to include "${expectedMessagePattern}", but got "${msg}"`
          );
        }
      } else if (expectedMessagePattern instanceof RegExp) {
        if (!expectedMessagePattern.test(msg)) {
          throw new Error(
            `Assertion Error: expected error message to match ${expectedMessagePattern}, but got "${msg}"`
          );
        }
      }
    }
  }
}

export function expect<T>(actual: T): Expectation<T> {
  return new Expectation(actual);
}

export type TestFn = () => void | Promise<void>;
export type HookFn = () => void | Promise<void>;

interface TestDef {
  title: string;
  fn: TestFn;
}

interface SuiteDef {
  name: string;
  tests: TestDef[];
  beforeEachHooks: HookFn[];
  afterEachHooks: HookFn[];
  beforeAllHooks: HookFn[];
  afterAllHooks: HookFn[];
}

class TestRegistry {
  private currentSuite: SuiteDef | null = null;
  public suites: SuiteDef[] = [];

  describe(name: string, fn: () => void): void {
    const parentSuite = this.currentSuite;
    const suite: SuiteDef = {
      name: parentSuite ? `${parentSuite.name} > ${name}` : name,
      tests: [],
      beforeEachHooks: parentSuite ? [...parentSuite.beforeEachHooks] : [],
      afterEachHooks: parentSuite ? [...parentSuite.afterEachHooks] : [],
      beforeAllHooks: [],
      afterAllHooks: [],
    };
    this.currentSuite = suite;
    this.suites.push(suite);
    fn();
    this.currentSuite = parentSuite;
  }

  it(title: string, fn: TestFn): void {
    if (!this.currentSuite) {
      this.describe('Default Suite', () => {
        this.currentSuite!.tests.push({ title, fn });
      });
    } else {
      this.currentSuite.tests.push({ title, fn });
    }
  }

  beforeEach(fn: HookFn): void {
    if (this.currentSuite) {
      this.currentSuite.beforeEachHooks.push(fn);
    }
  }

  afterEach(fn: HookFn): void {
    if (this.currentSuite) {
      this.currentSuite.afterEachHooks.push(fn);
    }
  }

  beforeAll(fn: HookFn): void {
    if (this.currentSuite) {
      this.currentSuite.beforeAllHooks.push(fn);
    }
  }

  afterAll(fn: HookFn): void {
    if (this.currentSuite) {
      this.currentSuite.afterAllHooks.push(fn);
    }
  }

  clear(): void {
    this.suites = [];
    this.currentSuite = null;
  }
}

export const registry = new TestRegistry();

export function describe(name: string, fn: () => void): void {
  registry.describe(name, fn);
}

export function it(title: string, fn: TestFn): void {
  registry.it(title, fn);
}

export function beforeEach(fn: HookFn): void {
  registry.beforeEach(fn);
}

export function afterEach(fn: HookFn): void {
  registry.afterEach(fn);
}

export function beforeAll(fn: HookFn): void {
  registry.beforeAll(fn);
}

export function afterAll(fn: HookFn): void {
  registry.afterAll(fn);
}

export async function runRegistrySuites(silent: boolean = false): Promise<GlobalTestReport> {
  const startTime = Date.now();
  const suiteResults: TestSuiteResult[] = [];
  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;

  for (const suite of registry.suites) {
    const suiteStartTime = Date.now();
    const caseResults: TestCaseResult[] = [];

    // Run beforeAll hooks
    for (const hook of suite.beforeAllHooks) {
      await hook();
    }

    for (const test of suite.tests) {
      totalTests++;
      const fullTitle = `${suite.name} > ${test.title}`;
      const caseStartTime = Date.now();
      let passed = true;
      let error: Error | undefined;

      try {
        // Run beforeEach hooks
        for (const hook of suite.beforeEachHooks) {
          await hook();
        }

        // Run the test
        await test.fn();

        // Run afterEach hooks
        for (const hook of suite.afterEachHooks) {
          await hook();
        }
      } catch (err) {
        passed = false;
        error = err instanceof Error ? err : new Error(String(err));
      }

      const caseDuration = Date.now() - caseStartTime;
      if (passed) {
        totalPassed++;
        if (!silent) {
          console.log(`  \x1b[32m✔\x1b[0m ${test.title} \x1b[90m(${caseDuration}ms)\x1b[0m`);
        }
      } else {
        totalFailed++;
        if (!silent) {
          console.error(`  \x1b[31m✖\x1b[0m ${test.title} \x1b[90m(${caseDuration}ms)\x1b[0m`);
          console.error(`    \x1b[31m${error?.stack || error?.message}\x1b[0m`);
        }
      }

      caseResults.push({
        title: test.title,
        fullTitle,
        passed,
        durationMs: caseDuration,
        error,
      });
    }

    // Run afterAll hooks
    for (const hook of suite.afterAllHooks) {
      await hook();
    }

    const suiteDuration = Date.now() - suiteStartTime;
    const suitePassed = caseResults.every((c) => c.passed);

    suiteResults.push({
      name: suite.name,
      passed: suitePassed,
      total: caseResults.length,
      passedCount: caseResults.filter((c) => c.passed).length,
      failedCount: caseResults.filter((c) => !c.passed).length,
      durationMs: suiteDuration,
      cases: caseResults,
    });
  }

  const totalDurationMs = Date.now() - startTime;
  const report: GlobalTestReport = {
    timestamp: new Date().toISOString(),
    totalSuites: suiteResults.length,
    totalTests,
    totalPassed,
    totalFailed,
    totalDurationMs,
    suites: suiteResults,
    success: totalFailed === 0,
  };

  return report;
}
