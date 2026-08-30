import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { MiniAppTab, SHOWCASE_TABS, TabId } from './types';

interface ShowcaseTabsProps {
  activeTabId: TabId;
  onSelectTab: (tab: MiniAppTab) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onPrewarmEngine: () => void;
  onClearCache: () => void;
  isPrewarmed: boolean;
  bundleVersion: string;
  isDualThread: boolean;
  onToggleDualThread: () => void;
}

export const ShowcaseTabs: React.FC<ShowcaseTabsProps> = ({
  activeTabId,
  onSelectTab,
  isDarkMode,
  onToggleTheme,
  onPrewarmEngine,
  onClearCache,
  isPrewarmed,
  bundleVersion,
  isDualThread,
  onToggleDualThread,
}) => {
  const currentTheme = isDarkMode ? darkTheme : lightTheme;
  const activeTab = SHOWCASE_TABS.find((t) => t.id === activeTabId) || SHOWCASE_TABS[0];

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.headerBg, borderColor: currentTheme.border }]}>
      {/* Top Application Bar */}
      <View style={styles.topRow}>
        <View style={styles.branding}>
          <Text style={styles.logoIcon}>🐐</Text>
          <View>
            <View style={styles.titleWithBadge}>
              <Text style={[styles.title, { color: currentTheme.text }]}>Goat SuperApp</Text>
              <View style={[styles.archBadge, { backgroundColor: '#6366F125' }]}>
                <Text style={styles.archBadgeText}>Fabric • TurboModule</Text>
              </View>
            </View>
            <Text style={[styles.subtitle, { color: currentTheme.subtext }]}>
              v{bundleVersion} • {isPrewarmed ? '⚡ Prewarmed Engine' : '❄️ Cold Start'}
            </Text>
          </View>
        </View>

        {/* Global Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            testID="dual-thread-toggle"
            style={[
              styles.actionButton,
              {
                backgroundColor: isDualThread ? '#8B5CF622' : currentTheme.pillBg,
                borderColor: isDualThread ? '#8B5CF6' : 'transparent',
                borderWidth: 1,
              },
            ]}
            onPress={onToggleDualThread}
          >
            <Text style={[styles.actionButtonText, { color: isDualThread ? '#A78BFA' : currentTheme.text }]}>
              {isDualThread ? '🧵 Dual-Thread' : '📄 Single-Thread'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="prewarm-action-btn"
            style={[styles.iconButton, { backgroundColor: currentTheme.pillBg }]}
            onPress={onPrewarmEngine}
          >
            <Text style={styles.iconButtonText}>🚀</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="clear-cache-action-btn"
            style={[styles.iconButton, { backgroundColor: currentTheme.pillBg }]}
            onPress={onClearCache}
          >
            <Text style={styles.iconButtonText}>🧹</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="theme-toggle-action-btn"
            style={[styles.iconButton, { backgroundColor: currentTheme.pillBg }]}
            onPress={onToggleTheme}
          >
            <Text style={styles.iconButtonText}>{isDarkMode ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Horizontal Domain Mini-Apps Navigation Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsScrollContent}
        style={styles.tabsScrollView}
      >
        {SHOWCASE_TABS.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <TouchableOpacity
              key={tab.id}
              testID={`tab-${tab.id}`}
              style={[
                styles.tabItem,
                {
                  backgroundColor: isActive ? currentTheme.activeTabBg : currentTheme.tabBg,
                  borderColor: isActive ? tab.primaryColor : currentTheme.border,
                },
              ]}
              onPress={() => onSelectTab(tab)}
            >
              <Text style={styles.tabIcon}>{tab.icon}</Text>
              <View style={styles.tabTextContainer}>
                <View style={styles.tabNameRow}>
                  <Text
                    style={[
                      styles.tabName,
                      {
                        color: isActive ? tab.primaryColor : currentTheme.text,
                        fontWeight: isActive ? '700' : '500',
                      },
                    ]}
                  >
                    {tab.name}
                  </Text>
                  {tab.badge && (
                    <View style={[styles.badgePill, { backgroundColor: `${tab.primaryColor}20` }]}>
                      <Text style={[styles.badgePillText, { color: tab.primaryColor }]}>{tab.badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.tabSubtitle, { color: currentTheme.subtext }]} numberOfLines={1}>
                  {tab.subtitle}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Active Domain Info Bar */}
      <View style={[styles.activeInfoBar, { backgroundColor: currentTheme.infoBarBg }]}>
        <View style={styles.routeIndicator}>
          <View style={[styles.activeDot, { backgroundColor: activeTab.primaryColor }]} />
          <Text style={[styles.activeAppId, { color: currentTheme.text }]}>
            {activeTab.appId} <Text style={{ color: currentTheme.subtext }}>({activeTab.route})</Text>
          </Text>
        </View>
        <Text style={[styles.activeDesc, { color: currentTheme.subtext }]} numberOfLines={1}>
          {activeTab.description}
        </Text>
      </View>
    </View>
  );
};

const lightTheme = {
  headerBg: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0F172A',
  subtext: '#64748B',
  pillBg: '#F1F5F9',
  tabBg: '#F8FAFC',
  activeTabBg: '#EEF2FF',
  infoBarBg: '#F8FAFC',
};

const darkTheme = {
  headerBg: '#1E293B',
  border: '#334155',
  text: '#F8FAFC',
  subtext: '#94A3B8',
  pillBg: '#334155',
  tabBg: '#0F172A',
  activeTabBg: '#1E1B4B',
  infoBarBg: '#0F172A',
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    paddingTop: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  branding: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoIcon: {
    fontSize: 26,
    marginRight: 10,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  archBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  archBadgeText: {
    fontSize: 9,
    color: '#6366F1',
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: '600',
  },
  iconButton: {
    padding: 7,
    borderRadius: 8,
  },
  iconButtonText: {
    fontSize: 13,
  },
  tabsScrollView: {
    marginTop: 4,
  },
  tabsScrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    minWidth: 140,
  },
  tabIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  tabTextContainer: {
    flex: 1,
  },
  tabNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  tabName: {
    fontSize: 12,
  },
  badgePill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  badgePillText: {
    fontSize: 8,
    fontWeight: '700',
  },
  tabSubtitle: {
    fontSize: 10,
    marginTop: 2,
  },
  activeInfoBar: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  activeAppId: {
    fontSize: 11,
    fontWeight: '600',
  },
  activeDesc: {
    fontSize: 10,
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
});
