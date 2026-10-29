import React, { useState } from 'react';

interface JsonViewerProps {
  data: any;
  maxHeight?: string;
  label?: string;
  defaultExpanded?: boolean;
}

export const JsonViewer: React.FC<JsonViewerProps> = ({
  data,
  maxHeight = '200px',
  label,
  defaultExpanded = true,
}) => {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (data === undefined || data === null) {
    return <span style={{ color: 'var(--goat-text-tertiary)', fontStyle: 'italic', fontSize: '11px' }}>null</span>;
  }

  const jsonString = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy JSON: ', err);
    }
  };

  return (
    <div style={{
      borderRadius: '6px',
      border: '1px solid var(--goat-border)',
      backgroundColor: 'var(--goat-bg-elevated)',
      fontSize: '11px',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      overflow: 'hidden',
      margin: '4px 0',
    }}>
      {label && (
        <div
          onClick={() => setExpanded(!expanded)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px 8px',
            backgroundColor: 'var(--goat-bg-container)',
            borderBottom: expanded ? '1px solid var(--goat-split)' : 'none',
            color: 'var(--goat-text-secondary)',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <span style={{ fontWeight: 600, color: 'var(--goat-primary)' }}>
            {expanded ? '-' : '+'} {label}
          </span>
          <button
            onClick={handleCopy}
            style={{
              background: copied ? 'var(--goat-success)' : 'var(--goat-fill-secondary)',
              color: copied ? 'var(--goat-text-light-solid)' : 'var(--goat-text)',
              border: '1px solid var(--goat-border)',
              borderRadius: '3px',
              padding: '2px 6px',
              fontSize: '10px',
              cursor: 'pointer',
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
      {expanded && (
        <pre style={{
          margin: 0,
          padding: '8px 10px',
          maxHeight,
          overflowY: 'auto',
          color: 'var(--goat-primary)',
          backgroundColor: 'var(--goat-bg-elevated)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          lineHeight: 1.4,
        }}>
          <code>{jsonString}</code>
        </pre>
      )}
    </div>
  );
};
