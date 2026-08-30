import React, { useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { useDevToolsStore } from '../../store/index.ts';
import { configureMonaco } from '../../services/monaco/setup.ts';

export function getLanguageForFile(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'typescript';
  if (lower.endsWith('.js') || lower.endsWith('.jsx')) return 'javascript';
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.css')) return 'css';
  if (lower.endsWith('.html') || lower.endsWith('.vue')) return 'html';
  if (lower.endsWith('.xml') || lower.endsWith('.svg') || lower.endsWith('.gpx')) return 'xml';
  if (lower.endsWith('.md')) return 'markdown';
  return 'plaintext';
}

export const MonacoCodeEditor: React.FC = () => {
  const {
    activeFilePath,
    files,
    updateFileContent,
    theme,
    markTabDirty,
    activeTabId,
  } = useDevToolsStore();

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);

  const currentFileContent = activeFilePath && files ? files[activeFilePath] ?? '' : '';
  const currentLanguage = activeFilePath ? getLanguageForFile(activeFilePath) : 'plaintext';

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Initialize Bridge Ambient Typings, JSON Schemas & Providers
    configureMonaco(monaco);

    // Bind Ctrl+S / Cmd+S save command
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (activeTabId) {
        markTabDirty(activeTabId, false);
      }
    });
  };

  const handleContentChange = (value: string | undefined) => {
    if (value !== undefined && activeFilePath) {
      updateFileContent(activeFilePath, value);
    }
  };

  if (!activeFilePath) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center bg-ide-bg-dark dark:bg-ide-bg-dark bg-ide-bg-light text-gray-500 select-none">
        <div className="text-4xl mb-3">🐐</div>
        <h3 className="text-sm font-bold text-gray-400">No File Open</h3>
        <p className="text-xs text-gray-500 mt-1">Select a file in the Project Explorer to edit</p>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full w-full overflow-hidden relative">
      <Editor
        height="100%"
        width="100%"
        theme={theme === 'dark' ? 'goat-dark' : 'goat-light'}
        language={currentLanguage}
        value={currentFileContent}
        onChange={handleContentChange}
        onMount={handleEditorDidMount}
        options={{
          fontSize: 13,
          fontFamily: "Menlo, Monaco, 'Courier New', monospace",
          lineNumbers: 'on',
          minimap: { enabled: true, maxColumn: 80 },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          formatOnPaste: true,
          formatOnType: true,
          suggestOnTriggerCharacters: true,
          quickSuggestions: { other: true, comments: false, strings: true },
          parameterHints: { enabled: true },
        }}
      />
    </div>
  );
};
