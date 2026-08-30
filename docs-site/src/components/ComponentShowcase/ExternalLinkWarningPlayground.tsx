import React, { useState } from 'react';
import { useSimulator } from '../../context/SimulatorContext';
import { CodeBlockCopy } from '../Common/CodeBlockCopy';
import styles from './ComponentShowcase.module.css';

const SAMPLE_URLS = [
  { label: 'Stripe Checkout', url: 'https://checkout.stripe.com/pay/cs_goat_demo' },
  { label: 'GitHub Repo', url: 'https://github.com/goat-webview/goatwebview' },
  { label: 'External Partner', url: 'https://partner-services.io/oauth2/authorize' },
  { label: 'Untrusted Site', url: 'https://unverified-tracker-portal.xyz/promo' },
];

export const ExternalLinkWarningPlayground: React.FC = () => {
  const { externalLinkDialog, openExternalLinkFlow, clearExternalLinkAllowlist, triggerHaptic } = useSimulator();
  const [urlInput, setUrlInput] = useState(externalLinkDialog.url);
  const [selectedLang, setSelectedLang] = useState<'ts' | 'kotlin' | 'swift' | 'dart'>('ts');

  const handleTestLink = (url: string) => {
    triggerHaptic('medium');
    openExternalLinkFlow(url);
  };

  const codeSnippets = {
    ts: `import { goat } from '@goat/sdk';

// 1. Open Out-of-App External Link with Anti-Phishing Interstitial
await goat.security.openExternalLink({
  url: '${urlInput}',
  skipWarningIfOptedOut: true,
  onWarningShown: (destinationHost) => {
    console.warn('Anti-phishing modal shown for host:', destinationHost);
  }
});

// 2. Clear Session Allowlist
await goat.security.clearExternalLinkAllowlist();`,
    kotlin: `// Android Host App: GoatExternalLinkWarningDialog
val warningDialog = GoatExternalLinkWarningDialog(context).apply {
    setDestinationUrl("${urlInput}")
    setOnContinueListener { url, dontAskAgain ->
        if (dontAskAgain) {
            optOutDomainForSession(Uri.parse(url).host)
        }
        openCustomTab(url)
    }
}
warningDialog.show()`,
    swift: `// iOS Host App: GoatExternalLinkWarningDialog
GoatExternalLinkWarningDialog.present(for: URL(string: "${urlInput}")!) { accepted, allowForever in
    if accepted {
        let safariVC = SFSafariViewController(url: URL(string: "${urlInput}")!)
        present(safariVC, animated: true)
    }
}`,
    dart: `// Flutter PlatformView: External Link Verification
await GoatWebView.channel.invokeMethod('openExternalLink', {
  'url': '${urlInput}',
  'skipWarningIfOptedOut': true,
});`,
  };

  return (
    <div className={styles.playgroundCard} data-testid="external-link-playground">
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.cardTitle}>
            <span>🛡️</span>
            <span>GoatExternalLinkWarningDialog Component Playground</span>
          </div>
          <div className={styles.cardDesc}>
            Anti-phishing host verification interstitial when opening cross-origin external links. Protects users from credential harvesting and malicious spoofing with session allowlist caching.
          </div>
        </div>
      </div>

      <div className={styles.formGrid}>
        {/* Destination URL Input */}
        <div className={styles.formField} style={{ gridColumn: 'span 2' }}>
          <label className={styles.fieldLabel}>Test Destination URL</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className={styles.textInput}
              style={{ flex: 1 }}
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://..."
            />
            <button
              className={styles.actionButton}
              onClick={() => handleTestLink(urlInput)}
            >
              Test Link
            </button>
          </div>
        </div>

        {/* Preset URL Chips */}
        <div className={styles.formField} style={{ gridColumn: 'span 2' }}>
          <label className={styles.fieldLabel}>Quick Test Domains</label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {SAMPLE_URLS.map((sample) => (
              <button
                key={sample.label}
                className={styles.secondaryButton}
                onClick={() => {
                  setUrlInput(sample.url);
                  handleTestLink(sample.url);
                }}
              >
                {sample.label}
              </button>
            ))}
          </div>
        </div>

        {/* Session Allowed Domains */}
        <div className={styles.formField} style={{ gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <label className={styles.fieldLabel}>
              Session Trusted Domains ({externalLinkDialog.sessionAllowedHosts.length})
            </label>
            <button
              className={styles.secondaryButton}
              onClick={clearExternalLinkAllowlist}
              style={{ padding: '3px 8px', fontSize: '10px' }}
            >
              Clear Allowlist
            </button>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {externalLinkDialog.sessionAllowedHosts.length === 0 ? (
              <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                No domains currently bypassed in this session.
              </span>
            ) : (
              externalLinkDialog.sessionAllowedHosts.map((host) => (
                <span
                  key={host}
                  style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: '#065f46',
                    color: '#34d399',
                    fontFamily: 'monospace',
                  }}
                >
                  ✓ {host}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Code Snippets */}
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
        <CodeBlockCopy code={codeSnippets[selectedLang]} language={selectedLang} title={`GoatExternalLinkWarningDialog (${selectedLang.toUpperCase()})`} />
      </div>
    </div>
  );
};
