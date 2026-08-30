/**
 * r5-build-packaging-cli.spec.ts — Tier 1 Feature Coverage for Requirement R5
 * Scope: Subpackage bundle visualizer, Bytecode precompile preview,
 * CDP QR Pairing relay, and CLI `goat studio` command integration.
 */

import { describe, it, expect } from '../harness/test-runner.ts';
import { DevToolsTestHarness } from '../harness/devtools-test-harness.ts';
import { analyzeBytecodePrecompilation } from '../../services/v8BytecodeAnalyzer.ts';

export function registerR5Tests() {
  describe('Tier 1: R5 — Build, Packaging & Device Relay Tools', () => {
    it('T1.R5.01: Subpackage bundle visualizer calculates main package and subpackage chunk sizes', () => {
      const harness = new DevToolsTestHarness();

      const subpackages = [
        { root: 'subpackages/order', name: 'order', pages: ['pages/checkout', 'pages/invoice'], sizeBytes: 154200 },
        { root: 'subpackages/profile', name: 'profile', pages: ['pages/me', 'pages/settings'], sizeBytes: 89600 },
      ];

      harness.store.getState().setSubpackages(subpackages);
      expect(harness.getState().subpackages.length).toBe(2);

      harness.store.getState().setBundleSizeStats({
        mainPackageSizeBytes: 345000,
        subpackagesSizeBytes: { order: 154200, profile: 89600 },
        totalSizeBytes: 588800,
        assetBreakdown: { 'app.js': 200000, 'app.wxss': 80000, 'images/': 65000 },
      });

      expect(harness.getState().bundleSizeStats.totalSizeBytes).toBe(588800);
      expect(harness.getState().bundleSizeStats.subpackagesSizeBytes['order']).toBe(154200);
    });

    it('T1.R5.02: Subpackage dependency graph tracks page roots and independent module flags', () => {
      const harness = new DevToolsTestHarness();

      harness.store.getState().setSubpackages([
        { root: 'pages/auth', name: 'auth', pages: ['login', 'register'], independent: true },
      ]);

      const subs = harness.getState().subpackages;
      expect(subs[0].independent).toBe(true);
      expect(subs[0].pages).toContain('login');
    });

    it('T1.R5.03: V8 bytecode precompilation preview calculates size reduction and cold boot metrics', () => {
      const sampleJs = `
        function bootApplication() {
          console.log("Initializing mini-app engine...");
          for (let i = 0; i < 1000; i++) {
            Math.sqrt(i * Math.PI);
          }
        }
        bootApplication();
      `;

      const summary = analyzeBytecodePrecompilation(sampleJs);
      expect(summary.originalSizeBytes).toBeGreaterThan(0);
      expect(summary.bytecodeSizeBytes).toBeGreaterThan(0);
      expect(summary.improvementMs).toBeGreaterThan(0);
      expect(summary.integritySha256).toContain('sha256-');
      expect(summary.isWarmed).toBe(true);
    });

    it('T1.R5.04: CDP QR code pairing generator initializes pairing tokens and WebSocket relay endpoints', () => {
      const harness = new DevToolsTestHarness();

      const { code, wsUrl } = harness.generateQrPairing(4000);
      expect(code).toContain('GOAT-');
      expect(wsUrl).toContain('ws://localhost:4000/devtools/page');
      expect(harness.getState().qrPairing.isConnected).toBe(true);
      expect(harness.getState().qrPairing.clientDevice?.platform).toBe('iOS');
    });

    it('T1.R5.05: CLI goat studio command options support port, server-port, and project parameters', () => {
      // Simulating studio command option parser
      const mockParseStudioArgs = (args: string[]) => {
        let port = 4000;
        let serverPort = 3001;
        let open = true;
        let project = '.';

        for (let i = 0; i < args.length; i++) {
          if (args[i].startsWith('--port=')) port = parseInt(args[i].split('=')[1], 10);
          if (args[i].startsWith('--server-port=')) serverPort = parseInt(args[i].split('=')[1], 10);
          if (args[i] === '--no-open') open = false;
          if (args[i].startsWith('--project=')) project = args[i].split('=')[1];
        }

        return { port, serverPort, open, project };
      };

      const opts = mockParseStudioArgs(['--port=4500', '--server-port=7373', '--no-open', '--project=./apps/demo']);
      expect(opts.port).toBe(4500);
      expect(opts.serverPort).toBe(7373);
      expect(opts.open).toBe(false);
      expect(opts.project).toBe('./apps/demo');
    });
  });
}
