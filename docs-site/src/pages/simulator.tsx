import React from 'react';
import Layout from '@theme/Layout';
import { SimulatorProvider } from '../context/SimulatorContext';
import { DeviceSimulator } from '../components/DeviceSimulator';
import { ComponentShowcase } from '../components/ComponentShowcase';
import { BridgeInspector } from '../components/BridgeInspector';

export default function SimulatorPage(): React.ReactElement {
  return (
    <Layout
      title="Live Mobile Device Simulator & Bridge Studio"
      description="Interactive iOS & Android device simulator with hardware mocking and real-time JSON-RPC bridge telemetry for Goat WebView."
    >
      <SimulatorProvider>
        <main style={{ padding: '24px 20px', maxWidth: '1440px', margin: '0 auto', minHeight: 'calc(100vh - 120px)' }}>
          {/* Header Banner */}
          <div style={{ marginBottom: '24px', textAlign: 'center' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '0 0 8px 0', background: 'linear-gradient(135deg, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Goat Mobile Device Simulator & Bridge Studio
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--ifm-color-emphasis-700, #94a3b8)', maxWidth: '720px', margin: '0 auto' }}>
              Test your mini-app UI and verify all 197 bridge actions hermetically in your browser with hardware state mocking (GPS, Battery, Network, Biometrics) and live JSON-RPC telemetry.
            </p>
          </div>

          {/* Master Grid Layout */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(320px, 380px) minmax(360px, 1fr) minmax(340px, 1fr)',
              gap: '20px',
              alignItems: 'start',
            }}
          >
            {/* Column 1: Mobile Device Frame */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <DeviceSimulator showControls={false} />
            </div>

            {/* Column 2: Mock Hardware Controls & Component Matrix */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <ComponentShowcase />
            </div>

            {/* Column 3: Live Bridge IPC Inspector & Mock Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <BridgeInspector />
            </div>
          </div>
        </main>
      </SimulatorProvider>
    </Layout>
  );
}
