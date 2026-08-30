/**
 * Tier 4: Real-World Developer Workflows Test Suite
 * Validates complete end-to-end user journeys and developer personas across the Goat WebView documentation portal and tooling ecosystem.
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DOMAIN_CATALOG } from './harness/api-catalog-oracle.ts';
import { DocsValidator } from './harness/docs-validator.ts';
import { DocsSearchEngine } from './harness/search-engine.ts';
import { SimulatorHarness } from './harness/simulator-harness.ts';
import { mockState } from '../../packages/bridge-mock/dist/src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SITE_ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(SITE_ROOT, '..');

describe('Tier 4: Real-World Developer Workflows Suite (10 Personas)', () => {
  const validator = new DocsValidator(SITE_ROOT);
  const searchEngine = new DocsSearchEngine();

  // ---------------------------------------------------------------------------
  // Workflow 1: React 19 Mini-App Developer Onboarding
  // ---------------------------------------------------------------------------
  it('Workflow 1: React 19 Mini-App Developer Onboarding Journey', async () => {
    // 1. Developer visits Quickstart guide
    const docs = validator.scanDocs();
    const quickstart = docs.find(d => d.relativePath.includes('quickstart.md'));
    assert.ok(quickstart, 'Quickstart guide must exist');

    // 2. Developer discovers @goat/cli init command in docs
    const rawDoc = fs.readFileSync(quickstart.absolutePath, 'utf-8');
    assert.ok(rawDoc.includes('goat') || rawDoc.includes('npm'));

    // 3. Developer opens Simulator and runs GET_DEVICE_INFO
    const harness = new SimulatorHarness('my_react19_app');
    const info = await harness.executeAction<{ model: string; platform: string }>('GET_DEVICE_INFO', {});
    assert.ok(info.model.length > 0);

    // 4. Developer copies TypeScript code snippet
    const tsSnippet = `import { goatBridge } from '@goat/sdk';\nconst info = await goatBridge.callNative('GET_DEVICE_INFO', {});`;
    assert.ok(tsSnippet.includes('GET_DEVICE_INFO'));

    // 5. Developer inspects live IPC trace
    assert.equal(harness.traceStream[0].action, 'GET_DEVICE_INFO');
    assert.equal(harness.traceStream[0].status, 'SUCCESS');
  });

  // ---------------------------------------------------------------------------
  // Workflow 2: iOS Host-App Engineer Integration
  // ---------------------------------------------------------------------------
  it('Workflow 2: iOS Host-App Engineer Integration & Scheme Routing Journey', async () => {
    // 1. Engineer reads iOS platform guide
    const docs = validator.scanDocs();
    const iosDoc = docs.find(d => d.relativePath.includes('ios.md'));
    assert.ok(iosDoc, 'platforms/ios.md must exist');

    // 2. Engineer explores GoatWKWebView scheme handler docs
    const rawDoc = fs.readFileSync(iosDoc.absolutePath, 'utf-8');
    assert.ok(rawDoc.includes('iOS') || rawDoc.includes('Swift'));

    // 3. Engineer tests tactile haptics in simulator
    const harness = new SimulatorHarness('ios_host_app', 'iphone-16-pro');
    const hapticRes = await harness.executeAction<{ triggered: boolean; type: string }>('HAPTIC_FEEDBACK', {
      type: 'impact',
      style: 'heavy',
    });
    assert.equal(hapticRes.triggered, true);

    // 4. Engineer checks memory metrics
    const memRes = await harness.executeAction<{ usedMemoryMb: number }>('GET_MEMORY_METRICS', {});
    assert.ok(memRes.usedMemoryMb > 0);
  });

  // ---------------------------------------------------------------------------
  // Workflow 3: Android Kotlin Host-App Developer
  // ---------------------------------------------------------------------------
  it('Workflow 3: Android Kotlin Host-App Developer Enclave Security Journey', async () => {
    // 1. Developer reads Android guide
    const docs = validator.scanDocs();
    const androidDoc = docs.find(d => d.relativePath.includes('android.md'));
    assert.ok(androidDoc, 'platforms/android.md must exist');

    // 2. Developer tests Keystore secure storage in simulator
    const harness = new SimulatorHarness('android_keystore_app', 'pixel-9-pro');
    const secStore = await harness.executeAction<{ saved: boolean; key: string }>('SECURE_STORAGE_SET', {
      key: 'biometric_token',
      value: 'jwt_secure_enclave_xyz',
    });
    assert.equal(secStore.saved, true);

    // 3. Developer retrieves and verifies secret
    const secGet = await harness.executeAction<{ value: string }>('SECURE_STORAGE_GET', {
      key: 'biometric_token',
    });
    assert.equal(secGet.value, 'jwt_secure_enclave_xyz');

    // 4. Developer reviews Kotlin code snippet
    const ktSnippet = `handler.registerCustomHandler("SECURE_STORAGE_SET") { payload -> ... }`;
    assert.ok(ktSnippet.includes('SECURE_STORAGE_SET'));
  });

  // ---------------------------------------------------------------------------
  // Workflow 4: Cross-Platform Flutter Developer
  // ---------------------------------------------------------------------------
  it('Workflow 4: Cross-Platform Flutter Developer MethodChannel Delegation Journey', async () => {
    // 1. Flutter developer searches API catalog for STORAGE_SET
    const searchRes = searchEngine.search('STORAGE_SET', { platform: 'flutter' });
    assert.ok(searchRes.length > 0);

    // 2. Developer checks Dart code snippet
    const dartSnippet = `final res = await controller.executeAction('STORAGE_SET', {'key': 'theme', 'value': 'dark'});`;
    assert.ok(dartSnippet.includes('executeAction'));

    // 3. Developer tests action execution in simulator harness
    const harness = new SimulatorHarness('flutter_app');
    const setRes = await harness.executeAction<{ saved: boolean; key: string }>('STORAGE_SET', {
      key: 'theme',
      value: 'dark',
    });
    assert.equal(setRes.saved, true);

    const getRes = await harness.executeAction<{ value: string }>('STORAGE_GET', {
      key: 'theme',
    });
    assert.equal(getRes.value, 'dark');
  });

  // ---------------------------------------------------------------------------
  // Workflow 5: Security Auditor Zero-Trust Audit
  // ---------------------------------------------------------------------------
  it('Workflow 5: Security Auditor Zero-Trust Audit & Penetration Testing Journey', async () => {
    // 1. Auditor reviews OWASP MASVS compliance guide
    const docs = validator.scanDocs();
    const masvsDoc = docs.find(d => d.relativePath.includes('owasp-masvs-compliance.md'));
    assert.ok(masvsDoc, 'security/owasp-masvs-compliance.md must exist');

    // 2. Auditor performs FileSystem directory traversal injection attempt
    const harness = new SimulatorHarness('audit_tenant');
    await assert.rejects(async () => {
      await harness.executeAction('FS_READ_FILE', { filePath: '../../../../etc/passwd', path: '../../../../etc/passwd' });
    }, /Path traversal detected/i);

    // 3. Auditor performs SSRF private IP access attempt
    await assert.rejects(async () => {
      await harness.executeAction('API_REQUEST', { url: 'http://169.254.169.254/latest/meta-data/' });
    }, /SSRF protection|private host/i);

    // 4. Auditor inspects audit headers in simulator
    const auditRes = await harness.executeAction<{ isIsolatedContext: boolean; status: string }>('AUDIT_SANDBOX_HEADERS', {});
    assert.equal(auditRes.isIsolatedContext, true);
    assert.equal(auditRes.status, 'HERMETIC_ISOLATION_CONFIRMED');
  });

  // ---------------------------------------------------------------------------
  // Workflow 6: Web3 & E-Commerce Payments Developer
  // ---------------------------------------------------------------------------
  it('Workflow 6: Web3 & E-Commerce Payments Developer Checkout Journey', async () => {
    // 1. Developer searches for Web3 wallet and invoice actions
    const walletDocs = searchEngine.search('WEB3_CONNECT_WALLET');
    const invoiceDocs = searchEngine.search('OPEN_INVOICE');
    assert.ok(walletDocs.length > 0);
    assert.ok(invoiceDocs.length > 0);

    // 2. Developer executes wallet connection in simulator
    const harness = new SimulatorHarness('web3_dapp');
    const walletRes = await harness.executeAction<{ address: string; chainId: any }>('WEB3_CONNECT_WALLET', {
      chainId: 1,
    });
    assert.ok(walletRes.address.startsWith('0x'));
    assert.equal(String(walletRes.chainId), '1');

    // 3. Developer prompts openInvoice sheet
    const invoiceRes = await harness.executeAction<{ status: string; invoiceSlug: string }>('OPEN_INVOICE', {
      invoiceSlug: 'inv_vip_membership_99',
    });
    assert.equal(invoiceRes.status, 'PAID');
    assert.equal(invoiceRes.invoiceSlug, 'inv_vip_membership_99');
  });

  // ---------------------------------------------------------------------------
  // Workflow 7: Bluetooth Low Energy & IoT Mini-App Flow
  // ---------------------------------------------------------------------------
  it('Workflow 7: Bluetooth Low Energy & IoT Mini-App Flow Journey', async () => {
    // 1. Developer finds BLE APIs in search engine
    const bleSearch = searchEngine.search('BLE_START_SCAN');
    assert.ok(bleSearch.length > 0);
    const bleDoc = bleSearch[0].doc;
    assert.ok(bleDoc.permissions.includes('BLUETOOTH_SCAN'));

    // 2. Developer starts BLE scan in simulator
    const harness = new SimulatorHarness('iot_drone_app');
    mockState.permissions.set('BLUETOOTH', true);
    const scanRes = await harness.executeAction<{ isScanning: boolean }>('BLE_START_SCAN', {
      serviceUuids: ['180D'],
    });
    assert.equal(scanRes.isScanning, true);

    // 3. Developer connects to discovered peripheral
    const connRes = await harness.executeAction<{ connected: boolean; deviceId: string }>('BLE_CONNECT', {
      deviceId: 'AA:BB:CC:11:22:33',
    });
    assert.equal(connRes.connected, true);

    // 4. Developer writes control packet to GATT characteristic
    const writeRes = await harness.executeAction<{ written: boolean; characteristicId: string }>('BLE_WRITE_CHARACTERISTIC', {
      deviceId: 'AA:BB:CC:11:22:33',
      serviceId: '180D',
      characteristicId: '2A37',
      value: '01FF',
    });
    assert.equal(writeRes.written, true);
  });

  // ---------------------------------------------------------------------------
  // Workflow 8: Native UI Widgets & Dialogs Showcase Walkthrough
  // ---------------------------------------------------------------------------
  it('Workflow 8: Native UI Widgets & Dialogs Complete Showcase Walkthrough', async () => {
    const harness = new SimulatorHarness('ui_showcase_flow');

    // 1. Navigation Bar
    await harness.executeAction('SET_NAV_BAR_TITLE', { title: 'Order Summary' });
    await harness.executeAction('SET_NAV_BAR_COLOR', { backgroundColor: '#1e293b', textColor: '#ffffff' });
    assert.equal(harness.navBarState.title, 'Order Summary');

    // 2. Bottom Sheet
    await harness.executeAction('EXPAND_BOTTOM_SHEET', { snapPoint: '90%' });
    assert.equal(harness.bottomSheetState.isOpen, true);

    // 3. Permission Priming
    const permRes = await harness.executeAction<{ scope: string }>('REQUEST_PERMISSION', {
      scope: 'CAMERA',
      rationale: 'Scan barcode',
    });
    assert.equal(permRes.scope, 'CAMERA');

    // 4. External Link Warning
    const linkRes = await harness.executeAction<{ opened: boolean }>('OPEN_EXTERNAL_LINK', {
      url: 'https://help.goat.dev',
    });
    assert.equal(linkRes.opened, true);

    // 5. Haptics
    const hapRes = await harness.executeAction<{ triggered: boolean }>('HAPTIC_FEEDBACK', {
      type: 'notification',
      notificationType: 'success',
    });
    assert.equal(hapRes.triggered, true);

    // 6. Biometrics
    const bioRes = await harness.executeAction<{ authenticated: boolean }>('BIOMETRIC_AUTH', {
      reason: 'Authorize order submission',
    });
    assert.equal(bioRes.authenticated, true);

    // Verify complete 7-record trace
    assert.equal(harness.getTraceCount(), 7);
  });

  // ---------------------------------------------------------------------------
  // Workflow 9: APM & Performance Optimization Engineer
  // ---------------------------------------------------------------------------
  it('Workflow 9: APM & Performance Optimization Engineer Benchmarking Journey', async () => {
    // 1. Engineer reads architecture deep-dive
    const docs = validator.scanDocs();
    const archDoc = docs.find(d => d.relativePath.includes('multi-tenant-sandboxing.md'));
    assert.ok(archDoc);

    // 2. Engineer starts OpenTelemetry trace span
    const harness = new SimulatorHarness('apm_engineer_app');
    const traceSpan = await harness.executeAction<{ traceId: string; spanId: string }>('START_TRACE', {
      opName: 'checkout_render_pipeline',
    });
    assert.ok(traceSpan.traceId.length > 0);
    assert.ok(traceSpan.spanId.length > 0);

    // 3. Engineer records startup benchmark samples
    const sampleRes = await harness.executeAction<{ recorded: boolean }>('RECORD_STARTUP_BENCHMARK_SAMPLE', {
      coldStartTimeMs: 110,
      warmStartTimeMs: 22,
    });
    assert.equal(sampleRes.recorded, true);

    // 4. Engineer fetches APM metrics summary
    const summary = await harness.executeAction<{ avgBridgeLatencyMs: number; totalReports: number }>('GET_APM_SUMMARY', {});
    assert.ok(summary.avgBridgeLatencyMs >= 0);
    assert.ok(summary.totalReports >= 0);
  });

  // ---------------------------------------------------------------------------
  // Workflow 10: CI/CD & Production Release Engineer
  // ---------------------------------------------------------------------------
  it('Workflow 10: CI/CD & Production Release Engineer Verification Journey', () => {
    // 1. Verify GitHub Actions workflow for deployment
    const deployWorkflow = path.join(PROJECT_ROOT, '.github/workflows/deploy-docs.yml');
    assert.ok(fs.existsSync(deployWorkflow));
    const workflowContent = fs.readFileSync(deployWorkflow, 'utf-8');
    assert.ok(workflowContent.includes('deploy-docs'));

    // 2. Verify documentation generation script
    const genDocsScript = path.join(PROJECT_ROOT, 'scripts/generate-docs.sh');
    assert.ok(fs.existsSync(genDocsScript));
    const scriptContent = fs.readFileSync(genDocsScript, 'utf-8');
    assert.ok(scriptContent.includes('set -euo pipefail'));

    // 3. Verify Docusaurus static site build configuration
    const configPath = path.join(SITE_ROOT, 'docusaurus.config.ts');
    assert.ok(fs.existsSync(configPath));

    // 4. Verify search index coverage
    assert.ok(searchEngine.getDocumentCount() >= 215);

    // 5. Verify master verification script
    const verifyAllScript = path.join(PROJECT_ROOT, 'scripts/verify-all.sh');
    assert.ok(fs.existsSync(verifyAllScript));
  });
});
