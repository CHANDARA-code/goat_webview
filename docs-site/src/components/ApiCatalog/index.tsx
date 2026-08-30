import React, { useState, useEffect } from 'react';
import { ALL_API_ACTIONS, API_DOMAINS, ApiAction, ApiPlatformSupport, searchApiActions } from '../../data/api-matrix';
import { ActionCard } from './ActionCard';
import { ActionModal } from './ActionModal';
import { QuickSearchModal } from './QuickSearchModal';
import styles from './styles.module.css';

export const ApiCatalog: React.FC = () => {
  const [query, setQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [selectedPlatform, setSelectedPlatform] = useState<keyof ApiPlatformSupport | 'all'>('all');
  const [permissionFilter, setPermissionFilter] = useState<'all' | 'required' | 'zero'>('all');
  const [activeAction, setActiveAction] = useState<ApiAction | null>(null);
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);

  // Global shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsQuickSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredActions = searchApiActions(query, {
    domainSlug: selectedDomain,
    platform: selectedPlatform === 'all' ? undefined : selectedPlatform,
    permissionRequired:
      permissionFilter === 'all' ? undefined : permissionFilter === 'required',
  });

  return (
    <div className={styles.catalogWrapper}>
      {/* Header Controls */}
      <div className={styles.searchSection}>
        <div className={styles.searchBarRow}>
          <div className={styles.searchInputWrapper}>
            <span className={styles.searchPrefixIcon}>🔍</span>
            <input
              type="text"
              className={styles.mainSearchInput}
              placeholder="Search across all 197 native bridge actions..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {query && (
              <button className={styles.clearSearchBtn} onClick={() => setQuery('')}>
                ✕
              </button>
            )}
          </div>
          <button
            className={styles.quickSearchTriggerBtn}
            onClick={() => setIsQuickSearchOpen(true)}
            title="Global Quick Search (Cmd+K)"
          >
            <kbd className={styles.kbdBadge}>⌘K</kbd> Quick Search
          </button>
        </div>

        {/* Filter Controls */}
        <div className={styles.filterControls}>
          {/* Domain selector */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Domain:</label>
            <select
              className={styles.filterSelect}
              value={selectedDomain}
              onChange={e => setSelectedDomain(e.target.value)}
            >
              <option value="all">All Domains (18)</option>
              {API_DOMAINS.map(d => (
                <option key={d.slug} value={d.slug}>
                  {d.icon} {d.name} ({d.actionCount})
                </option>
              ))}
            </select>
          </div>

          {/* Platform chips */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Platform:</label>
            <div className={styles.chipGroup}>
              {[
                { id: 'all', label: 'All' },
                { id: 'android', label: 'Android' },
                { id: 'ios', label: 'iOS' },
                { id: 'reactNative', label: 'React Native' },
                { id: 'flutter', label: 'Flutter' },
                { id: 'web', label: 'Web Mock' },
              ].map(p => (
                <button
                  key={p.id}
                  className={`${styles.filterChip} ${selectedPlatform === p.id ? styles.filterChipActive : ''}`}
                  onClick={() => setSelectedPlatform(p.id as any)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Permission chips */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Permissions:</label>
            <div className={styles.chipGroup}>
              <button
                className={`${styles.filterChip} ${permissionFilter === 'all' ? styles.filterChipActive : ''}`}
                onClick={() => setPermissionFilter('all')}
              >
                All
              </button>
              <button
                className={`${styles.filterChip} ${permissionFilter === 'zero' ? styles.filterChipActive : ''}`}
                onClick={() => setPermissionFilter('zero')}
              >
                ⚡ Zero-Permission
              </button>
              <button
                className={`${styles.filterChip} ${permissionFilter === 'required' ? styles.filterChipActive : ''}`}
                onClick={() => setPermissionFilter('required')}
              >
                🔒 Requires Manifest Scope
              </button>
            </div>
          </div>
        </div>

        {/* Results Counter */}
        <div className={styles.resultsCounterRow}>
          <span>
            Showing <strong>{filteredActions.length}</strong> of <strong>{ALL_API_ACTIONS.length}</strong> action strings
          </span>
          {(query || selectedDomain !== 'all' || selectedPlatform !== 'all' || permissionFilter !== 'all') && (
            <button
              className={styles.resetFiltersBtn}
              onClick={() => {
                setQuery('');
                setSelectedDomain('all');
                setSelectedPlatform('all');
                setPermissionFilter('all');
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Action Cards Grid */}
      {filteredActions.length === 0 ? (
        <div className={styles.emptyState}>
          <h3>No matching actions found</h3>
          <p>Try adjusting your search keywords or clearing active filters.</p>
        </div>
      ) : (
        <div className={styles.actionGrid}>
          {filteredActions.map(action => (
            <ActionCard
              key={action.id}
              action={action}
              onSelect={selected => setActiveAction(selected)}
            />
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {activeAction && (
        <ActionModal
          action={activeAction}
          onClose={() => setActiveAction(null)}
        />
      )}

      {/* Quick Search Cmd+K Modal */}
      <QuickSearchModal
        isOpen={isQuickSearchOpen}
        onClose={() => setIsQuickSearchOpen(false)}
        onSelectAction={action => setActiveAction(action)}
      />
    </div>
  );
};

export default ApiCatalog;
