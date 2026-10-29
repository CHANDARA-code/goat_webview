import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import { MobileOutlined, CodeOutlined } from '@ant-design/icons';
import { SimulatorProvider } from '../context/SimulatorContext';
import { DeviceSimulator } from '../components/DeviceSimulator';
import { ComponentShowcase } from '../components/ComponentShowcase';
import styles from './showcase.module.css';

export default function ShowcasePage(): React.ReactElement {
  return (
    <Layout
      title="Native Component Showcase Matrix"
      description="Interactive playgrounds and code generation for Goat WebView native widgets: NavigationBar, BottomSheet, PermissionPriming, ExternalLinkWarning, Haptics, and Biometrics."
    >
      <SimulatorProvider>
        <main className={styles.page}>
          <div className={styles.header}>
            <div className={styles.headerText}>
              <h1 className={styles.title}>Native Component Showcase</h1>
              <p className={styles.subtitle}>
                Six native UI components, each with live parameters and ready-to-paste SDK snippets for
                TypeScript, Kotlin, Swift, and Dart. Every change renders on the device preview instantly —
                no emulator, no native toolchain.
              </p>
            </div>
            <Link className={styles.workspaceLink} to="/simulator">
              <CodeOutlined />
              Open full workspace
            </Link>
          </div>

          <div className={styles.grid}>
            <div className={styles.content}>
              <ComponentShowcase />
            </div>

            <aside className={styles.aside}>
              <div className={styles.asideLabel}>
                <MobileOutlined />
                Live preview
              </div>
              <DeviceSimulator showControls={true} />
            </aside>
          </div>
        </main>
      </SimulatorProvider>
    </Layout>
  );
}
