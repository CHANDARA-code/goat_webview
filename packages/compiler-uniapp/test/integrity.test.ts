import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateIntegrityManifest, verifyBundleIntegrity } from '../dist/bundler/integrity.js';
import { computeSha256 } from '../dist/utils/hash.js';
import type { BundleFileArtifact } from '../dist/types.js';

describe('Cryptographic SHA-256 Integrity Verification', () => {
  const sampleArtifacts: BundleFileArtifact[] = [
    {
      path: 'manifest.json',
      content: '{"appId":"com.example.app","version":"1.0.0"}',
    },
    {
      path: 'appservice.worker.js',
      content: 'console.log("worker running");',
    },
    {
      path: 'webview.html',
      content: '<!DOCTYPE html><html><body></body></html>',
    },
  ];

  it('generates SHA-256 digests and total byte counts accurately', () => {
    const integrity = generateIntegrityManifest(sampleArtifacts);

    assert.equal(integrity.version, '1.0.0');
    assert.equal(integrity.algorithm, 'sha256');
    assert.ok(integrity.files['manifest.json']);
    assert.ok(integrity.files['appservice.worker.js']);
    assert.ok(integrity.files['webview.html']);

    // Check exact SHA-256 of manifest.json
    const expectedManifestHash = computeSha256('{"appId":"com.example.app","version":"1.0.0"}');
    assert.equal(integrity.files['manifest.json'].sha256, expectedManifestHash);
    assert.equal(integrity.files['manifest.json'].size, Buffer.byteLength('{"appId":"com.example.app","version":"1.0.0"}'));

    assert.ok(integrity.totalBytes > 0);
  });

  it('verifies bundle integrity on untampered artifacts', () => {
    const integrity = generateIntegrityManifest(sampleArtifacts);
    const verification = verifyBundleIntegrity(sampleArtifacts, integrity);

    assert.equal(verification.valid, true);
    assert.equal(verification.mismatchedFiles.length, 0);
    assert.equal(verification.missingFiles.length, 0);
  });

  it('detects tampering when an artifact is modified', () => {
    const integrity = generateIntegrityManifest(sampleArtifacts);

    const tamperedArtifacts: BundleFileArtifact[] = [
      {
        path: 'manifest.json',
        content: '{"appId":"com.example.app","version":"1.0.0"}',
      },
      {
        path: 'appservice.worker.js',
        content: 'console.log("tampered worker malicious injection");', // modified!
      },
      {
        path: 'webview.html',
        content: '<!DOCTYPE html><html><body></body></html>',
      },
    ];

    const verification = verifyBundleIntegrity(tamperedArtifacts, integrity);
    assert.equal(verification.valid, false);
    assert.ok(verification.mismatchedFiles.includes('appservice.worker.js'));
  });

  it('detects missing files when an artifact is omitted', () => {
    const integrity = generateIntegrityManifest(sampleArtifacts);

    const partialArtifacts: BundleFileArtifact[] = [
      {
        path: 'manifest.json',
        content: '{"appId":"com.example.app","version":"1.0.0"}',
      },
    ];

    const verification = verifyBundleIntegrity(partialArtifacts, integrity);
    assert.equal(verification.valid, false);
    assert.ok(verification.missingFiles.includes('appservice.worker.js'));
    assert.ok(verification.missingFiles.includes('webview.html'));
  });
});
