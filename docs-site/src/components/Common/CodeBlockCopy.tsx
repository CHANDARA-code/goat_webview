import React, { useState } from 'react';

interface CodeBlockCopyProps {
  code: string;
  language?: string;
  title?: string;
}

export const CodeBlockCopy: React.FC<CodeBlockCopyProps> = ({ code, language = 'typescript', title }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div style={{
      position: 'relative',
      borderRadius: '8px',
      overflow: 'hidden',
      border: '1px solid var(--goat-border)',
      backgroundColor: 'var(--goat-bg-container)',
      margin: '8px 0',
      fontFamily: 'monospace',
      fontSize: '12px',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 12px',
        backgroundColor: 'var(--goat-bg-elevated)',
        borderBottom: '1px solid var(--goat-split)',
        color: 'var(--goat-text-secondary)',
        fontSize: '11px',
        fontWeight: 600,
      }}>
        <span>{title || language.toUpperCase()}</span>
        <button
          onClick={handleCopy}
          style={{
            background: copied ? 'var(--goat-success)' : 'var(--goat-fill-secondary)',
            color: copied ? 'var(--goat-text-light-solid)' : 'var(--goat-text)',
            border: 'none',
            borderRadius: '4px',
            padding: '3px 8px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          aria-label="Copy code to clipboard"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre style={{
        margin: 0,
        padding: '12px',
        overflowX: 'auto',
        color: 'var(--goat-text)',
        backgroundColor: 'var(--goat-bg-container)',
        lineHeight: 1.5,
      }}>
        <code>{code}</code>
      </pre>
    </div>
  );
};
