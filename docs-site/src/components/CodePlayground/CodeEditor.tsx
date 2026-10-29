import React from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';
import type { EditorProps } from './EditorImpl';

export const CodeEditor: React.FC<EditorProps> = (props) => {
  return (
    <BrowserOnly fallback={<pre style={{ margin: 0, padding: '12px', color: 'var(--goat-text-secondary)' }}>{props.value}</pre>}>
      {() => {
        const { default: EditorImpl } = require('./EditorImpl');
        return <EditorImpl {...props} />;
      }}
    </BrowserOnly>
  );
};

export default CodeEditor;
