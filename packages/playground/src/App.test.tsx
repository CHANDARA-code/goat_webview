/**
 * @goat/playground — App integration tests
 * 8 tests covering all major UI regions and interactions.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Monaco editor is heavy; stub it so tests run in jsdom without issues.
// ---------------------------------------------------------------------------
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }: { value: string; onChange?: (v: string) => void }) => (
    <textarea
      data-testid="monaco-editor"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      aria-label="Monaco editor"
    />
  ),
}));

import { App } from './App.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function renderApp() {
  return render(<App />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('@goat/playground App', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  // 1. Renders "Goat Playground" heading
  it('renders Goat Playground heading', () => {
    renderApp();
    expect(screen.getByTestId('app-heading')).toHaveTextContent('Goat Playground');
  });

  // 2. Renders the Monaco editor area
  it('renders the Monaco editor area', () => {
    renderApp();
    expect(screen.getByTestId('editor-pane')).toBeInTheDocument();
    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
  });

  // 3. Renders the DeviceFrame
  it('renders the DeviceFrame', () => {
    renderApp();
    expect(screen.getByTestId('device-frame')).toBeInTheDocument();
  });

  // 4. All 6 component showcase cards are present
  it('renders all 6 component showcase cards', () => {
    renderApp();
    const cards = [
      'GoatNavigationBar',
      'GoatBottomSheet',
      'GoatHaptics',
      'GoatBiometrics',
      'GoatPermissionPriming',
      'GoatStorage',
    ];
    for (const name of cards) {
      expect(
        screen.getByTestId(`showcase-card-${name}`),
        `Expected showcase card for ${name}`
      ).toBeInTheDocument();
    }
  });

  // 5. Clicking a showcase card calls the bridge and adds a trace to BridgeTracePanel
  it('clicking a showcase card button calls the bridge and adds a trace', async () => {
    renderApp();

    // Initially the trace panel shows empty state
    expect(screen.getByTestId('bridge-trace-empty')).toBeInTheDocument();

    // Click the "Set Title" button on GoatNavigationBar card
    const btn = screen.getByTestId('showcase-btn-NAV_BAR_SET_TITLE');
    fireEvent.click(btn);

    // Advance the synthetic latency timer
    await act(async () => {
      vi.runAllTimers();
    });

    // The empty state should be gone and at least one trace item should appear
    await waitFor(() => {
      expect(screen.queryByTestId('bridge-trace-empty')).not.toBeInTheDocument();
      expect(screen.getByTestId('bridge-trace-item')).toBeInTheDocument();
    });
  });

  // 6. MockControlPanel renders with all controls (biometrics, GPS, network, battery, theme)
  it('MockControlPanel renders all controls', async () => {
    renderApp();

    // Switch to Mock Controls tab
    fireEvent.click(screen.getByTestId('tab-controls'));

    await waitFor(() => {
      expect(screen.getByTestId('mock-control-panel')).toBeInTheDocument();
      // Biometrics toggle group
      expect(screen.getByTestId('toggle-biometrics-success')).toBeInTheDocument();
      expect(screen.getByTestId('toggle-biometrics-fail')).toBeInTheDocument();
      expect(screen.getByTestId('toggle-biometrics-locked')).toBeInTheDocument();
      // GPS inputs
      expect(screen.getByTestId('gps-lat-input')).toBeInTheDocument();
      expect(screen.getByTestId('gps-lng-input')).toBeInTheDocument();
      // Network selector
      expect(screen.getByTestId('network-select')).toBeInTheDocument();
      // Battery slider
      expect(screen.getByTestId('battery-slider')).toBeInTheDocument();
      // Theme toggle
      expect(screen.getByTestId('toggle-theme-light')).toBeInTheDocument();
      expect(screen.getByTestId('toggle-theme-dark')).toBeInTheDocument();
    });
  });

  // 7. BridgeTracePanel shows empty state initially then traces after calls
  it('BridgeTracePanel starts empty then shows traces', async () => {
    renderApp();

    // Initially empty
    expect(screen.getByTestId('bridge-trace-panel')).toBeInTheDocument();
    expect(screen.getByTestId('bridge-trace-empty')).toBeInTheDocument();

    // Make a bridge call via the showcase
    const btn = screen.getByTestId('showcase-btn-BIOMETRIC_AUTH');
    fireEvent.click(btn);

    await act(async () => {
      vi.runAllTimers();
    });

    // Trace panel should now show a trace item
    await waitFor(() => {
      expect(screen.queryByTestId('bridge-trace-empty')).not.toBeInTheDocument();
    });

    // Clear traces
    fireEvent.click(screen.getByRole('button', { name: /clear bridge traces/i }));

    await waitFor(() => {
      expect(screen.getByTestId('bridge-trace-empty')).toBeInTheDocument();
    });
  });

  // 8. Platform toggle switches between iOS and Android frame
  it('platform toggle switches DeviceFrame between iOS and Android', async () => {
    renderApp();

    // Default platform is iOS — dynamic island bar should be visible
    const frame = screen.getByTestId('device-frame');
    expect(frame).toHaveAttribute('data-platform', 'ios');
    expect(screen.getByTestId('dynamic-island-bar')).toBeInTheDocument();

    // Switch to Mock Controls tab
    fireEvent.click(screen.getByTestId('tab-controls'));

    await waitFor(() => {
      expect(screen.getByTestId('mock-control-panel')).toBeInTheDocument();
    });

    // Toggle platform to Android
    fireEvent.click(screen.getByTestId('toggle-platform-android'));

    await waitFor(() => {
      expect(screen.getByTestId('device-frame')).toHaveAttribute('data-platform', 'android');
      expect(screen.getByTestId('punchhole-camera-bar')).toBeInTheDocument();
      expect(screen.queryByTestId('dynamic-island-bar')).not.toBeInTheDocument();
    });
  });
});
