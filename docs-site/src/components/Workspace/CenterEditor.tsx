import React, { useEffect, useRef } from 'react';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { html } from '@codemirror/lang-html';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import { useColorMode } from '@docusaurus/theme-common';
import { CodeOutlined } from '@ant-design/icons';
import { useSimulator } from '../../context/SimulatorContext';
import styles from './Workspace.module.css';

interface CenterEditorProps {
  fontSize: number;
  wordWrap: boolean;
  autoRun: boolean;
}

export const CenterEditor: React.FC<CenterEditorProps> = ({
  fontSize,
  wordWrap,
  autoRun,
}) => {
  const { playgroundCode, setPlaygroundCode, runPlayground } = useSimulator();
  let isDark = false;
  try {
    const { colorMode } = useColorMode();
    isDark = colorMode === 'dark';
  } catch {
    isDark = false;
  }

  const autoRunTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleChange = (val: string) => {
    setPlaygroundCode(val);
    if (autoRun) {
      if (autoRunTimerRef.current) clearTimeout(autoRunTimerRef.current);
      autoRunTimerRef.current = setTimeout(() => {
        runPlayground();
      }, 750);
    }
  };

  useEffect(() => {
    return () => {
      if (autoRunTimerRef.current) clearTimeout(autoRunTimerRef.current);
    };
  }, []);

  const extensions = [
    html(),
    ...(wordWrap ? [EditorView.lineWrapping] : []),
  ];

  return (
    <section className={styles.editorPane} aria-label="Code Editor Pane">
      {/* Tab Strip */}
      <div className={styles.editorTabBar}>
        <button
          type="button"
          className={`${styles.editorTab} ${styles.editorTabActive}`}
          aria-label="Active File: index.html"
        >
          <CodeOutlined style={{ color: 'var(--goat-primary)' }} />
          <span>index.html</span>
        </button>
      </div>

      {/* CodeMirror */}
      <div
        className={styles.editorWrapper}
        style={{ fontSize: `${fontSize}px` }}
      >
        <CodeMirror
          value={playgroundCode}
          height="100%"
          theme={isDark ? vscodeDark : vscodeLight}
          extensions={extensions}
          onChange={handleChange}
          basicSetup={{
            foldGutter: true,
            lineNumbers: true,
            autocompletion: true,
            bracketMatching: true,
          }}
        />
      </div>
    </section>
  );
};

export default CenterEditor;
