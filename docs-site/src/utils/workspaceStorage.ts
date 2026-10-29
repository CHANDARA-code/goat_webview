export interface WorkspaceLayoutState {
  railCollapsed: boolean;
  activeRailTab: 'files' | 'examples' | 'hardware' | 'settings';
  dockCollapsed: boolean;
  activeDockTab: 'console' | 'inspector' | 'storage' | 'problems';
  dockHeight: number;
  platform: 'ios' | 'android' | 'web';
  device: string;
  deviceColor: string;
  landscape: boolean;
  zoom: number;
  autoRun: boolean;
  fontSize: number;
  wordWrap: boolean;
}

export const DEFAULT_WORKSPACE_LAYOUT: WorkspaceLayoutState = {
  railCollapsed: false,
  activeRailTab: 'files',
  dockCollapsed: false,
  activeDockTab: 'console',
  dockHeight: 220,
  platform: 'ios',
  device: 'iPhone 18 Pro',
  deviceColor: 'black',
  landscape: false,
  zoom: 0,
  autoRun: true,
  fontSize: 13,
  wordWrap: true,
};

export const WORKSPACE_STORAGE_KEY = 'goat_miniapp_workspace_layout_v1';

export function loadWorkspaceLayout(): WorkspaceLayoutState {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { ...DEFAULT_WORKSPACE_LAYOUT };
    }
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_WORKSPACE_LAYOUT };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_WORKSPACE_LAYOUT, ...parsed };
  } catch {
    return { ...DEFAULT_WORKSPACE_LAYOUT };
  }
}

export function saveWorkspaceLayout(state: Partial<WorkspaceLayoutState>): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const current = loadWorkspaceLayout();
    const updated = { ...current, ...state };
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(updated));
  } catch {}
}
