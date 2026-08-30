/**
 * @goat/devtools - Workspace Type Definitions
 */

export type Theme = 'dark' | 'light';

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

export interface Tab {
  id: string;
  filePath: string;
  title: string;
  isDirty?: boolean;
  isPinned?: boolean;
  language?: string;
}

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

export type ActiveSidebarView = 'explorer' | 'templates' | 'simulator' | 'sensors' | 'debugger' | 'packaging' | 'settings';
export type ActiveDebuggerTab = 'console' | 'waterfall' | 'elements' | 'storage' | 'network';
