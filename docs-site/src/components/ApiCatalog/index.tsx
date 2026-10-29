import React, { useState, useEffect } from 'react';
import {
  Input,
  Select,
  Segmented,
  Button,
  Empty,
  Typography,
} from 'antd';
import {
  SearchOutlined,
  AimOutlined,
  ThunderboltOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { ALL_API_ACTIONS, API_DOMAINS, ApiAction, ApiPlatformSupport, searchApiActions } from '../../data/api-matrix';
import { SimulatorProvider } from '../../context/SimulatorContext';
import { ActionCard } from './ActionCard';
import { ActionModal } from './ActionModal';
import { QuickSearchModal } from './QuickSearchModal';
import styles from './styles.module.css';

const { Text } = Typography;

const ApiCatalogInner: React.FC = () => {
  const [query, setQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [selectedPlatform, setSelectedPlatform] = useState<keyof ApiPlatformSupport | 'all'>('all');
  const [permissionFilter, setPermissionFilter] = useState<'all' | 'required' | 'zero'>('all');
  const [activeAction, setActiveAction] = useState<ApiAction | null>(null);
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? '')) return;
      e.preventDefault();
      setIsQuickSearchOpen((prev) => !prev);
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

  const domainOptions = [
    { value: 'all', label: 'All Domains (18)' },
    ...API_DOMAINS.map((d) => ({
      value: d.slug,
      label: `${d.name} (${d.actionCount})`,
    })),
  ];

  return (
    <div className={styles.catalogWrapper}>
      {/* Header Controls */}
      <div className={styles.searchSection}>
        <div className={styles.searchBarRow} style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Search across all 210 native bridge actions..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              allowClear
              size="large"
            />
          </div>
          <Button
            size="large"
            icon={<AimOutlined />}
            onClick={() => setIsQuickSearchOpen(true)}
            title="Search the 210 bridge actions on this page (/)"
          >
            <kbd className={styles.kbdBadge}>/</kbd> Action Search
          </Button>
        </div>

        {/* Filter Controls */}
        <div className={styles.filterControls} style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
          {/* Domain selector */}
          <div className={styles.filterGroup}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              Domain:
            </Text>
            <Select
              style={{ width: 240 }}
              showSearch
              value={selectedDomain}
              onChange={(val) => setSelectedDomain(val)}
              options={domainOptions}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </div>

          {/* Platform chips */}
          <div className={styles.filterGroup}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              Platform:
            </Text>
            <Segmented
              value={selectedPlatform}
              onChange={(val) => setSelectedPlatform(val as any)}
              options={[
                { label: 'All', value: 'all' },
                { label: 'Android', value: 'android' },
                { label: 'iOS', value: 'ios' },
                { label: 'React Native', value: 'reactNative' },
                { label: 'Flutter', value: 'flutter' },
                { label: 'Web Mock', value: 'web' },
              ]}
            />
          </div>

          {/* Permission chips */}
          <div className={styles.filterGroup}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              Permissions:
            </Text>
            <Segmented
              value={permissionFilter}
              onChange={(val) => setPermissionFilter(val as any)}
              options={[
                { label: 'All', value: 'all' },
                {
                  label: (
                    <span>
                      <ThunderboltOutlined /> Zero-Permission
                    </span>
                  ),
                  value: 'zero',
                },
                {
                  label: (
                    <span>
                      <LockOutlined /> Requires Scope
                    </span>
                  ),
                  value: 'required',
                },
              ]}
            />
          </div>
        </div>

        {/* Results Counter */}
        <div
          className={styles.resultsCounterRow}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}
        >
          <Text type="secondary">
            Showing <Text strong>{filteredActions.length}</Text> of{' '}
            <Text strong>{ALL_API_ACTIONS.length}</Text> action strings
          </Text>
          {(query || selectedDomain !== 'all' || selectedPlatform !== 'all' || permissionFilter !== 'all') && (
            <Button
              type="link"
              danger
              onClick={() => {
                setQuery('');
                setSelectedDomain('all');
                setSelectedPlatform('all');
                setPermissionFilter('all');
              }}
            >
              Reset Filters
            </Button>
          )}
        </div>
      </div>

      {/* Action Cards Grid */}
      {filteredActions.length === 0 ? (
        <Empty
          description="No matching actions found. Try adjusting your search keywords or clearing active filters."
          style={{ margin: '48px 0' }}
        />
      ) : (
        <div className={styles.actionGrid}>
          {filteredActions.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              onSelect={(selected) => setActiveAction(selected)}
            />
          ))}
        </div>
      )}

      {/* Detail Modal / Drawer */}
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
        onSelectAction={(action) => setActiveAction(action)}
      />
    </div>
  );
};

export const ApiCatalog: React.FC = () => (
  <SimulatorProvider>
    <ApiCatalogInner />
  </SimulatorProvider>
);

export default ApiCatalog;
