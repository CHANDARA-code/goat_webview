import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { html } from '@codemirror/lang-html';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';

export interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string;
}

/**
 * The actual CodeMirror mount. This module touches `document` at import time, so it must
 * only ever be loaded client-side via CodeEditor.tsx's `BrowserOnly` + `require()` — never
 * imported directly, or Docusaurus's Node-side prerender (`docusaurus build`) will crash.
 */
const EditorImpl: React.FC<EditorProps> = ({ value, onChange, height = '260px' }) => {
  return (
    <CodeMirror
      value={value}
      height={height}
      theme={vscodeDark}
      extensions={[html()]}
      onChange={onChange}
      basicSetup={{ foldGutter: false }}
    />
  );
};

export default EditorImpl;
