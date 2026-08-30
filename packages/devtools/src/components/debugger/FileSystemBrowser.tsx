/**
 * @goat/devtools - Sandboxed FileSystem Browser Component
 * Visual Sandboxed FileSystem explorer showing directory tree, file metadata (size, mtime, permissions),
 * and interactive file previewer (text, JSON, image, binary).
 */

import React, { useState } from 'react';
import { useDevToolsStore } from '../../store/index.ts';
import {
  FolderTree,
  Folder,
  FolderOpen,
  File,
  FileCode,
  FileText,
  FileImage,
  Database,
  Plus,
  Trash2,
  Download,
  Eye,
  Search,
  ChevronRight,
  ChevronDown,
  HardDrive,
  Clock,
  Sparkles,
} from 'lucide-react';

interface FsEntry {
  name: string;
  type?: string;
  size?: number;
  mtime?: number;
  content?: string;
  isDir?: boolean;
}

export const FileSystemBrowser: React.FC = () => {
  const {
    storageData = { kvStore: {}, sqliteTables: {}, fsTree: {} },
    setFsTree,
    setFsItem,
    deleteFsItem,
  } = useDevToolsStore();

  const [currentPath, setCurrentPath] = useState<string>('/data/user/files');
  const [selectedFile, setSelectedFile] = useState<FsEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileContent, setNewFileContent] = useState('');

  const fsTree = storageData.fsTree || {
    '/data/user/files': [
      {
        name: 'avatar.png',
        type: 'image/png',
        size: 24576,
        mtime: Date.now() - 3600000,
      },
      {
        name: 'app_config.json',
        type: 'application/json',
        size: 512,
        mtime: Date.now() - 60000,
        content: '{\n  "theme": "dark",\n  "debug": true,\n  "logLevel": "verbose"\n}',
      },
      {
        name: 'readme.txt',
        type: 'text/plain',
        size: 180,
        mtime: Date.now() - 86400000,
        content: 'Welcome to Goat Mini-App Sandboxed File System.\nAll files in /data/user are isolated per-app.',
      },
    ],
    '/data/user/storage': [
      {
        name: 'cache_manifest.json',
        type: 'application/json',
        size: 1240,
        mtime: Date.now() - 7200000,
        content: '{\n  "version": "1.0.0",\n  "cacheKey": "v1_release"\n}',
      },
      {
        name: 'user_settings.sqlite',
        type: 'application/x-sqlite3',
        size: 65536,
        mtime: Date.now() - 1800000,
      },
    ],
    '/data/user/temp': [
      {
        name: 'upload_temp_01.tmp',
        type: 'application/octet-stream',
        size: 8192,
        mtime: Date.now() - 300000,
      },
    ],
  };

  const availablePaths = Object.keys(fsTree);
  const currentFiles: FsEntry[] = fsTree[currentPath] || [];

  const handleCreateFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;

    const file: FsEntry = {
      name: newFileName.trim(),
      type: newFileName.endsWith('.json')
        ? 'application/json'
        : newFileName.endsWith('.png') || newFileName.endsWith('.jpg')
        ? 'image/png'
        : 'text/plain',
      size: newFileContent.length || 128,
      mtime: Date.now(),
      content: newFileContent,
    };

    if (typeof setFsItem === 'function') {
      setFsItem(currentPath, file);
    } else {
      const updatedTree = {
        ...fsTree,
        [currentPath]: [...(fsTree[currentPath] || []), file],
      };
      setFsTree(updatedTree);
    }

    setNewFileName('');
    setNewFileContent('');
    setIsCreatingFile(false);
    setSelectedFile(file);
  };

  const handleDeleteFile = (fileName: string) => {
    if (typeof deleteFsItem === 'function') {
      deleteFsItem(currentPath, fileName);
    } else {
      const updatedTree = {
        ...fsTree,
        [currentPath]: (fsTree[currentPath] || []).filter((f: any) => f.name !== fileName),
      };
      setFsTree(updatedTree);
    }
    if (selectedFile?.name === fileName) {
      setSelectedFile(null);
    }
  };

  const filteredFiles = currentFiles.filter((f) => {
    if (!searchQuery) return true;
    return f.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getFileIcon = (file: FsEntry) => {
    const name = file.name.toLowerCase();
    if (name.endsWith('.json')) return <FileCode className="w-4 h-4 text-amber-400" />;
    if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.svg'))
      return <FileImage className="w-4 h-4 text-emerald-400" />;
    if (name.endsWith('.sqlite') || name.endsWith('.db'))
      return <Database className="w-4 h-4 text-blue-400" />;
    if (name.endsWith('.txt') || name.endsWith('.md'))
      return <FileText className="w-4 h-4 text-neutral-300" />;
    return <File className="w-4 h-4 text-neutral-400" />;
  };

  const formatBytes = (bytes: number = 0) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="h-full flex flex-col font-mono text-xs select-none bg-neutral-950" data-testid="fs-browser-panel">
      {/* Top Header */}
      <div className="h-9 border-b border-neutral-800 px-3 flex items-center justify-between text-neutral-300 shrink-0 bg-neutral-900/40">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-neutral-300 font-bold text-[11px]">
            <FolderTree className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sandboxed FileSystem</span>
          </div>

          <div className="flex items-center gap-1 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-700/80">
            <Search className="w-3 h-3 text-neutral-400" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-white focus:outline-none w-36 text-[10px]"
            />
          </div>
        </div>

        <button
          onClick={() => setIsCreatingFile(!isCreatingFile)}
          className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] flex items-center gap-1 transition-colors"
        >
          <Plus className="w-3 h-3" />
          <span>New File</span>
        </button>
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Directory Tree Sidebar */}
        <div className="w-56 border-r border-neutral-800 p-2 overflow-y-auto space-y-1 bg-neutral-900/30">
          <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider px-2 mb-1">
            Directories
          </div>
          {availablePaths.map((p) => {
            const isSelected = currentPath === p;
            return (
              <button
                key={p}
                onClick={() => {
                  setCurrentPath(p);
                  setSelectedFile(null);
                }}
                className={`w-full text-left flex items-center gap-1.5 px-2 py-1.5 rounded transition-colors text-[11px] ${
                  isSelected
                    ? 'bg-blue-600/30 text-blue-300 font-bold border border-blue-500/50'
                    : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
                }`}
              >
                {isSelected ? (
                  <FolderOpen className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                ) : (
                  <Folder className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                )}
                <span className="truncate">{p.replace('/data/user', '~')}</span>
              </button>
            );
          })}
        </div>

        {/* Center: File List Table */}
        <div className="flex-1 flex flex-col overflow-hidden p-2 min-w-0">
          {isCreatingFile && (
            <form onSubmit={handleCreateFile} className="mb-2 p-2 rounded bg-neutral-900 border border-neutral-800 space-y-1.5">
              <div className="text-[10px] font-bold text-neutral-300">Create File in {currentPath}</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="filename.json"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  className="flex-1 bg-neutral-950 px-2 py-1 rounded text-white text-xs border border-neutral-700 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={!newFileName.trim()}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded text-xs font-bold"
                >
                  Create
                </button>
              </div>
              <textarea
                rows={2}
                placeholder="Initial file content (optional)..."
                value={newFileContent}
                onChange={(e) => setNewFileContent(e.target.value)}
                className="w-full bg-neutral-950 p-1.5 rounded text-white text-xs border border-neutral-700 focus:outline-none"
              />
            </form>
          )}

          {/* Table */}
          <div className="flex-1 overflow-auto rounded border border-neutral-800 bg-neutral-950">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-900 border-b border-neutral-800 text-neutral-400 text-[10px] uppercase">
                  <th className="p-2">Name</th>
                  <th className="p-2">Size</th>
                  <th className="p-2">Last Modified</th>
                  <th className="p-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-neutral-600">
                      No files found in {currentPath}
                    </td>
                  </tr>
                ) : (
                  filteredFiles.map((file) => {
                    const isSelected = selectedFile?.name === file.name;
                    return (
                      <tr
                        key={file.name}
                        onClick={() => setSelectedFile(file)}
                        className={`border-b border-neutral-900 cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-900/40 text-blue-200'
                            : 'hover:bg-neutral-900/50 text-neutral-300'
                        }`}
                      >
                        <td className="p-2 flex items-center gap-2">
                          {getFileIcon(file)}
                          <span className="font-bold truncate">{file.name}</span>
                        </td>
                        <td className="p-2 font-mono text-neutral-400">
                          {formatBytes(file.size)}
                        </td>
                        <td className="p-2 text-neutral-500 text-[10px]">
                          {new Date(file.mtime || Date.now()).toLocaleString()}
                        </td>
                        <td className="p-2 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFile(file.name);
                            }}
                            className="p-1 hover:bg-neutral-800 rounded text-neutral-500 hover:text-rose-400 transition-colors"
                            title="Delete file"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: File Previewer Pane */}
        {selectedFile && (
          <div className="w-72 border-l border-neutral-800 p-3 overflow-y-auto flex flex-col space-y-3 bg-neutral-900/40 shrink-0">
            <div className="flex items-center justify-between pb-1.5 border-b border-neutral-800">
              <span className="font-bold text-neutral-200 text-xs truncate">
                Preview: {selectedFile.name}
              </span>
              <span className="text-[10px] text-neutral-500 font-mono">
                {formatBytes(selectedFile.size)}
              </span>
            </div>

            {/* File Info */}
            <div className="bg-neutral-950 p-2 rounded border border-neutral-800 text-[10px] space-y-1">
              <div className="flex justify-between">
                <span className="text-neutral-500">Path:</span>
                <span className="text-neutral-300 truncate">{currentPath}/{selectedFile.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">MIME Type:</span>
                <span className="text-emerald-400 font-mono">{selectedFile.type || 'text/plain'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Last Modified:</span>
                <span className="text-neutral-300">{new Date(selectedFile.mtime || Date.now()).toLocaleTimeString()}</span>
              </div>
            </div>

            {/* Preview Box */}
            <div className="flex-1 flex flex-col min-h-0 space-y-1">
              <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                Content Preview
              </div>
              {selectedFile.name.endsWith('.png') || selectedFile.name.endsWith('.jpg') ? (
                <div className="bg-neutral-950 p-4 rounded border border-neutral-800 flex flex-col items-center justify-center text-center">
                  <FileImage className="w-12 h-12 text-emerald-400 mb-2" />
                  <span className="text-[10px] text-neutral-400">Image Asset ({selectedFile.name})</span>
                  <span className="text-[9px] text-neutral-600 font-mono mt-0.5">256 × 256 px (Simulated)</span>
                </div>
              ) : selectedFile.name.endsWith('.sqlite') || selectedFile.name.endsWith('.db') ? (
                <div className="bg-neutral-950 p-4 rounded border border-neutral-800 flex flex-col items-center justify-center text-center">
                  <Database className="w-12 h-12 text-blue-400 mb-2" />
                  <span className="text-[10px] text-neutral-400">SQLite Database File</span>
                  <span className="text-[9px] text-neutral-600 font-mono mt-0.5">Use SQLite tab to query tables</span>
                </div>
              ) : (
                <pre className="flex-1 bg-neutral-950 p-2 rounded border border-neutral-800 text-[10px] text-neutral-300 overflow-auto font-mono max-h-56">
                  {selectedFile.content || '// Empty file'}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
