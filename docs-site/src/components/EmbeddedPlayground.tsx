import React, { useState } from 'react';
import { SimulatorProvider, useSimulator, ActiveWidgetTab } from '../context/SimulatorContext';
import { DeviceSimulator } from './DeviceSimulator';
import { ComponentShowcase } from './ComponentShowcase';
import { BridgeInspector } from './BridgeInspector';

export interface EmbeddedPlaygroundProps {
  initialTab?: ActiveWidgetTab;
  showInspector?: boolean;
  showControls?: boolean;
  layout?: 'split' | 'stacked' | 'preview-only';
  title?: string;
  description?: string;
}

const EmbeddedPlaygroundInner: React.FC<EmbeddedPlaygroundProps> = ({
  initialTab = 'navbar',
  showInspector = true,
  showControls = true,
  layout = 'split',
  title,
  description,
}) => {
  const { setActiveWidgetTab } = useSimulator();

  React.useEffect(() => {
    if (initialTab) {
      setActiveWidgetTab(initialTab);
    }
  }, [initialTab, setActiveWidgetTab]);

  return (
    <div
      style={{
        margin: '24px 0',
        borderRadius: '12px',
        border: '1px solid var(--ifm-color-emphasis-300, #334155)',
        backgroundColor: 'var(--ifm-background-surface-color, #0f172a)',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
      }}
      data-testid="embedded-goat-playground"
    >
      {/* Header Bar */}
      {(title || description) && (
        <div
          style={{
            padding: '12px 18px',
            borderBottom: '1px solid var(--ifm-color-emphasis-300, #334155)',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            {title && (
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ifm-color-primary, #38bdf8)' }}>
                🎮 {title}
              </div>
            )}
            {description && (
              <div style={{ fontSize: '11px', color: 'var(--ifm-color-emphasis-600, #94a3b8)', marginTop: '2px' }}>
                {description}
              </div>
            )}
          </div>
          <span
            style={{
              fontSize: '10px',
              padding: '2px 8px',
              borderRadius: '12px',
              backgroundColor: '#6366f1',
              color: '#ffffff',
              fontWeight: 600,
            }}
          >
            Live Interactive Simulator
          </span>
        </div>
      )}

      {/* Main Content Layout */}
      <div
        style={{
          padding: '16px',
          display: 'grid',
          gridTemplateColumns:
            layout === 'split'
              ? 'minmax(320px, 380px) minmax(360px, 1fr)'
              : layout === 'stacked'
              ? '1fr'
              : '1fr',
          gap: '20px',
          alignItems: 'start',
        }}
      >
        {/* Simulator Frame Column */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <DeviceSimulator showControls={showControls} />
        </div>

        {/* Playgrounds & Inspector Column */}
        {layout !== 'preview-only' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <ComponentShowcase />
            {showInspector && <BridgeInspector />}
          </div>
        )}
      </div>
    </div>
  );
};

export const EmbeddedPlayground: React.FC<EmbeddedPlaygroundProps> = (props) => {
  return (
    <SimulatorProvider>
      <EmbeddedPlaygroundInner {...props} />
    </SimulatorProvider>
  );
};

export default EmbeddedPlayground;
