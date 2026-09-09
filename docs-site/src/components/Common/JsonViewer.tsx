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
    return <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '11px' }}>null</span>;
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
      border: '1px solid var(--ifm-color-emphasis-200, #334155)',
      backgroundColor: '#090d16',
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
            backgroundColor: '#131b2e',
            borderBottom: expanded ? '1px solid #1e293b' : 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <span style={{ fontWeight: 600, color: '#38bdf8' }}>
            {expanded ? '-' : '+'} {label}
          </span>
          <button
            onClick={handleCopy}
            style={{
              background: copied ? '#10b981' : '#1e293b',
              color: '#ffffff',
              border: '1px solid #334155',
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
          color: '#38bdf8',
          backgroundColor: '#090d16',
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
