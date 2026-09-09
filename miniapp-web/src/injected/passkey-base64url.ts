/**
 * Base64URL <-> binary conversion for the WebAuthn wire format.
 *
 * The byteOffset handling is the load-bearing part: a `Uint8Array` produced by
 * `new Uint8Array(someBuffer, 16, 32)` shares its parent's `ArrayBuffer`, so reading
 * `view.buffer` without honouring `byteOffset`/`byteLength` silently encodes the WRONG bytes —
 * a challenge or credential id that looks plausible and fails verification server-side.
 */

const B64URL_ALPHABET_SAFE = /^[A-Za-z0-9_-]*$/;

export function bufferToBase64Url(input: ArrayBuffer | ArrayBufferView): string {
  const bytes = ArrayBuffer.isView(input)
    ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
    : new Uint8Array(input);

  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as unknown as number[]);
  }
  return encodeBase64(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function base64UrlToBuffer(base64url: string): ArrayBuffer {
  if (typeof base64url !== 'string') {
    throw new TypeError('base64UrlToBuffer expects a string');
  }
  if (!B64URL_ALPHABET_SAFE.test(base64url)) {
    throw new TypeError('Value is not valid Base64URL');
  }
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) base64 += '=';

  const binary = decodeBase64(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** Accepts anything WebAuthn allows for a binary field and normalises it to Base64URL. */
export function coerceToBase64Url(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    return bufferToBase64Url(value as ArrayBuffer | ArrayBufferView);
  }
  if (Array.isArray(value)) return bufferToBase64Url(Uint8Array.from(value));
  throw new TypeError('Expected an ArrayBuffer, ArrayBufferView, number[] or Base64URL string');
}

function encodeBase64(binary: string): string {
  if (typeof btoa === 'function') return btoa(binary);
  return bufferFrom(binary).toString('base64');
}

function decodeBase64(base64: string): string {
  if (typeof atob === 'function') return atob(base64);
  return bufferFrom(base64, 'base64').toString('binary');
}

/** Node fallback so the polyfill's pure helpers stay unit-testable outside a browser. */
function bufferFrom(value: string, encoding?: string): { toString(enc: string): string } {
  const nodeBuffer = (globalThis as any).Buffer;
  if (!nodeBuffer) throw new Error('No base64 implementation available in this environment');
  return encoding ? nodeBuffer.from(value, encoding) : nodeBuffer.from(value, 'binary');
}
