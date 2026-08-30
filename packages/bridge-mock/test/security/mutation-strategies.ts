/**
 * Reusable Mutation Pools & Adversarial Vector Generators for IPC Bridge Fuzzing
 */

export interface MutationEntry {
  name: string;
  category: MutationCategory;
  payload: any;
}

export type MutationCategory =
  | 'primitive_type_confusion'
  | 'numeric_boundary'
  | 'string_extremes'
  | 'path_traversal'
  | 'ssrf_network'
  | 'prototype_pollution'
  | 'deep_nesting'
  | 'malformed_data'
  | 'schema_permutation'
  | 'action_specific';

/** Global primitive type confusion pool */
export const PRIMITIVE_TYPE_MUTATIONS: any[] = [
  null,
  undefined,
  true,
  false,
  0,
  1,
  -1,
  42,
  3.14159,
  '',
  '   ',
  'invalid_string_fuzz_token',
  [],
  [1, 'two', null, true],
  {},
  NaN,
  Infinity,
  -Infinity,
];

/** Boundary numeric values */
export const BOUNDARY_NUMBERS: any[] = [
  0,
  -0,
  1,
  -1,
  Number.MAX_SAFE_INTEGER, // 9007199254740991
  Number.MIN_SAFE_INTEGER, // -9007199254740991
  Number.MAX_VALUE, // ~1.79e+308
  Number.MIN_VALUE, // 5e-324
  Number.EPSILON,
  2147483647, // Int32 Max
  -2147483648, // Int32 Min
  2147483648, // Int32 Overflow
  4294967295, // UInt32 Max
  4294967296, // UInt32 Overflow
  1e308,
  1e-308,
  3.141592653589793,
  -999999999,
  -0.0000001,
  999999999.999999,
  NaN,
  Infinity,
  -Infinity,
];

/** String extremes and injection payloads */
export const STRING_EXTREMES: string[] = [
  '',
  ' ',
  '   \t\r\n   ',
  '\0',
  '\0\0\0\0',
  'test\0embedded_null_byte.json',
  '\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0A\x0B\x0C\x0D\x0E\x0F',
  'A'.repeat(1024), // 1KB
  'B'.repeat(65536), // 64KB
  'C'.repeat(1024 * 1024), // 1MB
  '\uD800\uDC00\uD83D\uDE00\uD83D\uDD25\uD83E\uDDEA', // Surrogate pairs & emoji
  '\u202Eevil_file_name\u202D.txt', // RTL override
  '\u200B\u200C\u200D\uFEFF', // Zero-width spaces & BOM
  '%s%s%s%s%s%n%x%d%p', // Format string specifiers
  "' OR '1'='1' -- ", // SQL injection pattern
  '"; DROP TABLE users; --', // SQL injection
  '; cat /etc/passwd | nc 127.0.0.1 1337 ;', // Command injection pattern
  '$(whoami && id)', // Shell substitution
  '`id`', // Backtick shell injection
  '<script>alert("XSS")</script>', // XSS vector
  '<img src=x onerror=alert(1)>', // Image XSS
  '${7*7}{{7*7}}#{7*7}', // Template injection syntax
];

/** Path traversal and sandbox escape vectors */
export const PATH_TRAVERSAL_VECTORS: string[] = [
  '../',
  '../../',
  '../../../etc/passwd',
  '/../../../../etc/shadow',
  '/var/log/../../../etc/hosts',
  '..\\..\\..\\windows\\system32\\config\\sam',
  '..\\..\\..\\boot.ini',
  '/sandbox/data/../other_tenant/secret.key',
  '....//....//....//etc/passwd',
  'folder/./../../sensitive.dat',
  '//root/private.key',
  '/documents//secrets.txt',
  './../root',
  '../../etc/passwd',
  '..\\..\\windows\\system32',
];

/** SSRF and forbidden IP endpoints */
export const SSRF_BLOCKED_URLS: string[] = [
  'http://169.254.169.254/latest/meta-data/',
  'http://169.254.169.254:8080/computeMetadata/v1/',
  'http://127.0.0.1:8000/admin',
  'http://127.0.0.1:3000/internal-debug',
  'http://127.0.0.2:9000/internal',
  'http://localhost:3000/metrics',
  'http://localhost:9222/json',
  'http://0.0.0.0:8000/',
  'http://[::1]:8080/metrics',
  'http://10.0.0.1/router-login',
  'http://10.254.1.1/internal',
  'http://172.16.0.1/status',
  'http://172.31.255.255/internal',
  'http://192.168.1.1/gateway',
  'http://192.168.0.100:8080/api',
  'http://0.0.0.0:80/',
];

