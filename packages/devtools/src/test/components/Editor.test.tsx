import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../../App.tsx';
import { HeaderToolbar } from '../../components/layout/HeaderToolbar.tsx';
import { StatusBar } from '../../components/layout/StatusBar.tsx';
import { TabBar } from '../../components/editor/TabBar.tsx';
import { FileTreeBrowser } from '../../components/editor/FileTreeBrowser.tsx';
import { TemplateSwitcherModal } from '../../components/editor/TemplateSwitcherModal.tsx';
import { useDevToolsStore } from '../../store/useDevToolsStore.ts';

describe('Goat DevTools Studio Components & Shell', () => {
  beforeEach(() => {
    useDevToolsStore.getState().resetWorkspace();
  });

  it('renders the complete DevTools Studio App shell cleanly', () => {
    const { container } = render(<App />);
    expect(container).toBeInTheDocument();
    expect(screen.getByText(/Goat Studio/i)).toBeInTheDocument();
    expect(screen.getByText(/Goat Dual-Thread Engine/i)).toBeInTheDocument();
  });

  it('renders HeaderToolbar with controls and handles theme toggle', () => {
    render(<HeaderToolbar />);
    expect(screen.getByText(/Goat Studio/i)).toBeInTheDocument();
    expect(screen.getByText(/Hot Reload/i)).toBeInTheDocument();

    const initialTheme = useDevToolsStore.getState().theme;
    const themeBtn = screen.getByTitle(new RegExp(`Switch to ${initialTheme === 'dark' ? 'Light' : 'Dark'} Theme`, 'i'));
    fireEvent.click(themeBtn);

    expect(useDevToolsStore.getState().theme).not.toBe(initialTheme);
  });

  it('renders StatusBar with diagnostic indicators and bridge count', () => {
    render(<StatusBar />);
    expect(screen.getByText(/203 Actions Active/i)).toBeInTheDocument();
    expect(screen.getByText(/60 FPS/i)).toBeInTheDocument();
    expect(screen.getByText(/Schema Valid/i)).toBeInTheDocument();
  });

  it('renders TabBar and allows closing tabs and switching tabs', () => {
    useDevToolsStore.getState().openFile('src/main.js');
    useDevToolsStore.getState().openFile('manifest.json');

    render(<TabBar />);
    expect(screen.getByText('manifest.json')).toBeInTheDocument();
    expect(screen.getByText('main.js')).toBeInTheDocument();

    // Click on main.js tab
    const mainJsTab = screen.getByText('main.js');
    fireEvent.click(mainJsTab);
    expect(useDevToolsStore.getState().activeFilePath).toBe('src/main.js');
  });

  it('renders FileTreeBrowser and allows file CRUD operations', () => {
    render(<FileTreeBrowser />);
    expect(screen.getByText(/Project Explorer/i)).toBeInTheDocument();
    expect(screen.getByText('manifest.json')).toBeInTheDocument();

    // Create new file
    const newFileBtn = screen.getByTitle('New File');
    fireEvent.click(newFileBtn);

    const input = screen.getByPlaceholderText('filename.js');
    fireEvent.change(input, { target: { value: 'pages/custom/custom.js' } });
    fireEvent.click(screen.getByText('Add'));

    expect(useDevToolsStore.getState().files['pages/custom/custom.js']).toBeDefined();
    expect(useDevToolsStore.getState().activeFilePath).toBe('pages/custom/custom.js');
  });

  it('switches templates in TemplateSwitcherModal', () => {
    useDevToolsStore.getState().setTemplateModalOpen(true);
    render(<TemplateSwitcherModal />);

    expect(screen.getByText(/Select Mini-App Template/i)).toBeInTheDocument();
    expect(screen.getAllByText(/React.*Mini-App/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Vue.*Mini-App/i).length).toBeGreaterThan(0);

    // Switch to React template
    const reactCard = screen.getAllByText(/React.*Mini-App/i)[0];
    fireEvent.click(reactCard);

    expect(useDevToolsStore.getState().activeTemplate).toBe('react');
    expect(useDevToolsStore.getState().files['src/App.tsx']).toBeDefined();
  });

  it('updates network throttling presets in store', () => {
    useDevToolsStore.getState().setNetworkPreset('3g');
    expect(useDevToolsStore.getState().networkThrottling.latencyMs).toBe(150);

    useDevToolsStore.getState().setNetworkPreset('offline');
    expect(useDevToolsStore.getState().networkThrottling.isOffline).toBe(true);
  });

  it('updates device skins and orientations in store', () => {
    useDevToolsStore.getState().setActiveDeviceSkin('pixel9pro');
    expect(useDevToolsStore.getState().activeDeviceSkin).toBe('pixel9pro');
    expect(useDevToolsStore.getState().safeAreaInsets.top).toBe(48);

    useDevToolsStore.getState().toggleOrientation();
    expect(useDevToolsStore.getState().orientation).toBe('landscape');
  });
});
