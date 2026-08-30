import { ALL_API_ACTIONS, API_DOMAINS, searchApiActions } from '../src/data/api-matrix';

describe('18-Domain & 197-Action API Matrix Integrity Verification', () => {
  test('Should contain all 18 domains', () => {
    expect(API_DOMAINS.length).toBe(18);
    const domainSlugs = new Set(API_DOMAINS.map(d => d.slug));
    expect(domainSlugs.size).toBe(18);
  });

  test('Should contain all action strings (>= 197 actions)', () => {
    expect(ALL_API_ACTIONS.length).toBeGreaterThanOrEqual(197);
    const actionNames = new Set(ALL_API_ACTIONS.map(a => a.action));
    expect(actionNames.size).toBeGreaterThanOrEqual(197);
  });

  test('Every action must satisfy mandatory schema contract', () => {
    ALL_API_ACTIONS.forEach((action, index) => {
      expect(action.id).toBeDefined();
      expect(action.action).toBeDefined();
      expect(action.action.length).toBeGreaterThan(0);
      expect(action.domain).toBeDefined();
      expect(action.domainSlug).toBeDefined();
      expect(action.description).toBeDefined();
      expect(action.purpose).toBeDefined();

      // Permissions
      expect(action.permissions).toBeDefined();
      expect(Array.isArray(action.permissions.manifest)).toBe(true);
      expect(typeof action.permissions.scope).toBe('string');
      expect(typeof action.permissions.requiresGesture).toBe('boolean');

      // Platform support matrix
      expect(action.platforms).toBeDefined();
      expect(typeof action.platforms.android).toBe('boolean');
      expect(typeof action.platforms.ios).toBe('boolean');
      expect(typeof action.platforms.reactNative).toBe('boolean');
      expect(typeof action.platforms.flutter).toBe('boolean');
      expect(typeof action.platforms.web).toBe('boolean');

      // Return schema
      expect(action.returns).toBeDefined();
      expect(typeof action.returns.type).toBe('string');
      expect(typeof action.returns.description).toBe('string');
      expect(typeof action.returns.schema).toBe('object');

      // Multi-framework code snippets
      expect(action.snippets).toBeDefined();
      expect(typeof action.snippets.typescript).toBe('string');
      expect(typeof action.snippets.kotlin).toBe('string');
      expect(typeof action.snippets.swift).toBe('string');
      expect(typeof action.snippets.dart).toBe('string');
      expect(action.snippets.typescript.length).toBeGreaterThan(5);
    });
  });

  test('Fuzzy search and filtering should work accurately', () => {
    const biometricResults = searchApiActions('biometric');
    expect(biometricResults.length).toBeGreaterThanOrEqual(2);

    const cameraResults = searchApiActions('camera');
    expect(cameraResults.length).toBeGreaterThanOrEqual(1);

    const storageDomain = searchApiActions('', { domainSlug: 'storage-sandboxing' });
    expect(storageDomain.length).toBe(16);

    const zeroPerm = searchApiActions('', { permissionRequired: false });
    expect(zeroPerm.length).toBeGreaterThan(50);
  });
});
