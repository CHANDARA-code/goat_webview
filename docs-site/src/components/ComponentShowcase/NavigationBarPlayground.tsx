import React, { useState } from 'react';
import { useSimulator } from '../../context/SimulatorContext';
import { CodeBlockCopy } from '../Common/CodeBlockCopy';
import styles from './ComponentShowcase.module.css';

const COLOR_PRESETS = [
  { name: 'Slate Dark', color: '#1e293b', textColor: '#ffffff' },
  { name: 'Indigo Accent', color: '#4f46e5', textColor: '#ffffff' },
  { name: 'Emerald Green', color: '#059669', textColor: '#ffffff' },
  { name: 'Crimson Red', color: '#e11d48', textColor: '#ffffff' },
  { name: 'Amber Gold', color: '#d97706', textColor: '#ffffff' },
  { name: 'Clean White', color: '#ffffff', textColor: '#0f172a' },
];

export const NavigationBarPlayground: React.FC = () => {
  const { navBar, setNavBar, callBridge, triggerHaptic } = useSimulator();
  const [titleInput, setTitleInput] = useState(navBar.title);
  const [subtitleInput, setSubtitleInput] = useState(navBar.subtitle);
  const [selectedLang, setSelectedLang] = useState<'ts' | 'kotlin' | 'swift' | 'dart'>('ts');

  const handleApplyTitle = async () => {
    triggerHaptic('light');
    await callBridge(
      'NAV_BAR_SET_TITLE',
      { title: titleInput, subtitle: subtitleInput },
      'Navigation'
    );
  };

  const handleApplyColor = async (color: string, textColor: string) => {
    triggerHaptic('light');
    await callBridge(
      'NAV_BAR_SET_COLOR',
      { color, textColor, isDark: textColor === '#ffffff' },
      'Navigation'
    );
  };

  const handleToggleProgress = async (visible: boolean) => {
    triggerHaptic('light');
    await callBridge(
      'NAV_BAR_SET_PROGRESS',
      { visible, percent: navBar.progress.percent },
      'Navigation'
    );
  };

  const handleProgressChange = async (percent: number) => {
    await callBridge(
      'NAV_BAR_SET_PROGRESS',
      { visible: navBar.progress.visible, percent },
      'Navigation'
    );
  };

  const handleAddRightButton = async () => {
    triggerHaptic('selection');
    const newBtn = {
      id: `btn_${Date.now()}`,
      text: `Action ${navBar.rightButtons.length + 1}`,
      icon: 'star',
      enabled: true,
    };
    const updatedButtons = [...navBar.rightButtons, newBtn];
    await callBridge('NAV_BAR_SET_BUTTONS', { rightButtons: updatedButtons }, 'Navigation');
  };

  const handleRemoveRightButton = async () => {
    triggerHaptic('selection');
    if (navBar.rightButtons.length > 0) {
      const updatedButtons = navBar.rightButtons.slice(0, -1);
      await callBridge('NAV_BAR_SET_BUTTONS', { rightButtons: updatedButtons }, 'Navigation');
    }
  };

  // Multi-Language Code Snippets
  const codeSnippets = {
    ts: `const goat = window.goatBridge;

// 1. Configure Navigation Bar Title & Subtitle
await goat.navigation.setTitle({
  title: "${titleInput}",
  subtitle: "${subtitleInput}"
});

// 2. Set Theme Color & Progress Indicator
await goat.navigation.setColor({
  backgroundColor: "${navBar.backgroundColor}",
  textColor: "${navBar.textColor}",
  isDark: ${navBar.isDark}
});

await goat.navigation.setProgress({
  visible: ${navBar.progress.visible},
  percent: ${navBar.progress.percent}
});

// 3. Listen to Native Button Clicks
goat.navigation.onButtonClick((buttonId) => {
  console.log('User clicked navigation button:', buttonId);
});`,
    kotlin: `// Android Host App: GoatNavigationBar Integration
class MiniAppFragment : Fragment() {
    private lateinit var navBar: GoatNavigationBar

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        navBar = view.findViewById(R.id.goat_nav_bar)
        navBar.setTitle("${titleInput}")
        navBar.setSubtitle("${subtitleInput}")
        navBar.setBackgroundColor(Color.parseColor("${navBar.backgroundColor}"))
        navBar.setProgress(${navBar.progress.percent}f, visible = ${navBar.progress.visible})
        
        navBar.setOnButtonClickListener { buttonId ->
            bridge.dispatchAction("NAV_BAR_BUTTON_CLICKED", mapOf("buttonId" to buttonId))
        }
    }
}`,
    swift: `// iOS Host App: GoatNavigationBar Integration
import SwiftUI
import GoatWebView

struct MiniAppNavBarView: View {
    @StateObject var bridge = GoatBridgeModel.shared
    
    var body: some View {
        GoatNavigationBar(
            title: "${titleInput}",
            subtitle: "${subtitleInput}",
            backgroundColor: Color(hex: "${navBar.backgroundColor}"),
            textColor: Color(hex: "${navBar.textColor}"),
            progress: ${navBar.progress.visible ? `${navBar.progress.percent} / 100.0` : 'nil'}
        )
        .onButtonClick { buttonId in
            bridge.postMessage(action: "NAV_BAR_BUTTON_CLICKED", payload: ["buttonId": buttonId])
        }
    }
}`,
    dart: `// Flutter PlatformView: GoatNavigationBar Channel
await GoatWebView.channel.invokeMethod('setNavBar', {
  'title': '${titleInput}',
  'subtitle': '${subtitleInput}',
  'backgroundColor': '${navBar.backgroundColor}',
  'textColor': '${navBar.textColor}',
  'progress': ${navBar.progress.percent},
  'progressVisible': ${navBar.progress.visible},
});`,
  };

  return (
    <div className={styles.playgroundCard} data-testid="navbar-playground">
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.cardTitle}>
            <span>GoatNavigationBar Component Playground</span>
          </div>
          <div className={styles.cardDesc}>
            Customizable host native appbar above the WebView. Synchronizes titles, themes, action buttons, and loading progress without DOM redraw overhead.
          </div>
        </div>
      </div>

      <div className={styles.formGrid}>
        {/* Title & Subtitle Input */}
        <div className={styles.formField}>
          <label className={styles.fieldLabel}>Bar Title</label>
          <input
            type="text"
            className={styles.textInput}
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            placeholder="Mini App Title"
          />
        </div>

        <div className={styles.formField}>
          <label className={styles.fieldLabel}>Bar Subtitle</label>
          <input
            type="text"
            className={styles.textInput}
            value={subtitleInput}
            onChange={(e) => setSubtitleInput(e.target.value)}
            placeholder="Subtitle / Category"
          />
        </div>

        {/* Color Palette */}
        <div className={styles.formField} style={{ gridColumn: 'span 2' }}>
          <label className={styles.fieldLabel}>Theme Preset Color</label>
          <div className={styles.colorPresets}>
            {COLOR_PRESETS.map((preset) => (
              <div
                key={preset.color}
                className={`${styles.colorCircle} ${navBar.backgroundColor === preset.color ? styles.selectedColor : ''}`}
                style={{ backgroundColor: preset.color }}
                onClick={() => handleApplyColor(preset.color, preset.textColor)}
                title={preset.name}
              />
            ))}
            <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '8px' }}>
              Current: <code>{navBar.backgroundColor}</code>
            </span>
          </div>
        </div>

        {/* Progress Bar Control */}
        <div className={styles.formField}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className={styles.fieldLabel}>Progress Bar: {navBar.progress.percent}%</label>
            <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={navBar.progress.visible}
                onChange={(e) => handleToggleProgress(e.target.checked)}
              />
              <span>Visible</span>
            </label>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={navBar.progress.percent}
            onChange={(e) => handleProgressChange(parseInt(e.target.value, 10))}
            style={{ width: '100%', accentColor: '#6366f1' }}
          />
        </div>

        {/* Action Buttons Config */}
        <div className={styles.formField}>
          <label className={styles.fieldLabel}>Right Action Buttons ({navBar.rightButtons.length})</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className={styles.secondaryButton} onClick={handleAddRightButton}>
              + Add Button
            </button>
            <button
              className={styles.secondaryButton}
              onClick={handleRemoveRightButton}
              disabled={navBar.rightButtons.length === 0}
            >
              - Remove
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button className={styles.actionButton} onClick={handleApplyTitle}>
          <span>Apply Title & Settings to Simulator</span>
        </button>
      </div>

      {/* Code Snippet Tabs */}
      <div>
        <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
          {(['ts', 'kotlin', 'swift', 'dart'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => setSelectedLang(lang)}
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                border: 'none',
                background: selectedLang === lang ? '#6366f1' : '#1e293b',
                color: selectedLang === lang ? '#ffffff' : '#94a3b8',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              {lang}
            </button>
          ))}
        </div>
        <CodeBlockCopy code={codeSnippets[selectedLang]} language={selectedLang} title={`GoatNavigationBar (${selectedLang.toUpperCase()})`} />
      </div>
    </div>
  );
};
