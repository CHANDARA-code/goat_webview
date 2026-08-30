import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'getting-started/quickstart',
        'getting-started/cli-toolchain',
        {
          type: 'category',
          label: 'Mini-App Templates',
          collapsed: false,
          items: [
            'getting-started/template-react',
            'getting-started/template-vue',
            'getting-started/template-svelte',
          ],
        },
        {
          type: 'category',
          label: 'Host App Integrations',
          collapsed: false,
          items: [
            'getting-started/host-android',
            'getting-started/host-ios',
            'getting-started/host-react-native',
            'getting-started/host-flutter',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Architecture Deep Dives',
      collapsed: false,
      items: [
        'architecture/120fps-page-stack',
        'architecture/virtual-domain-routing',
        'architecture/zero-trust-ssrf',
        'architecture/cdp-remote-debugging',
        'architecture/multi-tenant-sandboxing',
        'architecture/headless-runtime',
        'architecture/bytecode-cache',
      ],
    },
    {
      type: 'category',
      label: '18-Domain Bridge API Reference',
      collapsed: false,
      items: [
        'api/index',
        'api/core-system',
        'api/storage-sandboxing',
        'api/sandboxed-filesystem',
        'api/networking-http',
        'api/ui-navigation-bars',
        'api/hardware-sensors',
        'api/location-geofencing',
        'api/biometrics-security',
        'api/media-audio',
        'api/contacts-social',
        'api/push-notifications',
        'api/bluetooth-nfc',
        'api/web3-payments',
        'api/binary-ipc',
        'api/navigation-stack',
        'api/subpackages-wasm',
        'api/visual-rendering',
        'api/apm-telemetry',
      ],
    },
    {
      type: 'category',
      label: 'Bridge Protocol & Overview',
      collapsed: false,
      items: [
        'bridge/overview',
        'bridge/api-reference',
      ],
    },
    {
      type: 'category',
      label: 'Security & Compliance',
      collapsed: false,
      items: [
        'security/owasp-masvs-compliance',
        'security/anti-abuse-guardrails',
      ],
    },
    {
      type: 'category',
      label: 'Enterprise Managers & SPI',
      collapsed: false,
      items: [
        'enterprise/modular-plugin-spi',
        'enterprise/opentelemetry-tracing',
      ],
    },
    {
      type: 'category',
      label: 'Platform References',
      collapsed: false,
      items: [
        'platforms/android',
        'platforms/ios',
        'platforms/react-native',
        'platforms/flutter',
        'platforms/web',
      ],
    },
  ],
};

export default sidebars;
