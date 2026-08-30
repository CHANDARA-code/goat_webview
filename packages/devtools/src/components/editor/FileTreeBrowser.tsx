import React, { useState, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileJson,
  FileText,
  Layers,
  Plus,
  FolderPlus,
  Trash2,
  Edit2,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { useDevToolsStore } from '../../store/index.ts';

interface TreeNode {
  name: string;
  fullPath: string;
  type: 'file' | 'directory';
  children?: Record<string, TreeNode>;
}

export function buildFileTree(files: Record<string, string>): Record<string, TreeNode> {
  const root: Record<string, TreeNode> = {};

  Object.keys(files || {}).sort().forEach((filePath) => {
    const parts = filePath.split('/');
    let currentLevel = root;
    let currentPath = '';

    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = index === parts.length - 1;

      if (isFile) {
        currentLevel[part] = {
          name: part,
          fullPath: currentPath,
          type: 'file',
        };
      } else {
        if (!currentLevel[part]) {
          currentLevel[part] = {
            name: part,
            fullPath: currentPath,
            type: 'directory',
            children: {},
          };
        }
        currentLevel = currentLevel[part].children!;
      }
    });
  });

  return root;
}

export const FileTreeBrowser: React.FC = () => {
  const {
    files,
    activeFilePath,
    activeTabId,
    openFile,
    createFile,
    deleteFile,
    renameFile,
  } = useDevToolsStore();

  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    src: true,
    'src/pages': true,
    'src/components': true,
    'src/hooks': true,
    pages: true,
  });

  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const tree = useMemo(() => buildFileTree(files || {}), [files]);

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderPath]: !prev[folderPath],
    }));
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) {
      setIsCreatingFile(false);
      setIsCreatingFolder(false);
      return;
    }

    const cleanPath = newItemName.trim();
    if (isCreatingFile) {
      let initialContent = '';
      if (cleanPath.endsWith('.json')) initialContent = '{\n  \n}\n';
      if (cleanPath.endsWith('.js') || cleanPath.endsWith('.ts')) initialContent = '// Mini-App Logic\n';
      if (cleanPath.endsWith('.tsx')) initialContent = 'import React from "react";\n\nexport const Component = () => {\n  return <div>Component</div>;\n};\n';
      if (cleanPath.endsWith('.vue')) initialContent = '<template>\n  <div>Vue Component</div>\n</template>\n<script setup lang="ts">\n</script>\n';
      if (cleanPath.endsWith('.css')) initialContent = '/* Component Styles */\n';
      if (cleanPath.endsWith('.html') || cleanPath.endsWith('.gxml')) initialContent = '<div class="container">\n  \n</div>\n';
      createFile(cleanPath, initialContent);
    } else if (isCreatingFolder) {
      createFile(`${cleanPath}/.keep`, '');
    }

    setNewItemName('');
    setIsCreatingFile(false);
    setIsCreatingFolder(false);
  };

  const handleRenameSubmit = (oldPath: string, e: React.FormEvent) => {
    e.preventDefault();
    if (renameValue.trim() && renameValue.trim() !== oldPath) {
      renameFile(oldPath, renameValue.trim());
    }
    setRenamingPath(null);
    setRenameValue('');
  };

  const handleDelete = (path: string) => {
    deleteFile(path);
  };

  const renderFileIcon = (filePath: string) => {
    if (filePath.endsWith('.json')) {
      return <FileJson className="w-4 h-4 text-yellow-400 shrink-0" />;
    }
    if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
      return <FileCode className="w-4 h-4 text-amber-300 shrink-0" />;
    }
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      return <FileCode className="w-4 h-4 text-blue-400 shrink-0" />;
    }
    if (filePath.endsWith('.css')) {
      return <FileText className="w-4 h-4 text-sky-400 shrink-0" />;
    }
    if (filePath.endsWith('.html') || filePath.endsWith('.vue')) {
      return <Layers className="w-4 h-4 text-emerald-400 shrink-0" />;
    }
    return <FileText className="w-4 h-4 text-gray-400 shrink-0" />;
  };

  const renderNodes = (nodes: Record<string, TreeNode>, depth = 0) => {
    return Object.values(nodes).map((node) => {
      const isDir = node.type === 'directory';
      const isExpanded = expandedFolders[node.fullPath] ?? false;
      const isSelected = activeFilePath === node.fullPath || activeTabId === node.fullPath;
      const isRenaming = renamingPath === node.fullPath;

      if (isDir) {
        return (
          <div key={node.fullPath} className="flex flex-col">
            <div
              onClick={() => toggleFolder(node.fullPath)}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
              className="flex items-center justify-between py-1 px-2 hover:bg-gray-800/40 dark:hover:bg-gray-800/40 hover:bg-gray-200 cursor-pointer text-xs group"
            >
              <div className="flex items-center space-x-1.5 min-w-0">
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                )}
                {isExpanded ? (
                  <FolderOpen className="w-4 h-4 text-blue-400 shrink-0" />
                ) : (
                  <Folder className="w-4 h-4 text-blue-400 shrink-0" />
                )}
                <span className="truncate font-semibold text-gray-300 dark:text-gray-300 text-gray-700">
                  {node.name}
                </span>
              </div>
            </div>

            {isExpanded && node.children && (
              <div>{renderNodes(node.children, depth + 1)}</div>
            )}
          </div>
        );
      }

      // If File
      return (
        <div
          key={node.fullPath}
          onClick={() => openFile(node.fullPath)}
          style={{ paddingLeft: `${depth * 12 + 20}px` }}
          className={`flex items-center justify-between py-1 px-2 cursor-pointer text-xs font-mono group transition-colors ${
            isSelected
              ? 'bg-blue-900/40 dark:bg-blue-900/40 bg-blue-100 text-blue-400 font-semibold'
              : 'text-gray-300 dark:text-gray-300 text-gray-700 hover:bg-gray-800/30 dark:hover:bg-gray-800/30 hover:bg-gray-200'
          }`}
        >
          {isRenaming ? (
            <form
              onSubmit={(e) => handleRenameSubmit(node.fullPath, e)}
              className="flex-1 mr-2"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="text"
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => setRenamingPath(null)}
                className="w-full bg-gray-900 text-white text-xs px-1.5 py-0.5 rounded border border-blue-500 focus:outline-none"
              />
            </form>
          ) : (
            <div className="flex items-center space-x-1.5 min-w-0">
              {renderFileIcon(node.fullPath)}
              <span className="truncate">{node.name}</span>
            </div>
          )}

          {/* Action buttons (Rename, Delete) */}
          <div className="hidden group-hover:flex items-center space-x-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setRenamingPath(node.fullPath);
                setRenameValue(node.fullPath);
              }}
              className="p-1 rounded hover:bg-gray-700/60 text-gray-400 hover:text-gray-200"
              title="Rename File"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(node.fullPath);
              }}
              className="p-1 rounded hover:bg-gray-700/60 text-gray-400 hover:text-red-400"
              title="Delete File"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="flex flex-col h-full bg-ide-panel-dark dark:bg-ide-panel-dark bg-ide-panel-light select-none">
      {/* Explorer Header */}
      <div className="h-8 border-b border-ide-border-dark dark:border-ide-border-dark border-ide-border-light flex items-center justify-between px-3 text-[11px] font-bold tracking-wider uppercase text-gray-400">
        <span>Project Explorer</span>

        <div className="flex items-center space-x-1">
          <button
            onClick={() => {
              setIsCreatingFile(true);
              setIsCreatingFolder(false);
              setNewItemName('');
            }}
            className="p-1 rounded hover:bg-gray-700/60 text-gray-400 hover:text-gray-200"
            title="New File"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              setIsCreatingFolder(true);
              setIsCreatingFile(false);
              setNewItemName('');
            }}
            className="p-1 rounded hover:bg-gray-700/60 text-gray-400 hover:text-gray-200"
            title="New Folder"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Inline Create Input */}
      {(isCreatingFile || isCreatingFolder) && (
        <form
          onSubmit={handleCreateSubmit}
          className="p-2 border-b border-ide-border-dark dark:border-ide-border-dark border-ide-border-light bg-gray-900/60"
        >
          <div className="text-[10px] text-gray-400 mb-1">
            {isCreatingFile ? 'Create New File (e.g. src/utils.ts)' : 'Create New Folder (e.g. src/components)'}
          </div>
          <div className="flex items-center space-x-1">
            <input
              type="text"
              autoFocus
              placeholder={isCreatingFile ? 'filename.js' : 'folder_name'}
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="flex-1 bg-gray-900 text-white text-xs px-2 py-1 rounded border border-blue-500 focus:outline-none font-mono"
            />
            <button
              type="submit"
              className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded font-semibold"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreatingFile(false);
                setIsCreatingFolder(false);
              }}
              className="px-1.5 py-1 text-gray-400 hover:text-gray-200 text-xs"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* File Tree List */}
      <div className="flex-1 overflow-y-auto py-1">
        {renderNodes(tree)}
      </div>
    </div>
  );
};
