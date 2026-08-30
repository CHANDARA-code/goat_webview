import { GoatCapabilityRegistry, GoatCapabilityPlugin } from '../GoatCapabilityPlugin';

describe('GoatCapabilityRegistry SPI Suite (Task 10202)', () => {
  let registry: GoatCapabilityRegistry;

  beforeEach(() => {
    registry = GoatCapabilityRegistry.instance;
    registry.clear();
  });

  test('registers companion capability plugins and indexes actions', async () => {
    const mediaPlugin: GoatCapabilityPlugin = {
      namespace: 'media',
      supportedActions: ['CHOOSE_IMAGE', 'RECORD_AUDIO', 'PLAY_AUDIO'],
      handleAction: async (action, payload) => {
        if (action === 'CHOOSE_IMAGE') {
          return { uri: 'file:///media/img_123.jpg', mimeType: 'image/jpeg' };
        }
        return { success: true };
      },
    };

    const scannerPlugin: GoatCapabilityPlugin = {
      namespace: 'scanner',
      supportedActions: ['SCAN_CODE', 'GENERATE_BARCODE'],
      handleAction: async (action, payload) => {
        if (action === 'SCAN_CODE') {
          return { content: 'https://goat.dev', format: 'QR_CODE' };
        }
        return { success: true };
      },
    };

    registry.registerPlugin(mediaPlugin);
    registry.registerPlugin(scannerPlugin);

    expect(registry.canHandle('CHOOSE_IMAGE')).toBe(true);
    expect(registry.canHandle('SCAN_CODE')).toBe(true);
    expect(registry.canHandle('NON_EXISTENT_ACTION')).toBe(false);

    expect(registry.registeredNamespaces).toEqual(['media', 'scanner']);
    expect(registry.allSupportedActions).toContain('CHOOSE_IMAGE');
    expect(registry.allSupportedActions).toContain('SCAN_CODE');

    // Dispatching actions
    const mediaRes = await registry.dispatchAction('CHOOSE_IMAGE', {});
    expect(mediaRes.uri).toBe('file:///media/img_123.jpg');

    const scanRes = await registry.dispatchAction('SCAN_CODE', {});
    expect(scanRes.content).toBe('https://goat.dev');

    // Unregistering
    registry.unregisterPlugin('media');
    expect(registry.canHandle('CHOOSE_IMAGE')).toBe(false);
    expect(registry.canHandle('SCAN_CODE')).toBe(true);
  });
});
