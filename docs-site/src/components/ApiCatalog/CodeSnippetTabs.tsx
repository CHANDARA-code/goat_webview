import React, { useState } from 'react';
import styles from './styles.module.css';

interface CodeSnippetTabsProps {
  snippets: {
    typescript: string;
    kotlin: string;
    swift: string;
    dart: string;
  };
}

export const CodeSnippetTabs: React.FC<CodeSnippetTabsProps> = ({ snippets }) => {
  const [activeLang, setActiveLang] = useState<'typescript' | 'kotlin' | 'swift' | 'dart'>('typescript');
  const [copied, setCopied] = useState(false);

  const tabs: Array<{ id: 'typescript' | 'kotlin' | 'swift' | 'dart'; label: string; icon: string }> = [
    { id: 'typescript', label: 'TypeScript (Web/Mini-App)', icon: '🟦' },
    { id: 'kotlin', label: 'Kotlin (Android)', icon: '🟣' },
    { id: 'swift', label: 'Swift (iOS)', icon: '🟧' },
    { id: 'dart', label: 'Dart (Flutter)', icon: '🩵' },
  ];

  const handleCopy = () => {
    navigator.clipboard.writeText(snippets[activeLang]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.snippetContainer}>
      <div className={styles.snippetHeader}>
        <div className={styles.tabButtons}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`${styles.tabBtn} ${activeLang === tab.id ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveLang(tab.id)}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>
        <button className={styles.copyBtn} onClick={handleCopy} title="Copy code">
          {copied ? '✅ Copied' : '📋 Copy'}
        </button>
      </div>
      <pre className={styles.codeBlock}>
        <code>{snippets[activeLang]}</code>
      </pre>
    </div>
  );
};
