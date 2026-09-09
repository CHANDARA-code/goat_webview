import React from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';
import type { EditorProps } from './EditorImpl';

/**
 * Docusaurus prerenders every page's module graph in Node (`docusaurus build`); CodeMirror
 * touches `document` at import time, so it must only load in the browser. `BrowserOnly`'s
 * render-prop is only invoked client-side post-hydration, and `require()` inside it (rather
 * than a top-level `import`) keeps EditorImpl out of the server-side module graph entirely.
 */
export const CodeEditor: React.FC<EditorProps> = (props) => {
  return (
    <BrowserOnly fallback={<pre style={{ margin: 0, padding: '12px', color: '#e2e8f0' }}>{props.value}</pre>}>
      {() => {
        const { default: EditorImpl } = require('./EditorImpl');
        return <EditorImpl {...props} />;
      }}
    </BrowserOnly>
  );
};

export default CodeEditor;
