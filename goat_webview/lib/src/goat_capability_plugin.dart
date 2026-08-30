import 'dart:async';

/// Service Provider Interface (SPI) for modular Goat WebView capabilities (Task 10202).
///
/// Decouples heavy native dependencies (ML Kit, AVFoundation, CoreBluetooth) from the
/// lightweight core <150KB engine. Companion packages implement this interface and register
/// via [GoatCapabilityRegistry].
abstract class GoatCapabilityPlugin {
  /// Unique namespace for this capability plugin (e.g. 'media', 'scanner', 'location').
  String get namespace;

  /// Set of bridge actions handled by this plugin (e.g. {'CHOOSE_IMAGE', 'RECORD_AUDIO'}).
  Set<String> get supportedActions;

  /// Handles an action dispatched to this capability plugin.
  ///
  /// Returns a map of response data on success, or throws an exception on error.
  Future<Map<String, dynamic>?> handleAction(
    String action,
    Map<String, dynamic> payload,
  );
}

/// Global registry for dynamic capability plugins and SPI discovery (Task 10202).
class GoatCapabilityRegistry {
  GoatCapabilityRegistry._();

  /// Singleton instance of the registry.
  static final GoatCapabilityRegistry instance = GoatCapabilityRegistry._();

  final Map<String, GoatCapabilityPlugin> _plugins = <String, GoatCapabilityPlugin>{};
  final Map<String, GoatCapabilityPlugin> _actionIndex = <String, GoatCapabilityPlugin>{};

  /// Registers a companion capability plugin.
  void registerPlugin(GoatCapabilityPlugin plugin) {
    _plugins[plugin.namespace] = plugin;
    for (final action in plugin.supportedActions) {
      _actionIndex[action] = plugin;
    }
  }

  /// Unregisters a capability plugin by namespace.
  void unregisterPlugin(String namespace) {
    final plugin = _plugins.remove(namespace);
    if (plugin != null) {
      _actionIndex.removeWhere((_, p) => p.namespace == namespace);
    }
  }

  /// Checks if an action is supported by any registered capability plugin.
  bool canHandle(String action) => _actionIndex.containsKey(action);

  /// Dispatches an action to the registered capability plugin.
  Future<Map<String, dynamic>?> dispatchAction(
    String action,
    Map<String, dynamic> payload,
  ) async {
    final plugin = _actionIndex[action];
    if (plugin == null) return null;
    return await plugin.handleAction(action, payload);
  }

  /// Lists all registered plugin namespaces.
  List<String> get registeredNamespaces => _plugins.keys.toList();

  /// Lists all registered actions across all companion plugins.
  Set<String> get allSupportedActions => Set.unmodifiable(_actionIndex.keys);

  /// Clears all registered plugins (for testing).
  void clear() {
    _plugins.clear();
    _actionIndex.clear();
  }
}
