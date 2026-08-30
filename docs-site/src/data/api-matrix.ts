/**
 * Goat WebView Ecosystem — Master 18-Domain & 197-Action API Matrix Data
 * Authoritative Type-Safe Reference Dataset for docs-site & ApiCatalog component.
 */

import { coreActions } from './domains/core';
import { storageActions } from './domains/storage';
import { fsActions } from './domains/fs';
import { networkActions } from './domains/network';
import { uiActions } from './domains/ui';
import { sensorActions } from './domains/sensors';
import { locationActions } from './domains/location';
import { biometricActions } from './domains/biometrics';
import { mediaActions } from './domains/media';
import { contactsActions } from './domains/contacts';
import { pushActions } from './domains/push';
import { bleActions } from './domains/ble';
import { web3Actions } from './domains/web3';
import { binaryActions } from './domains/binary';
import { navigationActions } from './domains/navigation';
import { subpackageActions } from './domains/subpackages';
import { renderingActions } from './domains/rendering';
import { apmActions } from './domains/apm';

export interface ApiParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
  defaultValue?: string;
}

export interface ApiError {
  code: string;
  meaning: string;
  troubleshooting: string;
}

export interface ApiPermissions {
  manifest: string[];
  scope: string;
  requiresGesture: boolean;
}

export interface ApiPlatformSupport {
  android: boolean;
  ios: boolean;
  reactNative: boolean;
  flutter: boolean;
  web: boolean;
}

export interface ApiSnippets {
  typescript: string;
  kotlin: string;
  swift: string;
  dart: string;
}

export interface ApiAction {
  id: string;
  action: string;
  aliases: string[];
  domain: string;
  domainSlug: string;
  description: string;
  purpose: string;
  permissions: ApiPermissions;
  params: ApiParam[];
  returns: {
    type: string;
    schema: Record<string, any>;
    description: string;
  };
  errors: ApiError[];
  platforms: ApiPlatformSupport;
  snippets: ApiSnippets;
  executable: boolean;
  defaultPayload?: Record<string, any>;
}

export interface ApiDomain {
  id: string;
  name: string;
  slug: string;
  actionCount: number;
  description: string;
  icon: string;
  badgeColor: string;
}

