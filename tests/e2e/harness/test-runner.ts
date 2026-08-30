/**
 * Goat WebView Wave 11 Master E2E Test Runner & Assertion Harness
 * Provides hermetic, zero-dependency test execution with rich assertions and structured telemetry.
 */

export interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  durationMs: number;
  error?: Error;
}

export interface SuiteSummary {
  name: string;
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  results: TestResult[];
}

export class ExpectationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExpectationError';
  }
}

class Expectation<T> {
  private actual: T;
  private isNot: boolean;

  constructor(actual: T, isNot = false) {
    this.actual = actual;
    this.isNot = isNot;
  }

  get not(): Expectation<T> {
    return new Expectation(this.actual, !this.isNot);
  }

  toBe(expected: any): void {
    const pass = Object.is(this.actual, expected);
    if (this.isNot ? pass : !pass) {
      throw new ExpectationError(
        `Expected ${JSON.stringify(this.actual)} ${this.isNot ? 'not to be' : 'to be'} ${JSON.stringify(expected)}`
      );
    }
  }

  toEqual(expected: any): void {
    const actualStr = JSON.stringify(this.actual);
    const expectedStr = JSON.stringify(expected);
    const pass = actualStr === expectedStr || this.deepEqual(this.actual, expected);
    if (this.isNot ? pass : !pass) {
      throw new ExpectationError(
        `Expected deep equality:\n  Actual:   ${actualStr}\n  Expected: ${expectedStr}`
      );
    }
  }

  toBeTruthy(): void {
    const pass = Boolean(this.actual);
    if (this.isNot ? pass : !pass) {
      throw new ExpectationError(`Expected ${JSON.stringify(this.actual)} ${this.isNot ? 'not to be truthy' : 'to be truthy'}`);
    }
  }

  toBeFalsy(): void {
    const pass = !Boolean(this.actual);
    if (this.isNot ? pass : !pass) {
      throw new ExpectationError(`Expected ${JSON.stringify(this.actual)} ${this.isNot ? 'not to be falsy' : 'to be falsy'}`);
    }
  }

  toBeNull(): void {
    const pass = this.actual === null;
    if (this.isNot ? pass : !pass) {
      throw new ExpectationError(`Expected ${JSON.stringify(this.actual)} ${this.isNot ? 'not to be null' : 'to be null'}`);
    }
  }

  toBeUndefined(): void {
    const pass = this.actual === undefined;
    if (this.isNot ? pass : !pass) {
      throw new ExpectationError(`Expected ${JSON.stringify(this.actual)} ${this.isNot ? 'not to be undefined' : 'to be undefined'}`);
    }
  }

  toBeDefined(): void {
    const pass = this.actual !== undefined;
    if (this.isNot ? pass : !pass) {
      throw new ExpectationError(`Expected value ${this.isNot ? 'to be undefined' : 'to be defined'}`);
    }
  }

  toContain(item: any): void {
    let pass = false;
    if (typeof this.actual === 'string') {
      pass = this.actual.includes(String(item));
    } else if (Array.isArray(this.actual)) {
      pass = this.actual.includes(item) || this.actual.some(x => JSON.stringify(x) === JSON.stringify(item));
    } else if (this.actual instanceof Set) {
      pass = this.actual.has(item);
    } else if (this.actual && typeof this.actual === 'object') {
      pass = item in (this.actual as Record<string, any>);
    }
    if (this.isNot ? pass : !pass) {
      throw new ExpectationError(
        `Expected ${JSON.stringify(this.actual)} ${this.isNot ? 'not to contain' : 'to contain'} ${JSON.stringify(item)}`
      );
    }
  }

  toBeGreaterThan(expected: number): void {
    const actualNum = Number(this.actual);
    const pass = actualNum > expected;
    if (this.isNot ? pass : !pass) {
      throw new ExpectationError(`Expected ${actualNum} ${this.isNot ? 'not to be greater than' : 'to be greater than'} ${expected}`);
    }
  }

  toBeGreaterThanOrEqual(expected: number): void {
    const actualNum = Number(this.actual);
    const pass = actualNum >= expected;
    if (this.isNot ? pass : !pass) {
      throw new ExpectationError(`Expected ${actualNum} ${this.isNot ? 'not to be >= ' : 'to be >= '} ${expected}`);
    }
  }

  toBeLessThan(expected: number): void {
    const actualNum = Number(this.actual);
    const pass = actualNum < expected;
    if (this.isNot ? pass : !pass) {
      throw new ExpectationError(`Expected ${actualNum} ${this.isNot ? 'not to be less than' : 'to be less than'} ${expected}`);
    }
  }