/** Malformed & Dangerous URLs */
export const MALFORMED_AND_DANGEROUS_URLS: string[] = [
  'not-a-valid-url-protocol',
  'javascript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'file:///etc/passwd',
  '//invalid-relative-without-scheme',
  'http://',
  'https://',
  'http://??invalid_chars_in_url',
];

export const ALL_NETWORK_FUZZ_URLS: string[] = [
  ...SSRF_BLOCKED_URLS,
  ...MALFORMED_AND_DANGEROUS_URLS,
];

/** Prototype pollution payloads */
export function createPrototypePollutionPayloads(): any[] {
  return [
    JSON.parse('{"__proto__": {"polluted": true, "isAdmin": true}}'),
    JSON.parse('{"constructor": {"prototype": {"polluted": true, "role": "admin"}}}'),
    JSON.parse('{"__proto__": {"isDark": true, "status": "SUCCESS", "authenticated": true}}'),
    {
      __proto__: { polluted: true },
      constructor: { prototype: { polluted: true } },
      regularProp: 'safe_value',
    },
    (() => {
      const obj = Object.create(null);
      (obj as any)['__proto__'] = { polluted: true };
      return obj;
    })(),
    (() => {
      const obj: any = {};
      Object.defineProperty(obj, '__proto__', {
        value: { polluted: true },
        enumerable: true,
        configurable: true,
        writable: true,
      });
      return obj;
    })(),
  ];
}

/** Deeply nested structures (deep trees and DAGs) */
export function createDeepNestingPayloads(): any[] {
  // 50-level nested object
  let deepObj50: any = { leaf: 'deep_value_50' };
  for (let i = 0; i < 50; i++) {
    deepObj50 = { [`level_${i}`]: deepObj50 };
  }

  // 100-level nested object
  let deepObj100: any = { leaf: 'deep_value_100' };
  for (let i = 0; i < 100; i++) {
    deepObj100 = { [`nest_${i}`]: deepObj100 };
  }

  // 50-level nested array
  let deepArr50: any = ['deep_element_50'];
  for (let i = 0; i < 50; i++) {
    deepArr50 = [deepArr50];
  }

  // 100-level nested array
  let deepArr100: any = ['deep_element_100'];
  for (let i = 0; i < 100; i++) {
    deepArr100 = [deepArr100];
  }

  // Deep DAG (directed acyclic graph with multi-referenced shared nodes)
  const sharedLeaf = { sharedData: 'immutable_payload', tag: 999 };
  const dagObj = {
    branchA: { child1: sharedLeaf, child2: sharedLeaf },
    branchB: { child3: sharedLeaf, child4: sharedLeaf },
    branchC: [sharedLeaf, sharedLeaf, { nested: sharedLeaf }],
  };

  // Wide object with 500 properties
  const wideObj: Record<string, any> = {};
  for (let i = 0; i < 500; i++) {
    wideObj[`prop_${i}`] = `value_${i}`;
  }

  return [deepObj50, deepObj100, deepArr50, deepArr100, dagObj, wideObj];
}

/** Malformed data format payloads */
export const MALFORMED_DATA_PAYLOADS: any[] = [
  { invalidJsonString: '{"unclosed_object": true, ' },
  { brokenJson: '{key: valueWithoutQuotes}' },
  { invalidBase64: 'AQIDBA===NOT_BASE64!@#$' },
  { malformedUuid: 'not-a-uuid-string-12345' },
  { malformedHexColor: '#ZZZZZZ' },
  { invalidRgbColor: 'rgb(999, 999, 999, 999)' },
  { invalidHttpMethod: 'INVALID_HTTP_METHOD_NAME' },
  { invalidUrl: 'not_a_valid_url://///' },
  { outOfBoundsLatLong: { latitude: 999.99, longitude: -999.99 } },
  { negativeTimeout: { timeoutMs: -5000 } },
  { invalidEnum: { interval: 'warp_speed_interval', style: 'hyper_vibe', type: 'quantum_sensor' } },
];
