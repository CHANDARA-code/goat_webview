import React from 'react';
import Layout from '@theme/Layout';
import { SimulatorProvider } from '../context/SimulatorContext';
import { Workspace } from '../components/Workspace/Workspace';

export default function SimulatorPage(): React.ReactElement {
  return (
    <Layout
      title="Mini-App Simulator & Development Workspace"
      description="Zero-local-setup browser-only mini-app development workspace and bridge simulator for Goat WebView."
      noFooter
    >
      <SimulatorProvider>
        <Workspace />
      </SimulatorProvider>
    </Layout>
  );
}
