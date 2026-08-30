/**
 * @goat/devtools - Workspace Zustand Slice
 */

import type { StateCreator } from "zustand";
import type {
  WorkspaceSlice,
  DevToolsStore,
  ThemeMode,
  EditorTab,
  Tab,
  FileNode,
  ValidationMarker,
  ActiveSidebarView,
  ActiveDebuggerTab,
  PanelSizes,
  PanelCollapseState,
} from "../types/index.ts";
import {
  buildFileTreeFromMap,
  flattenTreeToMap,
  createFile as fsCreateFile,
  createFolder as fsCreateFolder,
  deleteNode as fsDeleteNode,
  renameNode as fsRenameNode,
  getLanguageFromPath,
} from "../services/virtualFsService.ts";
import {
  TEMPLATES,
  getTemplateById,
  getDefaultTemplate,
  REACT_TEMPLATE,
  VUE_TEMPLATE,
  VANILLA_TEMPLATE,
} from "../services/templates/index.ts";
import {
  VANILLA_TEMPLATE_FILES,
  REACT_TEMPLATE_FILES,
  VUE_TEMPLATE_FILES,
} from "./initialFiles.ts";

function getFileName(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1] || path;
}

export const createWorkspaceSlice: StateCreator<DevToolsStore, [], [], any> = (
  set,
  get,
) => {
  const initialFiles = { ...VANILLA_TEMPLATE_FILES };
  const initialTree = buildFileTreeFromMap(initialFiles);
  const initialTab: Tab = {
    id: "manifest.json",
    filePath: "manifest.json",
    title: "manifest.json",
    isDirty: false,
    language: "json",
  };

  return {
    theme: "dark",
    panelSizes: {
      sidebarWidth: 260,
      simulatorWidth: 420,
      debuggerHeight: 280,
    },
    collapsedPanels: {
      sidebar: false,
      simulator: false,
      debugger: false,
    },
    isLeftSidebarOpen: true,
    isBottomDebuggerOpen: true,
    isRightSimulatorOpen: true,
    leftSidebarWidth: 260,
    bottomDebuggerHeight: 280,
    rightSimulatorWidth: 420,
    activeSidebarView: "explorer",
    activeDebuggerTab: "console",
    activeLeftTab: "files",
    activeBottomTab: "console",
    files: initialFiles,
    fileTree: initialTree,
    activeFilePath: "manifest.json",
    openTabs: [initialTab],
    activeTabId: initialTab.id,
    activeTemplate: "vanilla",
    activeTemplateId: "vanilla",
    isTemplateModalOpen: false,
    validationMarkers: [],

    setTheme: (theme: ThemeMode) => {
      set({ theme });
      if (typeof document !== "undefined") {
        if (theme === "dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      }
    },

    toggleTheme: () => {
      const next = get().theme === "dark" ? "light" : "dark";
      get().setTheme(next);
    },

    setPanelSizes: (sizes: Partial<PanelSizes>) => {
      set((state: any) => {
        const nextSizes = { ...state.panelSizes, ...sizes };
        return {
          panelSizes: nextSizes,
          leftSidebarWidth: sizes.sidebarWidth ?? state.leftSidebarWidth,
          rightSimulatorWidth:
            sizes.simulatorWidth ?? state.rightSimulatorWidth,
          simulatorWidth: sizes.simulatorWidth ?? state.rightSimulatorWidth,
          bottomDebuggerHeight:
            sizes.debuggerHeight ?? state.bottomDebuggerHeight,
          debuggerHeight: sizes.debuggerHeight ?? state.bottomDebuggerHeight,
        };
      });
    },

    togglePanelCollapse: (panel: keyof PanelCollapseState) => {
      set((state: any) => {
        const next = !state.collapsedPanels[panel];
        const nextCollapsed = { ...state.collapsedPanels, [panel]: next };
        return {
          collapsedPanels: nextCollapsed,
          isLeftSidebarOpen: !nextCollapsed.sidebar,
          isBottomDebuggerOpen: !nextCollapsed.debugger,
          isRightSimulatorOpen: !nextCollapsed.simulator,
        };
      });
    },

    setLeftSidebarOpen: (open: boolean) => {
      set((state: any) => ({
        collapsedPanels: { ...state.collapsedPanels, sidebar: !open },
        isLeftSidebarOpen: open,
      }));
    },

    setBottomDebuggerOpen: (open: boolean) => {
      set((state: any) => ({
        collapsedPanels: { ...state.collapsedPanels, debugger: !open },
        isBottomDebuggerOpen: open,
      }));
    },

    setRightSimulatorOpen: (open: boolean) => {
      set((state: any) => ({
        collapsedPanels: { ...state.collapsedPanels, simulator: !open },
        isRightSimulatorOpen: open,
      }));
    },

    toggleLeftSidebar: () => {
      set((state: any) => {
        const next = !state.isLeftSidebarOpen;
        return {
          isLeftSidebarOpen: next,
          collapsedPanels: { ...state.collapsedPanels, sidebar: !next },
        };
      });
    },

    toggleBottomDebugger: () => {
      set((state: any) => {
        const next = !state.isBottomDebuggerOpen;
        return {
          isBottomDebuggerOpen: next,
          collapsedPanels: { ...state.collapsedPanels, debugger: !next },
        };
      });
    },

    toggleRightSimulator: () => {
      set((state: any) => {
        const next = !state.isRightSimulatorOpen;
        return {
          isRightSimulatorOpen: next,
          collapsedPanels: { ...state.collapsedPanels, simulator: !next },
        };
      });
    },

    setLeftSidebarWidth: (width: number) => {
      const w = Math.max(160, Math.min(600, width));
      set({ leftSidebarWidth: w });
      get().setPanelSizes({ sidebarWidth: w });
    },

    setBottomDebuggerHeight: (height: number) => {
      const h = Math.max(120, Math.min(800, height));
      set({ bottomDebuggerHeight: h });
      get().setPanelSizes({ debuggerHeight: h });
    },

    setRightSimulatorWidth: (width: number) => {
      const w = Math.max(300, Math.min(900, width));
      set({ rightSimulatorWidth: w });
      get().setPanelSizes({ simulatorWidth: w });
    },

    setActiveSidebarView: (activeSidebarView: ActiveSidebarView) =>
      set({ activeSidebarView }),
    setActiveLeftTab: (activeLeftTab: any) => set({ activeLeftTab }),
    setActiveDebuggerTab: (activeDebuggerTab: ActiveDebuggerTab) =>
      set({ activeDebuggerTab }),
    setActiveBottomTab: (activeBottomTab: any) => set({ activeBottomTab }),

    setValidationMarkers: (validationMarkers: ValidationMarker[]) =>
      set({ validationMarkers }),

    setFiles: (files: Record<string, string>) => {
      const fileTree = buildFileTreeFromMap(files);
      set({ files, fileTree });
    },

    createFile: (path: string, content = "") => {
      set((state: any) => {
        const nextFiles = { ...state.files, [path]: content };
        const nextTree = fsCreateFile(state.fileTree, path, content);
        return { files: nextFiles, fileTree: nextTree };
      });
      get().openFile(path);
    },

    createFolder: (path: string) => {
      set((state: any) => {
        const nextTree = fsCreateFolder(state.fileTree, path);
        const nextFiles = flattenTreeToMap(nextTree);
        return { fileTree: nextTree, files: nextFiles };
      });
    },

    updateFileContent: (path: string, content: string) => {
      set((state: any) => {
        const nextFiles = { ...state.files, [path]: content };
        const nextTree = fsCreateFile(state.fileTree, path, content);
        const nextTabs = state.openTabs.map((tab: any) =>
          tab.filePath === path || tab.id === path
            ? { ...tab, isDirty: true }
            : tab,
        );
        return { files: nextFiles, fileTree: nextTree, openTabs: nextTabs };
      });
    },

    deleteFile: (path: string) => {
      set((state: any) => {
        const nextFiles = { ...state.files };
        delete nextFiles[path];
        const nextTree = fsDeleteNode(state.fileTree, path);
        const nextTabs = state.openTabs.filter(
          (tab: any) => tab.filePath !== path && tab.id !== path,
        );
        let nextActiveTabId = state.activeTabId;
        let nextActiveFilePath = state.activeFilePath;

        if (state.activeFilePath === path || state.activeTabId === path) {
          const fallbackTab = nextTabs[nextTabs.length - 1];
          nextActiveTabId = fallbackTab ? fallbackTab.id : null;
          nextActiveFilePath = fallbackTab ? fallbackTab.filePath : null;
        }

        return {
          fileTree: nextTree,
          files: nextFiles,
          openTabs: nextTabs,
          activeTabId: nextActiveTabId,
          activeFilePath: nextActiveFilePath,
        };
      });
    },

    deleteNode: (path: string) => {
      get().deleteFile(path);
    },

    deleteFileOrFolder: (path: string) => {
      get().deleteFile(path);
    },

    renameFile: (oldPath: string, newPath: string) => {
      if (oldPath === newPath) return;
      set((state: any) => {
        const content = state.files[oldPath] || "";
        const nextFiles = { ...state.files };
        delete nextFiles[oldPath];
        nextFiles[newPath] = content;

        const nextTree = fsRenameNode(state.fileTree, oldPath, newPath);

        const nextTabs = state.openTabs.map((tab: any) => {
          if (tab.filePath === oldPath || tab.id === oldPath) {
            return {
              ...tab,
              id: newPath,
              filePath: newPath,
              title: getFileName(newPath),
              language: getLanguageFromPath(newPath),
            };
          }
          if (tab.filePath.startsWith(`${oldPath}/`)) {
            const updated = tab.filePath.replace(oldPath, newPath);
            return {
              ...tab,
              id: updated,
              filePath: updated,
              title: getFileName(updated),
              language: getLanguageFromPath(updated),
            };
          }
          return tab;
        });

        let nextActiveTabId = state.activeTabId;
        let nextActiveFilePath = state.activeFilePath;
        if (state.activeFilePath === oldPath || state.activeTabId === oldPath) {
          nextActiveFilePath = newPath;
          nextActiveTabId = newPath;
        }

        return {
          fileTree: nextTree,
          files: nextFiles,
          openTabs: nextTabs,
          activeTabId: nextActiveTabId,
          activeFilePath: nextActiveFilePath,
        };
      });
    },

    renameNode: (oldPath: string, newPath: string) => {
      get().renameFile(oldPath, newPath);
    },

    renameFileOrFolder: (oldPath: string, newPath: string) => {
      get().renameFile(oldPath, newPath);
    },

    openFile: (filePath: string) => {
      const state = get();
      const existing = state.openTabs.find(
        (t: any) => t.filePath === filePath || t.id === filePath,
      );
      if (existing) {
        set({ activeTabId: existing.id, activeFilePath: existing.filePath });
        return;
      }

      const newTab: Tab = {
        id: filePath,
        filePath,
        title: getFileName(filePath),
        isDirty: false,
        language: getLanguageFromPath(filePath),
      };

      if (
        state.openTabs.length === 1 &&
        state.openTabs[0].id === "manifest.json" &&
        !state.openTabs[0].isDirty &&
        filePath !== "manifest.json"
      ) {
        set({
          openTabs: [newTab],
          activeTabId: newTab.id,
          activeFilePath: filePath,
        });
        return;
      }

      set({
        openTabs: [...state.openTabs, newTab],
        activeTabId: newTab.id,
        activeFilePath: filePath,
      });
    },

    closeTab: (tabId: string) => {
      set((state: any) => {
        const index = state.openTabs.findIndex(
          (t: any) => t.id === tabId || t.filePath === tabId,
        );
        if (index === -1) return state;

        const nextTabs = state.openTabs.filter(
          (t: any) => t.id !== tabId && t.filePath !== tabId,
        );
        let nextActiveTabId = state.activeTabId;
        let nextActiveFilePath = state.activeFilePath;

        if (state.activeTabId === tabId || state.activeFilePath === tabId) {
          const nextTab = nextTabs[index] || nextTabs[index - 1] || null;
          nextActiveTabId = nextTab ? nextTab.id : null;
          nextActiveFilePath = nextTab ? nextTab.filePath : null;
        }

        return {
          openTabs: nextTabs,
          activeTabId: nextActiveTabId,
          activeFilePath: nextActiveFilePath,
        };
      });
    },

    setActiveTab: (tabId: string) => {
      const state = get();
      const tab = state.openTabs.find(
        (t: any) => t.id === tabId || t.filePath === tabId,
      );
      if (tab) {
        set({ activeTabId: tab.id, activeFilePath: tab.filePath });
      }
    },

    closeAllTabs: () => {
      set({ openTabs: [], activeTabId: null, activeFilePath: null });
    },

    closeOtherTabs: (tabId: string) => {
      set((state: any) => {
        const remaining = state.openTabs.filter(
          (t: any) => t.id === tabId || t.filePath === tabId,
        );
        const activeTab = remaining[0] || null;
        return {
          openTabs: remaining,
          activeTabId: activeTab ? activeTab.id : null,
          activeFilePath: activeTab ? activeTab.filePath : null,
        };
      });
    },

    markTabDirty: (tabId: string, isDirty: boolean) => {
      set((state: any) => ({
        openTabs: state.openTabs.map((t: any) =>
          t.id === tabId || t.filePath === tabId ? { ...t, isDirty } : t,
        ),
      }));
    },

    loadTemplate: (templateId: string) => {
      const normalized = (templateId || "").toLowerCase();
      let tmpl = getTemplateById(templateId);

      if (!tmpl) {
        if (normalized.includes("vue")) tmpl = VUE_TEMPLATE;
        else if (normalized.includes("vanilla")) tmpl = VANILLA_TEMPLATE;
        else tmpl = REACT_TEMPLATE;
      }

      let templateFiles = tmpl.files;
      if (normalized === "vanilla" || normalized === "vanilla-js") {
        templateFiles = { ...VANILLA_TEMPLATE_FILES };
      } else if (
        normalized === "react" ||
        normalized === "react-19" ||
        normalized === "react-18"
      ) {
        templateFiles = { ...REACT_TEMPLATE_FILES, ...tmpl.files };
      } else if (
        normalized === "vue" ||
        normalized === "vue-3.5" ||
        normalized === "vue-3"
      ) {
        templateFiles = { ...VUE_TEMPLATE_FILES, ...tmpl.files };
      }

      const files = { ...templateFiles };
      const fileTree = buildFileTreeFromMap(files);
      const entryFile = tmpl.entryFile || "manifest.json";

      const initialTab: Tab = {
        id: entryFile,
        filePath: entryFile,
        title: getFileName(entryFile),
        isDirty: false,
        language: getLanguageFromPath(entryFile),
      };

      const baseFramework =
        tmpl.framework ||
        (normalized.includes("react")
          ? "react"
          : normalized.includes("vue")
            ? "vue"
            : "vanilla");

      set({
        files,
        fileTree,
        activeTemplateId: tmpl.id,
        activeTemplate: baseFramework,
        openTabs: [initialTab],
        activeTabId: initialTab.id,
        activeFilePath: entryFile,
        isTemplateModalOpen: false,
      });
    },

    setTemplateModalOpen: (isTemplateModalOpen: boolean) =>
      set({ isTemplateModalOpen }),

    resetWorkspace: () => {
      const tmpl = VANILLA_TEMPLATE;
      const files = { ...VANILLA_TEMPLATE_FILES };
      const fileTree = buildFileTreeFromMap(files);
      const initialTab: Tab = {
        id: "manifest.json",
        filePath: "manifest.json",
        title: "manifest.json",
        isDirty: false,
        language: "json",
      };
      set({
        theme: "dark",
        collapsedPanels: {
          sidebar: false,
          simulator: false,
          debugger: false,
        },
        isLeftSidebarOpen: true,
        isBottomDebuggerOpen: true,
        isRightSimulatorOpen: true,
        leftSidebarWidth: 260,
        bottomDebuggerHeight: 280,
        rightSimulatorWidth: 420,
        activeSidebarView: "explorer",
        activeDebuggerTab: "console",
        activeLeftTab: "files",
        activeBottomTab: "console",
        files,
        fileTree,
        activeTemplateId: tmpl.id,
        activeTemplate: "vanilla",
        openTabs: [initialTab],
        activeTabId: initialTab.id,
        activeFilePath: "manifest.json",
        isTemplateModalOpen: false,
        validationMarkers: [],
      });
      get().resetSensors?.();
    },
  };
};
