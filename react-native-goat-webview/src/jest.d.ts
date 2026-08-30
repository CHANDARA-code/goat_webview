declare function describe(name: string, fn: () => void): void;
declare function test(name: string, fn: () => void | Promise<void>): void;
declare function beforeEach(fn: () => void | Promise<void>): void;
declare function expect(actual: any): {
  toEqual(expected: any): void;
  toBe(expected: any): void;
  toBeDefined(): void;
  toContain(expected: any): void;
  toThrow(expected?: string | RegExp): void;
  not: {
    toBe(expected: any): void;
    toEqual(expected: any): void;
    toContain(expected: any): void;
    toThrow(expected?: string | RegExp): void;
  };
  rejects: {
    toThrow(expected?: string | RegExp): Promise<void>;
  };
};

declare namespace jest {
  function fn(impl?: any): any;
}
