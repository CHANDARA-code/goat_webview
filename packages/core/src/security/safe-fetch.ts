/**
 * @goat/core - Zero-Trust Safe HTTP Transport Client
 *
 * Enforces pre-flight URL validation, Layer 3 DNS subnet inspection,
 * pinned socket destination dispatch, and full 5-layer re-validation on all 3xx redirects.
 */

import {
  RedirectBlockedError,
  SsrfBlockedError,
  GoatSecurityError,
  SecurityErrorCode,
} from './errors.js';
import { validateUrl, UrlValidatorOptions } from './url-validator.js';
import { DnsResolver, SystemDnsResolver, validateHostnameDns } from './dns-resolver.js';
import { DnsPinningManager } from './dns-pinning.js';

export interface SafeFetchOptions extends UrlValidatorOptions {
  dnsResolver?: DnsResolver;
  maxRedirects?: number;
  followRedirects?: boolean;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  /** Custom transport callback for hermetic simulation or custom HTTP socket dispatch */
  customTransport?: (
    url: string,
    init: RequestInit,
    pinnedIp: string
  ) => Promise<Response>;
}

export interface SafeFetchResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  url: string;
  redirectCount: number;
  pinnedIp: string;
  text: () => Promise<string>;
  json: () => Promise<any>;
}

const pinningManager = new DnsPinningManager();

/**
 * Strips sensitive authentication and cookie headers when a redirect leaves the original origin.
 */
function stripSensitiveHeadersOnCrossOrigin(
  headers: Record<string, string>,
  fromOrigin: string,
  toOrigin: string
): Record<string, string> {
  if (fromOrigin === toOrigin) {
    return { ...headers };
  }

  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    const lowerKey = k.toLowerCase();
    if (
      lowerKey === 'authorization' ||
      lowerKey === 'cookie' ||
      lowerKey === 'proxy-authorization'
    ) {
      continue;
    }
    cleaned[k] = v;
  }
  return cleaned;
}

/**
 * Executes a zero-trust secured HTTP request with pre-flight URL validation,
 * DNS subnet verification, socket pinning, and redirect chain re-validation.
 */
export async function safeFetch(
  inputUrl: string | URL,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResponse> {
  const dnsResolver = options.dnsResolver || new SystemDnsResolver();
  const maxRedirects = options.maxRedirects !== undefined ? options.maxRedirects : 5;
  const followRedirects = options.followRedirects !== undefined ? options.followRedirects : true;
  const timeoutMs = options.timeout || 15000;

  let currentUrl = typeof inputUrl === 'string' ? inputUrl : inputUrl.toString();
  let currentMethod = (options.method || 'GET').toUpperCase();
  let currentHeaders = { ...(options.headers || {}) };
  let currentBody = options.body;
  let redirectCount = 0;
  const visitedUrls: string[] = [];

  while (true) {
    // 1. Layer 1 & 2: Pre-flight URL validation (schemes, cloud metadata, literal IPs, domain allowlist)
    const validated = validateUrl(currentUrl, options);
    visitedUrls.push(validated.cleanUrlString);

    // 2. Layer 3: DNS Resolution & Subnet Filter
    const dnsValidation = await validateHostnameDns(validated.hostname, dnsResolver, {
      allowPrivateRanges: options.allowPrivateRanges,
    });

    const pinnedIp = dnsValidation.pinnedIp;

    // 3. Prepare HTTP Request
    const requestHeaders: Record<string, string> = {
      Host: validated.hostname + (validated.url.port ? `:${validated.url.port}` : ''),
      ...currentHeaders,
    };

    const requestInit: RequestInit = {
      method: currentMethod,
      headers: requestHeaders,
      body: currentMethod !== 'GET' && currentMethod !== 'HEAD' ? currentBody : undefined,
      redirect: 'manual', // Never let underlying client follow redirects unmonitored!
    };

    // 4. Dispatch Request (via custom transport or fetch)
    let rawResponse: Response;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      if (options.customTransport) {
        rawResponse = await options.customTransport(validated.cleanUrlString, requestInit, pinnedIp);
      } else {
        // Native fetch with abort signal
        rawResponse = await fetch(validated.cleanUrlString, {
          ...requestInit,
          signal: controller.signal,
        });
      }
    } catch (err: any) {
      if (err instanceof GoatSecurityError) throw err;
      throw new GoatSecurityError(
        SecurityErrorCode.INVALID_URL,
        `Network request failed for "${validated.cleanUrlString}": ${err.message}`
      );
    } finally {
      clearTimeout(timeoutId);
    }

    // Convert response headers to plain Record
    const responseHeadersRecord: Record<string, string> = {};
    if (rawResponse.headers && typeof rawResponse.headers.forEach === 'function') {
      rawResponse.headers.forEach((value, key) => {
        responseHeadersRecord[key.toLowerCase()] = value;
      });
    }

    // 5. Layer 4: Redirect Chain Re-validation
    const isRedirect =
      rawResponse.status === 301 ||
      rawResponse.status === 302 ||
      rawResponse.status === 303 ||
      rawResponse.status === 307 ||
      rawResponse.status === 308;

    if (isRedirect && followRedirects) {
      redirectCount++;
      if (redirectCount > maxRedirects) {
        throw new RedirectBlockedError(
          `Redirect blocked: Exceeded maximum allowed redirect hops (${maxRedirects})`
        );
      }

      const location = responseHeadersRecord['location'];
      if (!location) {
        throw new RedirectBlockedError(
          `Redirect response (${rawResponse.status}) missing required "Location" header`
        );
      }

      // Resolve relative or absolute target URL
      let nextUrl: URL;
      try {
        nextUrl = new URL(location, validated.cleanUrlString);
      } catch (err: any) {
        throw new RedirectBlockedError(
          `Malformed redirect target URL "${location}" from "${validated.cleanUrlString}"`
        );
      }

      const fromOrigin = validated.url.origin;
      const toOrigin = nextUrl.origin;

      // Clean headers for cross-origin redirect
      currentHeaders = stripSensitiveHeadersOnCrossOrigin(currentHeaders, fromOrigin, toOrigin);

      // Handle standard 303 / 302 method rewriting
      if (rawResponse.status === 303 || (rawResponse.status === 302 && currentMethod === 'POST')) {
        currentMethod = 'GET';
        currentBody = undefined;
      }

      currentUrl = nextUrl.toString();
      continue;
    }

    // 6. Return Verified Response
    const responseText = await rawResponse.text();

    return {
      status: rawResponse.status,
      statusText: rawResponse.statusText,
      headers: responseHeadersRecord,
      url: validated.cleanUrlString,
      redirectCount,
      pinnedIp,
      text: async () => responseText,
      json: async () => JSON.parse(responseText),
    };
  }
}
