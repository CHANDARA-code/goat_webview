/**
 * @goat/devtools - IDE & Workspace Type Definitions
 */

export type Theme = 'dark' | 'light';
export type ThemeMode = 'dark' | 'light';

export interface FileItem {
  name: string;
  path: string;
  content: string;
  language: string;
  isReadonly?: boolean;
}

export interface FileNode {
  id: string;
  name: string;
  path: string;
  isDirectory: boolean;
  content?: string;
  children?: FileNode[];
  isOpen?: boolean;
  isModified?: boolean;
  isReadonly?: boolean;
}

export interface EditorTab {
  id: string;
  filePath: string;
  title: string;
  isDirty?: boolean;
  isPinned?: boolean;
  language?: string;
}

export interface Tab extends EditorTab {}

export interface ValidationMarker {
  filePath: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  source?: string;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  framework: 'react' | 'vue' | 'vanilla';
  version: string;
  icon: string;
  entryFile: string;
  files: Record<string, string>;
  dependencies?: Record<string, string>;
}

export interface PanelSizes {
  sidebarWidth: number;
  simulatorWidth: number;
  debuggerHeight: number;
}

export interface PanelCollapseState {
  sidebar: boolean;
  simulator: boolean;
  debugger: boolean;
}

export type ActiveSidebarView =
  | 'explorer'
  | 'files'
  | 'templates'
  | 'simulator'
  | 'sensors'
  | 'debugger'
  | 'packaging'
  | 'settings'
  | 'storage';

export type ActiveDebuggerTab =
  | 'console'
  | 'waterfall'
  | 'bridge'
  | 'elements'
  | 'storage'
  | 'sources'
  | 'network';

export interface WorkspaceSlice {
  theme: ThemeMode;
  isLeftSidebarOpen: boolean;
  isBottomDebuggerOpen: boolean;
  isRightSimulatorOpen: boolean;
  leftSidebarWidth: number;
  bottomDebuggerHeight: number;
  rightSimulatorWidth: number;
  activeLeftTab: ActiveSidebarView;
  activeBottomTab: ActiveDebuggerTab;
  files: Record<string, string>;
  fileTree?: FileNode[];
  activeFilePath: string | null;
  openTabs: EditorTab[];
  activeTabId: string | null;
  activeTemplate: string;
  activeTemplateId: string;
  isTemplateModalOpen: boolean;
  validationMarkers?: ValidationMarker[];
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setLeftSidebarOpen: (open: boolean) => void;
  setBottomDebuggerOpen: (open: boolean) => void;
  setRightSimulatorOpen: (open: boolean) => void;
  toggleLeftSidebar: () => void;
  toggleBottomDebugger: () => void;
  toggleRightSimulator: () => void;
  setLeftSidebarWidth: (width: number) => void;
  setBottomDebuggerHeight: (height: number) => void;
  setRightSimulatorWidth: (width: number) => void;
  setActiveLeftTab: (tab: ActiveSidebarView) => void;
  setActiveBottomTab: (tab: ActiveDebuggerTab) => void;
  setFiles: (files: Record<string, string>) => void;
  createFile: (path: string, content?: string) => void;
  updateFileContent: (path: string, content: string) => void;
  deleteFile: (path: string) => void;
  deleteFileOrFolder?: (path: string) => void;
  renameFile: (oldPath: string, newPath: string) => void;
  renameFileOrFolder?: (oldPath: string, newPath: string) => void;
  openFile: (path: string) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  closeAllTabs: () => void;
  closeOtherTabs: (tabId: string) => void;
  markTabDirty: (tabId: string, isDirty: boolean) => void;
  loadTemplate: (template: string) => void;
  setTemplateModalOpen: (open: boolean) => void;
  resetWorkspace: () => void;
  setValidationMarkers?: (markers: ValidationMarker[]) => void;
}
