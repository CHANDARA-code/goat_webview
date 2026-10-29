import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { html } from '@codemirror/lang-html';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import { useColorMode } from '@docusaurus/theme-common';

export interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string;
}

const EditorImpl: React.FC<EditorProps> = ({ value, onChange, height = '260px' }) => {
  let isDark = false;
  try {
    const { colorMode } = useColorMode();
    isDark = colorMode === 'dark';
  } catch {
    isDark = false;
  }

  return (
    <CodeMirror
      value={value}
      height={height}
      theme={isDark ? vscodeDark : vscodeLight}
      extensions={[html()]}
      onChange={onChange}
      basicSetup={{ foldGutter: false }}
    />
  );
};

export default EditorImpl;