  toBeLessThanOrEqual(expected: number): void {
    const actualNum = Number(this.actual);
    const pass = actualNum <= expected;
    if (this.isNot ? pass : !pass) {
      throw new ExpectationError(`Expected ${actualNum} ${this.isNot ? 'not to be <= ' : 'to be <= '} ${expected}`);
    }
  }

  toBeCloseTo(expected: number, delta = 0.001): void {
    const actualNum = Number(this.actual);
    const pass = Math.abs(actualNum - expected) <= delta;
    if (this.isNot ? pass : !pass) {
      throw new ExpectationError(`Expected ${actualNum} to be within ${delta} of ${expected}`);
    }
  }

  toThrow(expectedSubstring?: string): void {
    if (typeof this.actual !== 'function') {
      throw new ExpectationError('toThrow expects a function');
    }
    let threw = false;
    let thrownError: any = null;
    try {
      (this.actual as Function)();
    } catch (e) {
      threw = true;
      thrownError = e;
    }
    if (this.isNot ? threw : !threw) {
      throw new ExpectationError(
        this.isNot ? `Expected function not to throw, but it threw: ${thrownError?.message}` : 'Expected function to throw'
      );
    }
    if (threw && expectedSubstring && thrownError) {
      const msg = thrownError.message || String(thrownError);
      if (!msg.includes(expectedSubstring)) {
        throw new ExpectationError(`Expected thrown error to contain "${expectedSubstring}", but got "${msg}"`);
      }
    }
  }

  async rejects(expectedSubstring?: string): Promise<void> {
    let threw = false;
    let thrownError: any = null;
    try {
      await (this.actual as Promise<any>);
    } catch (e) {
      threw = true;
      thrownError = e;
    }
    if (this.isNot ? threw : !threw) {
      throw new ExpectationError(
        this.isNot ? `Expected promise not to reject, but it rejected: ${thrownError?.message}` : 'Expected promise to reject'
      );
    }
    if (threw && expectedSubstring && thrownError) {
      const msg = thrownError.message || String(thrownError);
      if (!msg.includes(expectedSubstring)) {
        throw new ExpectationError(`Expected rejection error to contain "${expectedSubstring}", but got "${msg}"`);
      }
    }
  }

  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!this.deepEqual(a[key], b[key])) return false;
    }
    return true;
  }
}

export function expect<T>(actual: T): Expectation<T> {
  return new Expectation(actual);
}

type TestFn = () => void | Promise<void>;

interface TestCase {
  name: string;
  fn: TestFn;
}

interface TestSuite {
  name: string;
  tests: TestCase[];
}

const suites: TestSuite[] = [];
let currentSuite: TestSuite | null = null;

export function describe(name: string, fn: () => void): void {
  const previousSuite = currentSuite;
  currentSuite = { name, tests: [] };
  suites.push(currentSuite);
  try {
    fn();
  } finally {
    currentSuite = previousSuite;
  }
}

export function it(name: string, fn: TestFn): void {
  if (!currentSuite) {
    describe('Default Suite', () => {
      currentSuite!.tests.push({ name, fn });
    });
  } else {
    currentSuite.tests.push({ name, fn });
  }
}

export const test = it;

export async function runAllSuites(): Promise<{
  totalSuites: number;
  totalTests: number;
  totalPassed: number;
  totalFailed: number;
  durationMs: number;
  summaries: SuiteSummary[];
}> {
  const startTime = Date.now();
  const summaries: SuiteSummary[] = [];
  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;

  for (const suite of suites) {
    const suiteStartTime = Date.now();
    const results: TestResult[] = [];
    let passed = 0;
    let failed = 0;

    for (const t of suite.tests) {
      const testStart = Date.now();
      try {
        await t.fn();
        const durationMs = Date.now() - testStart;
        results.push({ suite: suite.name, name: t.name, passed: true, durationMs });
        passed++;
      } catch (err: any) {
        const durationMs = Date.now() - testStart;
        results.push({ suite: suite.name, name: t.name, passed: false, durationMs, error: err });
        failed++;
      }
    }

    const suiteDurationMs = Date.now() - suiteStartTime;
    summaries.push({
      name: suite.name,
      total: suite.tests.length,
      passed,
      failed,
      durationMs: suiteDurationMs,
      results,
    });

    totalTests += suite.tests.length;
    totalPassed += passed;
    totalFailed += failed;
  }

  const durationMs = Date.now() - startTime;
  return {
    totalSuites: suites.length,
    totalTests,
    totalPassed,
    totalFailed,
    durationMs,
    summaries,
  };
}

export function clearSuites(): void {
  suites.length = 0;
  currentSuite = null;
}
