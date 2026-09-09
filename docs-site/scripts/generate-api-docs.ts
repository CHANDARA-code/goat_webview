import * as fs from 'fs';
import * as path from 'path';
import { ALL_API_ACTIONS, API_DOMAINS, ApiAction, ApiDomain } from '../src/data/api-matrix';

const DOCS_API_DIR = path.resolve(__dirname, '../docs/api');
const DATA_JSON_FILE = path.resolve(__dirname, '../src/data/api-matrix.json');

// Ensure output directories exist
if (!fs.existsSync(DOCS_API_DIR)) {
  fs.mkdirSync(DOCS_API_DIR, { recursive: true });
}

// 1. Write api-matrix.json
fs.writeFileSync(
  DATA_JSON_FILE,
  JSON.stringify(
    {
      domains: API_DOMAINS,
      totalActions: ALL_API_ACTIONS.length,
      actions: ALL_API_ACTIONS,
    },
    null,
    2
  ),
  'utf-8'
);
console.log(`[Matrix] Exported ${ALL_API_ACTIONS.length} actions to ${DATA_JSON_FILE}`);

// Sanitize prose text for MDX compatibility
function sanitizeMdx(text: string): string {
  if (!text) return '';
  return text
    .replace(/<(\d+[a-zA-Z]*)/g, '&lt;$1') // replaces <10s, <50ms, <500ms
    .replace(/<(\s*)/g, '&lt;$1') // replaces standalone <
    .replace(/\{([a-zA-Z0-9_:\s,"']+)\}/g, '`{$1}`') // replaces {appId}, { key: value }
    .replace(/\{\}/g, '`{}`');
}

// Helper to escape markdown table cell pipes and MDX characters
function escapeCell(text: string): string {
  if (!text) return '';
  return sanitizeMdx(text).replace(/\|/g, '\\|');
}

// Generate single action markdown section
function renderActionDoc(action: ApiAction, index: number): string {
  const platformBadges = [
    action.platforms.android ? '`Android: Yes`' : '`Android: No`',
    action.platforms.ios ? '`iOS: Yes`' : '`iOS: No`',
    action.platforms.reactNative ? '`React Native: Yes`' : '`React Native: No`',
    action.platforms.flutter ? '`Flutter: Yes`' : '`Flutter: No`',
    action.platforms.web ? '`Web Mock: Yes`' : '`Web Mock: No`',
  ].join(' ');

  const aliasesText = action.aliases.length > 0
    ? action.aliases.map(a => `\`${a}\``).join(', ')
    : '_None_';

  const manifestPermissions = action.permissions.manifest.length > 0
    ? action.permissions.manifest.map(m => `\`${m}\``).join(', ')
    : '`None (Zero-Permission)`';

  const gestureBadge = action.permissions.requiresGesture
    ? '**Active User Gesture Required** (User touch within &lt;10s)'
    : '**No Gesture Required**';

  let paramsTable = '';
  if (action.params.length === 0) {
    paramsTable = '_No input parameters required (`{}`)._\n';
  } else {
    paramsTable = `| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
${action.params.map(p => `| \`${p.name}\` | \`${escapeCell(p.type)}\` | ${p.required ? '**Yes**' : 'No'} | ${p.defaultValue ? `\`${p.defaultValue}\`` : '-'} | ${escapeCell(p.description)} |`).join('\n')}\n`;
  }

  const returnJson = JSON.stringify(action.returns.schema, null, 2);

  let errorsTable = '';
  if (action.errors.length === 0) {
    errorsTable = '_This action executes without throwing domain-specific error codes._\n';
  } else {
    errorsTable = `| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
${action.errors.map(e => `| \`${e.code}\` | ${escapeCell(e.meaning)} | ${escapeCell(e.troubleshooting)} |`).join('\n')}\n`;
  }

  const anchorId = action.action.toLowerCase().replace(/_/g, '-');

  return `---

### ${index}. \`${action.action}\` {#${anchorId}}

${sanitizeMdx(action.description)}

**Purpose & Context:** ${sanitizeMdx(action.purpose)}

#### Platform Support Matrix
${platformBadges}

#### Aliases & Method Signatures
- **Canonical Action String:** \`${action.action}\`
- **Supported Aliases:** ${aliasesText}
- **Permission Scope:** \`${action.permissions.scope}\`
- **Required Manifest Permissions:** ${manifestPermissions}
- **Security Constraint:** ${gestureBadge}

#### Input Parameters
${paramsTable}

#### Return Value
- **Schema Type:** \`${action.returns.type}\`
- **Description:** ${sanitizeMdx(action.returns.description)}

\`\`\`json title="Return Payload Shape"
${returnJson}
\`\`\`

#### Error Codes & Troubleshooting
${errorsTable}

#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

\`\`\`typescript
${action.snippets.typescript}
\`\`\`

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

\`\`\`kotlin
${action.snippets.kotlin}
\`\`\`

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

\`\`\`swift
${action.snippets.swift}
\`\`\`

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

\`\`\`dart
${action.snippets.dart}
\`\`\`

  </TabItem>
</Tabs>
`;
}

// 2. Generate 18 domain markdown files
API_DOMAINS.forEach((domain, idx) => {
  const domainNumber = String(idx + 1).padStart(2, '0');
  const filename = `${domainNumber}-${domain.slug}.md`;
  const filePath = path.join(DOCS_API_DIR, filename);

  const actions = ALL_API_ACTIONS.filter(a => a.domainSlug === domain.slug);

  const markdownContent = `---
sidebar_position: ${idx + 2}
title: Domain ${idx + 1} - ${domain.name}
description: Complete API reference for ${domain.name} (${actions.length} actions).
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Domain ${idx + 1}: ${domain.name} ${domain.icon}

${sanitizeMdx(domain.description)}

**Total Actions in Domain:** \`${actions.length} actions\`

---

## Action Summary

| # | Action String | Permission | Inputs | Returns |
| :--- | :--- | :--- | :--- | :--- |
${actions.map((a, i) => `| ${i + 1} | [\`${a.action}\`](#${a.action.toLowerCase().replace(/_/g, '-')}) | \`${a.permissions.scope}\` | ${a.params.length > 0 ? a.params.map(p => `\`${p.name}\``).join(', ') : '`{}`'} | \`${a.returns.type}\` |`).join('\n')}

---

## Action Specifications

${actions.map((a, i) => renderActionDoc(a, i + 1)).join('\n\n')}
`;

  fs.writeFileSync(filePath, markdownContent, 'utf-8');
  console.log(`[Docs] Generated ${filename} (${actions.length} actions)`);
});

// 3. Generate index.md for /docs/api/
const indexContent = `---
sidebar_position: 1
title: 18-Domain API Reference Overview
description: Master 18-domain, 197-action native bridge catalog and interactive search matrix.
---

import ApiCatalog from '@site/src/components/ApiCatalog';

# Goat WebView 18-Domain API Reference

Welcome to the comprehensive API Reference Matrix for the Goat WebView Native Bridge ecosystem. The runtime standardizes **197 action strings** partitioned across **18 functional domains**, delivering 100% feature parity across Android, iOS, React Native, Flutter, and the Web Simulator.

---

## Interactive API Catalog & Search Index

Search across all 197 actions, filter by domain or platform support, inspect required Android/iOS permissions, and copy ready-to-run code snippets in TypeScript, Kotlin, Swift, and Dart.

<ApiCatalog />

---

## 18 Functional Domains Overview

| # | Domain | Actions | Description |
| :--- | :--- | :--- | :--- |
${API_DOMAINS.map(d => `| ${d.id} | [**${d.name}**](./${d.slug}) | \`${d.actionCount} actions\` | ${sanitizeMdx(d.description)} |`).join('\n')}

---

## Global Platform & Error Guarantees

Every native bridge action conforms to standard platform contracts:
- **Zero-Trust Anti-SSRF:** Outbound networking blocked against private subnets (127.0.0.1, RFC1918) and cloud metadata (169.254.169.254).
- **Tenant Storage Sandboxing:** Strict isolation of key-value preferences and file system trees per \`appId\` with 10 MB and 50 MB quota boundaries.
- **Biometric & Sensitive Feature Gesture Gate:** Actions like \`BIOMETRIC_AUTH\`, \`CLIPBOARD_GET\`, and \`WEB3_SIGN_TRANSACTION\` require an active touch gesture (&lt;10s) before dispatch.
- **Anti-Spam Dialog Throttling:** Dialog actions like \`SHOW_MODAL\` enforce a 500ms cooldown window to prevent UI lockup.
`;

fs.writeFileSync(path.join(DOCS_API_DIR, 'index.md'), indexContent, 'utf-8');
console.log(`[Docs] Generated index.md with ApiCatalog component`);
