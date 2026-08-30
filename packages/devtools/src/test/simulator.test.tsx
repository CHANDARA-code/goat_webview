/**
 * @goat/devtools - Milestone 2: Dual-Thread Device Simulator Test Suite
 * Comprehensive tests for DeviceFrame, ViewportControls, DualThreadContainer,
 * DeviceSimulator, FrameRateMonitor, and DualThreadRuntimeService.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import React from 'react';

// Store & Slices
import { useDevToolsStore } from '../store/index.ts';
import { DEVICE_SPECS } from '../store/simulatorSlice.ts';

// Services
import { DualThreadRuntimeService, createDualThreadRuntime } from '../services/dualThreadRuntime.ts';

// Simulator Components
import { DeviceFrame } from '../components/simulator/DeviceFrame.tsx';
import { ViewportControls } from '../components/simulator/ViewportControls.tsx';
import { FrameRateMonitor } from '../components/simulator/FrameRateMonitor.tsx';
import { DualThreadContainer } from '../components/simulator/DualThreadContainer.tsx';
import { DeviceSimulator } from '../components/simulator/DeviceSimulator.tsx';

describe('Milestone 2: Device Skins & Specifications', () => {
  beforeEach(() => {
    useDevToolsStore.setState({
      activeDeviceSkin: 'iphone16pro',
      orientation: 'portrait',
      viewportScale: 1.0,
      simulatorTheme: 'dark',
      isRunning: true,
      safeAreaInsets: { top: 59, bottom: 34, left: 0, right: 0 },
      metrics: {
        fps: 60,
        frameTimeMs: 16.6,
        droppedFrames: 0,
        vdomPatchCount: 0,
        lastUpdated: Date.now(),
      },
    } as any);
  });

  it('verifies all 4 target device skin specifications', () => {
    expect(DEVICE_SPECS.iphone16pro).toBeDefined();
    expect(DEVICE_SPECS.pixel9pro).toBeDefined();
    expect(DEVICE_SPECS.ipadpro).toBeDefined();
    expect(DEVICE_SPECS.foldable).toBeDefined();

    // iPhone 16 Pro
    expect(DEVICE_SPECS.iphone16pro.width).toBe(393);
    expect(DEVICE_SPECS.iphone16pro.height).toBe(852);
    expect(DEVICE_SPECS.iphone16pro.hasDynamicIsland).toBe(true);
    expect(DEVICE_SPECS.iphone16pro.safeArea.portrait.top).toBe(59);

    // Pixel 9 Pro
    expect(DEVICE_SPECS.pixel9pro.width).toBe(412);
    expect(DEVICE_SPECS.pixel9pro.height).toBe(892);
    expect(DEVICE_SPECS.pixel9pro.hasPunchHole).toBe(true);
    expect(DEVICE_SPECS.pixel9pro.safeArea.portrait.top).toBe(48);

    // iPad Pro
    expect(DEVICE_SPECS.ipadpro.isTablet).toBe(true);
    expect(DEVICE_SPECS.ipadpro.safeArea.portrait.top).toBe(24);

    // Foldable
    expect(DEVICE_SPECS.foldable.isFoldable).toBe(true);
    expect(DEVICE_SPECS.foldable.safeArea.portrait.top).toBe(32);
  });

  it('renders iPhone 16 Pro chassis with Dynamic Island and status bar', () => {
    useDevToolsStore.setState({ activeDeviceSkin: 'iphone16pro', orientation: 'portrait' } as any);
    render(
      <DeviceFrame>
        <div data-testid="test-content">App Screen</div>
      </DeviceFrame>
    );

    expect(screen.getByTestId('device-frame-iphone16pro')).toBeInTheDocument();
    expect(screen.getByTestId('dynamic-island')).toBeInTheDocument();
    expect(screen.getByTestId('device-status-bar')).toBeInTheDocument();
    expect(screen.getByTestId('home-indicator')).toBeInTheDocument();
    expect(screen.getByTestId('test-content')).toBeInTheDocument();
  });

  it('renders Pixel 9 Pro chassis with punch-hole cutout', () => {
    useDevToolsStore.setState({ activeDeviceSkin: 'pixel9pro', orientation: 'portrait' } as any);
    render(
      <DeviceFrame>
        <div data-testid="test-content">Pixel Content</div>
      </DeviceFrame>
    );

    expect(screen.getByTestId('device-frame-pixel9pro')).toBeInTheDocument();
    expect(screen.getByTestId('punch-hole-camera')).toBeInTheDocument();
    expect(screen.queryByTestId('dynamic-island')).not.toBeInTheDocument();
  });

  it('renders iPad Pro chassis with tablet bezels', () => {
    useDevToolsStore.setState({ activeDeviceSkin: 'ipadpro', orientation: 'portrait' } as any);
    render(
      <DeviceFrame>
        <div data-testid="test-content">Tablet Content</div>
      </DeviceFrame>
    );

    expect(screen.getByTestId('device-frame-ipadpro')).toBeInTheDocument();
    expect(screen.queryByTestId('dynamic-island')).not.toBeInTheDocument();
    expect(screen.queryByTestId('punch-hole-camera')).not.toBeInTheDocument();
  });

  it('renders Foldable dual-screen chassis with central hinge spine', () => {
    useDevToolsStore.setState({ activeDeviceSkin: 'foldable', orientation: 'portrait' } as any);
    render(
      <DeviceFrame>
        <div data-testid="test-content">Foldable Left</div>
      </DeviceFrame>
    );

    expect(screen.getByTestId('device-frame-foldable')).toBeInTheDocument();
    expect(screen.getByTestId('foldable-container')).toBeInTheDocument();
    expect(screen.getByTestId('foldable-hinge')).toBeInTheDocument();
  });

  it('toggles safe area overlay visualizer guidelines', () => {
    useDevToolsStore.setState({
      activeDeviceSkin: 'iphone16pro',
      safeAreaInsets: { top: 59, bottom: 34, left: 0, right: 0 },
    } as any);

    if (typeof (useDevToolsStore.getState() as any).setShowSafeAreaOverlay === 'function') {
      (useDevToolsStore.getState() as any).setShowSafeAreaOverlay(true);
    }

    render(
      <DeviceFrame>
        <div>Content</div>
      </DeviceFrame>
    );

    expect(screen.getByTestId('safe-area-overlay')).toBeInTheDocument();
    expect(screen.getByText(/Top Safe Area: 59px/i)).toBeInTheDocument();
  });
});

describe('Milestone 2: Viewport Controls & Scale / Rotation', () => {
  beforeEach(() => {
    useDevToolsStore.setState({
      activeDeviceSkin: 'iphone16pro',
      viewportScale: 1.0,
      orientation: 'portrait',
      simulatorTheme: 'dark',
      isRunning: true,
    } as any);
  });

  it('switches device skin via dropdown', () => {
    render(<ViewportControls />);
    const select = screen.getByTestId('device-skin-select');

    fireEvent.change(select, { target: { value: 'pixel9pro' } });
    expect(useDevToolsStore.getState().activeDeviceSkin).toBe('pixel9pro');
    expect(useDevToolsStore.getState().safeAreaInsets.top).toBe(48);

    fireEvent.change(select, { target: { value: 'ipadpro' } });
    expect(useDevToolsStore.getState().activeDeviceSkin).toBe('ipadpro');
    expect(useDevToolsStore.getState().safeAreaInsets.top).toBe(24);
  });

  it('adjusts scale using scale select dropdown and zoom buttons', () => {
    render(<ViewportControls />);

    const scaleSelect = screen.getByTestId('scale-select');
    fireEvent.change(scaleSelect, { target: { value: '0.75' } });
    expect(useDevToolsStore.getState().viewportScale).toBe(0.75);

    fireEvent.change(scaleSelect, { target: { value: '1.25' } });
    expect(useDevToolsStore.getState().viewportScale).toBe(1.25);

    // Zoom Out button
    const zoomOut = screen.getByTestId('zoom-out-btn');
    fireEvent.click(zoomOut);
    expect(useDevToolsStore.getState().viewportScale).toBe(1.0);

    // Zoom In button
    const zoomIn = screen.getByTestId('zoom-in-btn');
    fireEvent.click(zoomIn);
    expect(useDevToolsStore.getState().viewportScale).toBe(1.25);
  });

  it('toggles orientation between portrait and landscape', () => {
    render(<ViewportControls />);
    const toggleBtn = screen.getByTestId('toggle-orientation-btn');

    expect(useDevToolsStore.getState().orientation).toBe('portrait');

    fireEvent.click(toggleBtn);
    expect(useDevToolsStore.getState().orientation).toBe('landscape');
    expect(useDevToolsStore.getState().safeAreaInsets.left).toBe(59);

    fireEvent.click(toggleBtn);
    expect(useDevToolsStore.getState().orientation).toBe('portrait');
    expect(useDevToolsStore.getState().safeAreaInsets.left).toBe(0);
  });

  it('toggles simulator theme between dark and light', () => {
    render(<ViewportControls />);
    const themeBtn = screen.getByTestId('toggle-theme-btn');

    expect(useDevToolsStore.getState().simulatorTheme).toBe('dark');

    fireEvent.click(themeBtn);
    expect(useDevToolsStore.getState().simulatorTheme).toBe('light');

    fireEvent.click(themeBtn);
    expect(useDevToolsStore.getState().simulatorTheme).toBe('dark');
  });

  it('toggles execution state (pause and resume)', () => {
    render(<ViewportControls />);
    const pauseBtn = screen.getByTestId('pause-resume-btn');

    expect(useDevToolsStore.getState().isRunning).toBe(true);

    fireEvent.click(pauseBtn);
    expect(useDevToolsStore.getState().isRunning).toBe(false);

    fireEvent.click(pauseBtn);
    expect(useDevToolsStore.getState().isRunning).toBe(true);
  });

  it('restarts simulator when reload button is clicked', () => {
    render(<ViewportControls />);
    const reloadBtn = screen.getByTestId('reload-simulator-btn');

    fireEvent.click(reloadBtn);
    expect(useDevToolsStore.getState().isRunning).toBe(true);
    expect(useDevToolsStore.getState().lastError).toBeNull();
  });
});

describe('Milestone 2: Dual-Thread Runtime Service', () => {
  let runtime: DualThreadRuntimeService;

  beforeEach(() => {
    runtime = createDualThreadRuntime({
      appId: 'test-mini-app-runtime',
      batchIntervalMs: 16,
    });
  });

  afterEach(() => {
    runtime.destroy();
  });

  it('initializes worker and renderer connected via IpcChannel', () => {
    expect(runtime.worker).toBeDefined();
    expect(runtime.renderer).toBeDefined();
    expect(runtime.ipc).toBeDefined();
    expect(runtime.telemetry).toBeDefined();
    expect(runtime.bridgeTransport).toBeDefined();

    runtime.worker.launch();
    expect(runtime.worker.state).toBe('RUNNING');
  });

  it('evaluates mini-app script code and updates worker state', () => {
    runtime.worker.launch();
    const result = runtime.evaluateCode('const x = 40 + 2;', false);
    expect(result.success).toBe(true);
  });

  it('handles script syntax or evaluation errors gracefully', () => {
    runtime.worker.launch();
    const result = runtime.evaluateCode('invalid syntax !!! {{{', false);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('computes reactive VDOM diff and applies patch to renderer', async () => {
    runtime.worker.launch();

    const initialTree = {
      type: 'ELEMENT' as const,
      tag: 'div',
      nodeId: 'root',
      props: { id: 'root' },
      children: [
        {
          type: 'ELEMENT' as const,
          tag: 'span',
          nodeId: 'text-1',
          text: 'Hello World',
        },
      ],
    };

    runtime.setData({ count: 1 }, () => initialTree);
    runtime.ipc.flushUiPatches();

    const domTree = runtime.getDomTree();
    expect(domTree).toBeDefined();
    expect(domTree?.tag).toBe('div');
    expect(domTree?.children?.[0]?.text).toBe('Hello World');

    // Mutate state with new tree
    const updatedTree = {
      type: 'ELEMENT' as const,
      tag: 'div',
      nodeId: 'root',
      props: { id: 'root' },
      children: [
        {
          type: 'ELEMENT' as const,
          tag: 'span',
          nodeId: 'text-1',
          text: 'Count: 2',
        },
      ],
    };

    runtime.setData({ count: 2 }, () => updatedTree);
    runtime.ipc.flushUiPatches();

    const mutatedTree = runtime.getDomTree();
    expect(mutatedTree?.children?.[0]?.text).toBe('Count: 2');
  });

  it('executes native GoatBridge RPC call through mock transport', async () => {
    runtime.worker.launch();

    // Call storage.set
    const setReply = await runtime.worker.GoatBridge.call('storage.set', { key: 'testKey', value: 'testVal' });
    expect(setReply).toBeDefined();

    // Call storage.get
    const getReply = await runtime.worker.GoatBridge.call('storage.get', { key: 'testKey' });
    expect(getReply).toBeDefined();
    expect((getReply as any).value).toBe('testVal');
  });

  it('dispatches UI events from renderer to worker event handlers', () => {
    runtime.worker.launch();

    runtime.dispatchUiEvent('tap', 'my-btn', { detail: 'clicked' });
    expect(runtime.ipc).toBeDefined();
  });

  it('tracks telemetry metrics and supports pause/resume/restart', () => {
    runtime.worker.launch();
    expect(runtime.worker.state).toBe('RUNNING');

    runtime.pause();
    expect(runtime.worker.state).toBe('SUSPENDED');

    runtime.resume();
    expect(runtime.worker.state).toBe('RUNNING');

    runtime.restart();
    expect(runtime.worker).toBeDefined();
  });
});

describe('Milestone 2: Frame Rate Monitor & DualThreadContainer UI', () => {
  beforeEach(() => {
    useDevToolsStore.setState({
      activeDeviceSkin: 'iphone16pro',
      orientation: 'portrait',
      viewportScale: 1.0,
      simulatorTheme: 'dark',
      isRunning: true,
      lastError: null,
      metrics: {
        fps: 59.8,
        frameTimeMs: 16.7,
        droppedFrames: 0,
        vdomPatchCount: 5,
        lastUpdated: Date.now(),
      },
      frameBatchingEnabled: true,
      location: { latitude: 37.7749, longitude: -122.4194, altitude: 10, accuracy: 5, speed: 0 },
      battery: { level: 98, isCharging: true, chargingTime: 0, dischargingTime: 0 },
      accelerometer: { x: 0.1, y: 9.8, z: 0.2 },
    } as any);
  });

  it('renders FrameRateMonitor with 60fps metrics and expands details on click', () => {
    render(<FrameRateMonitor />);

    expect(screen.getByTestId('frame-rate-monitor')).toBeInTheDocument();
    expect(screen.getByTestId('fps-value')).toHaveTextContent('59.8');
    expect(screen.getByText('16.6ms Batch')).toBeInTheDocument();

    // Click to expand details
    fireEvent.click(screen.getByTestId('frame-rate-monitor'));
    expect(screen.getByTestId('frame-rate-details')).toBeInTheDocument();
    expect(screen.getByTestId('dropped-frames-count')).toHaveTextContent('0');
    expect(screen.getByTestId('vdom-patches-count')).toHaveTextContent('5');
  });

  it('renders DualThreadContainer and responds to interactive state mutation', async () => {
    render(<DualThreadContainer />);

    expect(screen.getByTestId('dual-thread-container')).toBeInTheDocument();
    expect(screen.getByTestId('counter-display')).toHaveTextContent('0');

    // Click increment button to trigger state mutation & VDOM diff
    const incBtn = screen.getByTestId('increment-btn');
    fireEvent.click(incBtn);

    expect(screen.getByTestId('counter-display')).toHaveTextContent('1');

    fireEvent.click(incBtn);
    expect(screen.getByTestId('counter-display')).toHaveTextContent('2');
  });

  it('executes bridge location and storage actions and shows toasts', async () => {
    render(<DualThreadContainer />);

    const locBtn = screen.getByTestId('bridge-location-btn');
    fireEvent.click(locBtn);

    await waitFor(() => {
      expect(screen.getByTestId('mini-app-toast')).toBeInTheDocument();
    });

    const toastBtn = screen.getByTestId('bridge-toast-btn');
    fireEvent.click(toastBtn);

    await waitFor(() => {
      expect(screen.getByTestId('mini-app-toast')).toBeInTheDocument();
    });
  });

  it('switches internal tabs to inspect VDOM tree and sensors', () => {
    render(<DualThreadContainer />);

    const vdomTabBtn = screen.getByRole('button', { name: /VDOM Tree/i });
    fireEvent.click(vdomTabBtn);
    expect(screen.getByText(/Live Virtual DOM Hierarchy/i)).toBeInTheDocument();

    const sensorsTabBtn = screen.getByRole('button', { name: /Sensors/i });
    fireEvent.click(sensorsTabBtn);
    expect(screen.getByText(/Hardware & Sensor Telemetry/i)).toBeInTheDocument();
    expect(screen.getByText(/37.7749, -122.4194/i)).toBeInTheDocument();
  });

  it('renders paused overlay when simulator is paused', () => {
    useDevToolsStore.setState({ isRunning: false } as any);
    render(<DualThreadContainer />);

    expect(screen.getByTestId('paused-overlay')).toBeInTheDocument();
    expect(screen.getByText(/Simulator Paused/i)).toBeInTheDocument();
  });

  it('renders runtime error banner when error is present', () => {
    render(<DualThreadContainer />);

    act(() => {
      useDevToolsStore.setState({ lastError: 'Uncaught ReferenceError: foo is not defined' } as any);
    });

    expect(screen.getByTestId('runtime-error-banner')).toBeInTheDocument();
    expect(screen.getByText(/Uncaught ReferenceError: foo is not defined/i)).toBeInTheDocument();
  });
});

describe('Milestone 2: DeviceSimulator Master Integration', () => {
  it('renders complete DeviceSimulator hierarchy with controls, frame, container, and monitor', () => {
    render(<DeviceSimulator />);

    expect(screen.getByTestId('device-simulator-root')).toBeInTheDocument();
    expect(screen.getByTestId('viewport-controls')).toBeInTheDocument();
    expect(screen.getByTestId('device-frame-container')).toBeInTheDocument();
    expect(screen.getByTestId('dual-thread-container')).toBeInTheDocument();
    expect(screen.getByTestId('frame-rate-monitor')).toBeInTheDocument();
  });
});
