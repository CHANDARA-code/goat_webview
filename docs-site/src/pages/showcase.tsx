import React from 'react';
import Layout from '@theme/Layout';
import { SimulatorProvider } from '../context/SimulatorContext';
import { DeviceSimulator } from '../components/DeviceSimulator';
import { ComponentShowcase } from '../components/ComponentShowcase';
import { BridgeInspector } from '../components/BridgeInspector';

export default function ShowcasePage(): React.ReactElement {
  return (
    <Layout
      title="Native Component Showcase Matrix"
      description="Interactive playgrounds and code generation for Goat WebView native widgets: NavigationBar, BottomSheet, PermissionPriming, ExternalLinkWarning, Haptics, and Biometrics."
    >
      <SimulatorProvider>
        <main style={{ padding: '24px 20px', maxWidth: '1440px', margin: '0 auto', minHeight: 'calc(100vh - 120px)' }}>
          {/* Header */}
          <div style={{ marginBottom: '24px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '0 0 8px 0', color: 'var(--ifm-heading-color, #ffffff)' }}>
              Native Component Showcase & Playgrounds
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--ifm-color-emphasis-700, #94a3b8)', margin: 0 }}>
              Explore the 6 core native UI components designed for high-performance mini-app experiences with instant preview, customizable parameters, and multi-language SDK snippets.
            </p>
          </div>

          {/* Dual Column Layout: Left = Component Playground + Inspector, Right = Device Simulator */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(400px, 1fr) minmax(340px, 420px)',
              gap: '24px',
              alignItems: 'start',
            }}
          >
            {/* Left: Component Playground Matrix & IPC Telemetry */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <ComponentShowcase />
              <BridgeInspector />
            </div>

            {/* Right: Sticky Device Simulator Preview with Controls */}
            <div style={{ position: 'sticky', top: '80px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <DeviceSimulator showControls={true} />
            </div>
          </div>
        </main>
      </SimulatorProvider>
    </Layout>
  );
}
