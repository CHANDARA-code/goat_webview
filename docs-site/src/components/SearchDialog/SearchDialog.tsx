import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useHistory } from '@docusaurus/router';
import useBaseUrl from '@docusaurus/useBaseUrl';
import { loadSearchIndex, searchIndex, SearchHit } from './searchIndex';
import styles from './SearchDialog.module.css';

const KIND_LABEL: Record<SearchHit['kind'], string> = {
  page: 'Page',
  heading: 'Section',
  content: 'Text',
};

export const SearchDialog: React.FC = () => {
  const history = useHistory();
  const indexUrl = useBaseUrl('search-index.json');

  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [status, setStatus] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((prev) => !prev);
      } else if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadSearchIndex(indexUrl).catch((err: Error) => {
      if (!cancelled) setStatus(err.message);
    });
    return () => {
      cancelled = true;
    };
  }, [open, indexUrl]);

  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(async () => {
      if (!term.trim()) {
        setHits([]);
        setStatus(null);
        return;
      }
      try {
        const contexts = await loadSearchIndex(indexUrl);
        const results = searchIndex(contexts, term);
        setHits(results);
        setActiveIndex(0);
        setStatus(results.length ? null : `No results for "${term}"`);
      } catch (err) {
        setStatus((err as Error).message);
      }
    }, 120);
    return () => clearTimeout(handle);
  }, [term, open, indexUrl]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (open) return;
    setTerm('');
    setHits([]);
    setStatus(null);
    setActiveIndex(0);
  }, [open]);

  const go = useCallback(
    (hit: SearchHit) => {
      close();
      history.push(hit.url);
    },
    [close, history]
  );

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => (hits.length ? (prev + 1) % hits.length : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => (hits.length ? (prev - 1 + hits.length) % hits.length : 0));
    } else if (event.key === 'Enter' && hits[activeIndex]) {
      event.preventDefault();
      go(hits[activeIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };

  useEffect(() => {
    const node = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    node?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  return (
    <Modal
      open={open}
      onCancel={close}
      footer={null}
      closable={false}
      destroyOnHidden
      width={640}
      style={{ top: 88 }}
      className={styles.dialog}
      afterOpenChange={(visible) => visible && inputRef.current?.focus()}
      aria-label="Search documentation"
    >
      <div className={styles.inputRow}>
        <SearchOutlined className={styles.inputIcon} />
        <input
          ref={inputRef}
          className={styles.input}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder="Search the documentation…"
          aria-label="Search query"
          autoComplete="off"
          spellCheck={false}
        />
        <span className={styles.escHint}>esc</span>
      </div>

      {hits.length > 0 && (
        <div className={styles.results} ref={listRef} role="listbox" aria-label="Search results">
          {hits.map((hit, i) => (
            <a
              key={hit.id}
              href={hit.url}
              role="option"
              aria-selected={i === activeIndex}
              className={`${styles.hit} ${i === activeIndex ? styles.hitActive : ''}`}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={(e) => {
                e.preventDefault();
                go(hit);
              }}
            >
              <span className={styles.hitTitle}>
                <span className={styles.hitKind}>{KIND_LABEL[hit.kind]}</span>
                {hit.title}
              </span>
              <span className={styles.hitPath}>
                {[...hit.breadcrumb, hit.kind === 'page' ? null : hit.pageTitle]
                  .filter(Boolean)
                  .join(' › ')}
              </span>
            </a>
          ))}
        </div>
      )}

      {status && <div className={styles.status}>{status}</div>}

      {!status && hits.length === 0 && (
        <div className={styles.status}>Type to search across every page of the documentation.</div>
      )}

      <div className={styles.footer}>
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd> navigate
        </span>
        <span>
          <kbd>↵</kbd> open
        </span>
        <span>
          <kbd>esc</kbd> close
        </span>
      </div>
    </Modal>
  );
};

export default SearchDialog;
