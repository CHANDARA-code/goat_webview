import React, { useState, useEffect, useRef } from 'react';
import { Modal, Input, Typography, Tag, Space } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { ApiAction, searchApiActions } from '../../data/api-matrix';
import styles from './styles.module.css';

const { Text } = Typography;

interface QuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction: (action: ApiAction) => void;
}

export const QuickSearchModal: React.FC<QuickSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectAction,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<any>(null);

  const results = searchApiActions(query).slice(0, 10);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      onSelectAction(results[selectedIndex]);
      onClose();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      footer={null}
      title="Global Quick Search (Cmd+K)"
      width={640}
    >
      <div style={{ marginTop: 12 }}>
        <Input
          ref={inputRef}
          prefix={<SearchOutlined />}
          placeholder="Search all 197 native actions... (e.g. biometrics, storage, camera, BLE)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          allowClear
          size="large"
        />
      </div>

      <div className={styles.quickSearchResults} style={{ marginTop: 16, maxHeight: 360, overflowY: 'auto' }}>
        {results.length === 0 ? (
          <div className={styles.noResults} style={{ padding: '24px 0', textAlign: 'center' }}>
            <Text type="secondary">No actions matching &quot;{query}&quot;</Text>
          </div>
        ) : (
          results.map((action, idx) => (
            <div
              key={action.id}
              className={`${styles.quickSearchResultItem} ${idx === selectedIndex ? styles.quickSearchItemSelected : ''}`}
              onClick={() => {
                onSelectAction(action);
                onClose();
              }}
              onMouseEnter={() => setSelectedIndex(idx)}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: idx === selectedIndex ? 'var(--goat-fill-secondary)' : 'transparent',
                marginBottom: 4,
              }}
            >
              <div className={styles.resultItemLeft}>
                <code className={styles.resultActionName}>{action.action}</code>
                <span className={styles.resultDesc} style={{ fontSize: 12, color: 'var(--goat-text-secondary)', marginLeft: 8 }}>
                  {action.description}
                </span>
              </div>
              <Tag color="processing">{action.domain}</Tag>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid var(--goat-split)', display: 'flex', gap: 16, fontSize: 11, color: 'var(--goat-text-secondary)' }}>
        <span>Navigation: <kbd>Up</kbd> <kbd>Down</kbd></span>
        <span>Select: <kbd>ENTER</kbd></span>
        <span>Close: <kbd>ESC</kbd></span>
      </div>
    </Modal>
  );
};