export const API_DOMAINS: ApiDomain[] = [
  {
    id: '1',
    name: 'Core & System Lifecycle',
    slug: 'core-system',
    actionCount: 12,
    description: 'Hardware metrics, vibration haptics, status bar appearance, brightness, screen wake locks, clipboard exchange, back navigation, and secure OAuth sessions.',
    icon: '⚡',
    badgeColor: '#3b82f6',
  },
  {
    id: '2',
    name: 'Multi-Tenant Storage & Sandboxing',
    slug: 'storage-sandboxing',
    actionCount: 16,
    description: 'Hardware-backed AES-256-GCM enclave storage, tenant isolation per appId, RFC 6265 cookie management, and web storage quota accounting.',
    icon: '🔒',
    badgeColor: '#10b981',
  },
  {
    id: '3',
    name: 'Sandboxed FileSystem & Chooser',
    slug: 'sandboxed-filesystem',
    actionCount: 11,
    description: 'Sandboxed file I/O operations inside app-isolated directory (/sandbox/data/{appId}/) with path-traversal guards and native file choosers.',
    icon: '📁',
    badgeColor: '#f59e0b',
  },
  {
    id: '4',
    name: 'Networking, HTTP & WebSockets',
    slug: 'networking-http',
    actionCount: 10,
    description: 'Zero-trust networking stack with anti-SSRF protections, chunked streaming downloads/uploads, WebSocket bridge, and SSL pinning audits.',
    icon: '🌐',
    badgeColor: '#06b6d4',
  },
  {
    id: '5',
    name: 'UI, Navigation Bar & Sheets',
    slug: 'ui-navigation-bars',
    actionCount: 28,
    description: 'Native navigation bar styling, multi-snap draggable bottom sheets, safe-area window insets, toasts, modals, and multi-tab presentation.',
    icon: '🎨',
    badgeColor: '#8b5cf6',
  },
  {
    id: '6',
    name: 'Hardware Sensors & Telephony',
    slug: 'hardware-sensors',
    actionCount: 12,
    description: 'Hardware motion sensors (accelerometer, gyroscope, compass, device motion) with 50ms coalesced throttling, plus phone calls and SMS.',
    icon: '🧭',
    badgeColor: '#ec4899',
  },
  {
    id: '7',
    name: 'Location & Geofencing',
    slug: 'location-geofencing',
    actionCount: 7,
    description: 'High-accuracy GPS positioning (WGS84 / GCJ02), map location pickers, and circular geofence boundary transition triggers.',
    icon: '📍',
    badgeColor: '#14b8a6',
  },
  {
    id: '8',
    name: 'Biometrics & Permissions',
    slug: 'biometrics-security',
    actionCount: 8,
    description: 'Hardware biometric authentication (FaceID, TouchID, BiometricPrompt), two-stage permission priming dialogs, and COOP/COEP sandbox auditing.',
    icon: '🛡️',
    badgeColor: '#ef4444',
  },
  {
    id: '9',
    name: 'Media & Audio',
    slug: 'media-audio',
    actionCount: 7,
    description: 'Camera QR/barcode scanner, photo gallery and video pickers, multi-image preview gallery, and background audio player controller.',
    icon: '🎬',
    badgeColor: '#f97316',
  },
  {
    id: '10',
    name: 'Contacts & Social Sharing',
    slug: 'contacts-social',
    actionCount: 5,
    description: 'Address book picker with privacy guardrails, contacts counter, system share sheet, and Instagram/Snapchat Story sharing.',
    icon: '👥',
    badgeColor: '#6366f1',
  },
  {
    id: '11',
    name: 'Push Notifications',
    slug: 'push-notifications',
    actionCount: 9,
    description: 'APNs / FCM push token retrieval, application notification badges, in-app local notification dispatch, and pub/sub topic subscriptions.',
    icon: '🔔',
    badgeColor: '#e11d48',
  },
  {
    id: '12',
    name: 'Bluetooth Low Energy & NFC',
    slug: 'bluetooth-nfc',
    actionCount: 16,
    description: 'GATT client communication (device discovery, service discovery, characteristic read/write) and ISO 14443 / NDEF NFC tag operations.',
    icon: '📡',
    badgeColor: '#2563eb',
  },
  {
    id: '13',
    name: 'Web3 & Payments',
    slug: 'web3-payments',
    actionCount: 7,
    description: 'EVM / Solana Web3 wallet connection, transaction signing with user gesture gate, in-app invoice checkout, and IAP product queries.',
    icon: '💳',
    badgeColor: '#059669',
  },
  {
    id: '14',
    name: 'Binary IPC Channels',
    slug: 'binary-ipc',
    actionCount: 4,
    description: 'High-throughput, zero-copy ArrayBuffer binary message ports for large payloads (images, audio frames, WASM memory buffers).',
    icon: '⚡',
    badgeColor: '#7c3aed',
  },
  {
    id: '15',
    name: 'Navigation & Predictive Back',
    slug: 'navigation-stack',
    actionCount: 12,
    description: 'Multi-page navigation stack management (push, pop, replace, popToRoot) and Android 14+ / iOS 18+ predictive back gesture physics.',
    icon: '🔙',
    badgeColor: '#0284c7',
  },
  {
    id: '16',
    name: 'Subpackages, WASM & Bytecode',
    slug: 'subpackages-wasm',
    actionCount: 9,
    description: 'Dynamic on-demand subpackage downloading and extraction, V8 code cache / JSC bytecode precompilation, and WASM SIMD validation.',
    icon: '📦',
    badgeColor: '#d97706',
  },
  {
    id: '17',
    name: 'Visual Rendering & Same-Layer',
    slug: 'visual-rendering',
    actionCount: 10,
    description: 'WebView window transparency, anti-white-flash background color synchronization, nested scrolling coordinator, and same-layer native views.',
    icon: '🖼️',
    badgeColor: '#475569',
  },
  {
    id: '18',
    name: 'APM & Telemetry',
    slug: 'apm-telemetry',
    actionCount: 14,
    description: 'Runtime API capability discovery, dynamic plugin registration, isolated process status, boot SLA benchmark metrics, and OpenTelemetry spans.',
    icon: '📊',
    badgeColor: '#dc2626',
  },
];

export const ALL_API_ACTIONS: ApiAction[] = [
  ...coreActions,
  ...storageActions,
  ...fsActions,
  ...networkActions,
  ...uiActions,
  ...sensorActions,
  ...locationActions,
  ...biometricActions,
  ...mediaActions,
  ...contactsActions,
  ...pushActions,
  ...bleActions,
  ...web3Actions,
  ...binaryActions,
  ...navigationActions,
  ...subpackageActions,
  ...renderingActions,
  ...apmActions,
];

export function getDomainActions(domainSlug: string): ApiAction[] {
  return ALL_API_ACTIONS.filter(action => action.domainSlug === domainSlug);
}

export function getActionById(actionId: string): ApiAction | undefined {
  return ALL_API_ACTIONS.find(a => a.id === actionId || a.action === actionId);
}

export function searchApiActions(
  query: string,
  options?: {
    domainSlug?: string;
    platform?: keyof ApiPlatformSupport;
    permissionRequired?: boolean;
  }
): ApiAction[] {
  let results = ALL_API_ACTIONS;

  if (options?.domainSlug && options.domainSlug !== 'all') {
    results = results.filter(a => a.domainSlug === options.domainSlug);
  }

  if (options?.platform) {
    results = results.filter(a => a.platforms[options.platform!]);
  }

  if (options?.permissionRequired !== undefined) {
    results = results.filter(a => (a.permissions.scope !== 'none') === options.permissionRequired);
  }

  if (!query || query.trim() === '') {
    return results;
  }

  const q = query.toLowerCase().trim();
  return results.filter(a => {
    return (
      a.action.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.purpose.toLowerCase().includes(q) ||
      a.domain.toLowerCase().includes(q) ||
      a.aliases.some(alias => alias.toLowerCase().includes(q)) ||
      a.permissions.scope.toLowerCase().includes(q) ||
      a.permissions.manifest.some(m => m.toLowerCase().includes(q))
    );
  });
}
