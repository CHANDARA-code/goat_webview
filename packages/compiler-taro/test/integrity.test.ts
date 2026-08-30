/**
 * @goat/compiler-taro - SHA-256 Integrity Generator & Tamper-Proofing Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { computeSha256, generateIntegrityManifest, verifyIntegrity } from '../src/bundler/integrity.js';

describe('SHA-256 Integrity Checksum Subsystem', () => {
  it('computeSha256: computes standard sha256-<hex> string matching crypto core', () => {
    const text = 'Hello Goat WebView Engine!';
    const expected = `sha256-${createHash('sha256').update(text).digest('hex')}`;
    const actual = computeSha256(text);
    assert.strictEqual(actual, expected);

    // Buffer input
    const buf = Buffer.from([1, 2, 3, 4, 5]);
    const expectedBuf = `sha256-${createHash('sha256').update(buf).digest('hex')}`;
    const actualBuf = computeSha256(buf);
    assert.strictEqual(actualBuf, expectedBuf);
  });

  it('generateIntegrityManifest: builds complete integrity.json descriptor', () => {
    const files: Record<string, string | Buffer> = {
      'manifest.json': '{"appId": "com.test"}',
      'appservice.worker.js': 'console.log("worker");',
      'webview.html': '<html></html>',
    };

    const integrity = generateIntegrityManifest(files, {
      appId: 'com.test',
      version: '1.0.0',
      target: 'dual-thread',
    });

    assert.strictEqual(integrity.appId, 'com.test');
    assert.strictEqual(integrity.version, '1.0.0');
    assert.strictEqual(integrity.target, 'dual-thread');
    assert.strictEqual(typeof integrity.timestamp, 'number');

    assert.ok(integrity.files['manifest.json']);
    assert.ok(integrity.files['appservice.worker.js']);
    assert.ok(integrity.files['webview.html']);

    assert.strictEqual(integrity.metadata?.totalFiles, 3);
    assert.ok((integrity.metadata?.totalSizeBytes ?? 0) > 0);
  });

  it('verifyIntegrity: successfully validates untouched bundles and detects tampering', () => {
    const files: Record<string, string | Buffer> = {
      'manifest.json': '{"appId": "com.test"}',
      'appservice.worker.js': 'console.log("worker");',
      'webview.html': '<html></html>',
    };

    const integrity = generateIntegrityManifest(files, {
      appId: 'com.test',
      version: '1.0.0',
      target: 'dual-thread',
    });

    // 1. Valid bundle
    const validCheck = verifyIntegrity(files, integrity);
    assert.strictEqual(validCheck.valid, true);
    assert.strictEqual(validCheck.missingFiles.length, 0);
    assert.strictEqual(validCheck.mismatchedFiles.length, 0);

    // 2. Tampered file
    const tamperedFiles = {
      ...files,
      'appservice.worker.js': 'console.log("TAMPERED WORKER");',
    };
    const tamperedCheck = verifyIntegrity(tamperedFiles, integrity);
    assert.strictEqual(tamperedCheck.valid, false);
    assert.strictEqual(tamperedCheck.mismatchedFiles.includes('appservice.worker.js'), true);

    // 3. Missing file
    const missingFiles = {
      'manifest.json': '{"appId": "com.test"}',
    };
    const missingCheck = verifyIntegrity(missingFiles, integrity);
    assert.strictEqual(missingCheck.valid, false);
    assert.strictEqual(missingCheck.missingFiles.includes('webview.html'), true);
  });
});
