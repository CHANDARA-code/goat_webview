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
      border: '1px solid var(--ifm-color-emphasis-300, #334155)',
      backgroundColor: '#0f172a',
      margin: '8px 0',
      fontFamily: 'monospace',
      fontSize: '12px',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 12px',
        backgroundColor: '#1e293b',
        borderBottom: '1px solid #334155',
        color: '#94a3b8',
        fontSize: '11px',
        fontWeight: 600,
      }}>
        <span>{title || language.toUpperCase()}</span>
        <button
          onClick={handleCopy}
          style={{
            background: copied ? '#10b981' : '#334155',
            color: '#ffffff',
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
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre style={{
        margin: 0,
        padding: '12px',
        overflowX: 'auto',
        color: '#e2e8f0',
        backgroundColor: '#0f172a',
        lineHeight: 1.5,
      }}>
        <code>{code}</code>
      </pre>
    </div>
  );
};
