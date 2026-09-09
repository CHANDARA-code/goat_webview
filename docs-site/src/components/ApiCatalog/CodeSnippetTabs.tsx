import React, { useState } from 'react';
import { Segmented, Button, App } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import styles from './styles.module.css';

interface CodeSnippetTabsProps {
  snippets: {
    typescript: string;
    kotlin: string;
    swift: string;
    dart: string;
  };
}

type LangKey = 'typescript' | 'kotlin' | 'swift' | 'dart';

export const CodeSnippetTabs: React.FC<CodeSnippetTabsProps> = ({ snippets }) => {
  const { message } = App.useApp();
  const [activeLang, setActiveLang] = useState<LangKey>('typescript');

  const handleCopy = () => {
    navigator.clipboard.writeText(snippets[activeLang]);
    message.success(`Copied ${activeLang} snippet`);
  };

  return (
    <div className={styles.snippetContainer}>
      <div className={styles.snippetHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Segmented
          value={activeLang}
          onChange={(val) => setActiveLang(val as LangKey)}
          options={[
            { label: 'TypeScript', value: 'typescript' },
            { label: 'Kotlin', value: 'kotlin' },
            { label: 'Swift', value: 'swift' },
            { label: 'Dart', value: 'dart' },
          ]}
        />
        <Button icon={<CopyOutlined />} onClick={handleCopy} size="small">
          Copy Code
        </Button>
      </div>
      <pre className={styles.codeBlock}>
        <code>{snippets[activeLang]}</code>
      </pre>
    </div>
  );
};
