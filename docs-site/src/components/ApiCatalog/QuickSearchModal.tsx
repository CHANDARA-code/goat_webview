import React, { useState, useEffect, useRef } from 'react';
import { ALL_API_ACTIONS, ApiAction, searchApiActions } from '../../data/api-matrix';
import styles from './styles.module.css';

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
  const inputRef = useRef<HTMLInputElement>(null);

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
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      onSelectAction(results[selectedIndex]);
      onClose();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.quickSearchOverlay} onClick={onClose}>
      <div className={styles.quickSearchDialog} onClick={e => e.stopPropagation()}>
        <div className={styles.quickSearchInputRow}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            className={styles.quickSearchInput}
            placeholder="Search all 197 native actions... (e.g. biometrics, storage, camera, BLE)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <kbd className={styles.kbdEsc} onClick={onClose}>ESC</kbd>
        </div>

        <div className={styles.quickSearchResults}>
          {results.length === 0 ? (
            <div className={styles.noResults}>
              No actions matching "<strong>{query}</strong>"
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
              >
                <div className={styles.resultItemLeft}>
                  <code className={styles.resultActionName}>{action.action}</code>
                  <span className={styles.resultDesc}>{action.description}</span>
                </div>
                <span className={styles.resultDomainTag}>{action.domain}</span>
              </div>
            ))
          )}
        </div>

        <div className={styles.quickSearchFooter}>
          <span>Navigation: <kbd>↑</kbd> <kbd>↓</kbd></span>
          <span>Select: <kbd>ENTER</kbd></span>
          <span>Close: <kbd>ESC</kbd></span>
        </div>
      </div>
    </div>
  );
};
