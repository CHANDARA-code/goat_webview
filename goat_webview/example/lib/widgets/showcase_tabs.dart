import 'dart:async';
import 'package:flutter/material.dart';
import 'package:goat_webview/goat_webview.dart';
import 'package:goat_webview_biometrics/goat_webview_biometrics.dart';
import 'package:goat_webview_bluetooth/goat_webview_bluetooth.dart';
import 'package:goat_webview_location/goat_webview_location.dart';
import 'package:goat_webview_media/goat_webview_media.dart';
import 'package:goat_webview_network/goat_webview_network.dart';
import 'package:goat_webview_payments/goat_webview_payments.dart';
import 'package:goat_webview_scanner/goat_webview_scanner.dart';
import '../models/mini_app_tab.dart';
import '../models/ipc_message.dart';
import '../services/telemetry_service.dart';

/// Container widget hosting the active Mini-App GoatWebView instance
/// and wiring event streams (onBridgeMessage, onPopupRequest, onDownloadProgress).
class MiniAppHostContainer extends StatefulWidget {
  final MiniAppTabInfo tabInfo;
  final bool isDarkMode;
  final VoidCallback onToggleTheme;

  const MiniAppHostContainer({
    super.key,
    required this.tabInfo,
    required this.isDarkMode,
    required this.onToggleTheme,
  });

  @override
  State<MiniAppHostContainer> createState() => _MiniAppHostContainerState();
}

class _MiniAppHostContainerState extends State<MiniAppHostContainer> {
  GoatWebViewController? _controller;
  bool _isLoading = true;
  int _loadProgress = 0;
  final List<StreamSubscription> _subscriptions = [];

  @override
  void dispose() {
    for (final sub in _subscriptions) {
      sub.cancel();
    }
    _subscriptions.clear();
    super.dispose();
  }

  void _setupListeners(GoatWebViewController controller) {
    // 1. onBridgeMessage Stream
    _subscriptions.add(
      controller.onBridgeMessage.listen((msg) {
        TelemetryService.instance.recordFromBridgeMessage(msg);
      }),
    );

    // 2. onPopupRequest Stream
    _subscriptions.add(
      controller.onPopupRequest.listen((request) {
        _handlePopupRequest(request);
      }),
    );

    // 3. onDownloadProgress Stream
    _subscriptions.add(
      controller.onDownloadProgress.listen((progressMap) {
        TelemetryService.instance.recordIpcMessage(
          IpcMessageEntry(
            id: 'dl_${DateTime.now().millisecondsSinceEpoch}',
            action: 'DOWNLOAD_PROGRESS',
            direction: 'INBOUND',
            status: 'SUCCESS',
            durationMs: 1.2,
            requestPayload: progressMap,
          ),
        );
      }),
    );

    // 4. Progress and Lifecycle Streams
    _subscriptions.add(
      controller.onProgressChanged.listen((progress) {
        if (mounted) {
          setState(() {
            _loadProgress = progress;
            if (progress >= 100) _isLoading = false;
          });
        }
      }),
    );

    _subscriptions.add(
      controller.onPageStarted.listen((url) {
        if (mounted) {
          setState(() {
            _isLoading = true;
          });
        }
      }),
    );

    _subscriptions.add(
      controller.onPageFinished.listen((url) {
        if (mounted) {
          setState(() {
            _isLoading = false;
          });
        }
      }),
    );
  }

  void _handlePopupRequest(GoatPopupRequest request) {
    TelemetryService.instance.recordIpcMessage(
      IpcMessageEntry(
        id: 'popup_${DateTime.now().millisecondsSinceEpoch}',
        action: 'POPUP_REQUEST',
        direction: 'INBOUND',
        status: 'SUCCESS',
        durationMs: 1.5,
        requestPayload: {
          'url': request.url,
          'target': request.target,
          'policy': request.policy.name,
          'isUserGesture': request.isUserGesture,
          'isDialog': request.isDialog,
          'windowFeatures': request.windowFeatures?.toMap(),
        },
      ),
    );

    if (!mounted) return;

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF0F172A),
        title: const Row(
          children: [
            Icon(Icons.open_in_new_rounded, color: Color(0xFF818CF8)),
            SizedBox(width: 8),
            Text(
              'Mini-App Popup Request',
              style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Mini-app requested opening a new window/modal:',
              style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(6),
              ),
              child: SelectableText(
                request.url,
                style: const TextStyle(color: Color(0xFF38BDF8), fontFamily: 'monospace', fontSize: 11),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Dismiss'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              _controller?.callJs('NATIVE_POPUP_RESPONSE', {'allowed': true});
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF6366F1)),
            child: const Text('Allow & Open'),
          ),
        ],
      ),
    );
  }

  Future<void> _sendSampleDispatch() async {
    if (_controller == null) return;
    final sw = Stopwatch()..start();
    try {
      final res = await _controller!.callJs(
        'NATIVE_DISPATCH_EVENT',
        {
          'source': 'Flutter Showcase Host',
          'tab': widget.tabInfo.title,
          'appId': widget.tabInfo.appId,
          'timestamp': DateTime.now().millisecondsSinceEpoch,
        },
      );
      sw.stop();
      TelemetryService.instance.recordIpcMessage(
        IpcMessageEntry(
          id: 'call_${DateTime.now().millisecondsSinceEpoch}',
          action: 'NATIVE_DISPATCH_EVENT',
          direction: 'OUTBOUND',
          status: 'SUCCESS',
          durationMs: sw.elapsedMicroseconds / 1000.0,
          responsePayload: res.data,
        ),
      );
    } catch (e) {
      sw.stop();
      TelemetryService.instance.recordIpcMessage(
        IpcMessageEntry(
          id: 'call_${DateTime.now().millisecondsSinceEpoch}',
          action: 'NATIVE_DISPATCH_EVENT',
          direction: 'OUTBOUND',
          status: 'ERROR',
          durationMs: sw.elapsedMicroseconds / 1000.0,
          error: e.toString(),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = widget.isDarkMode;
    final surfaceColor = isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC);
    final cardColor = isDark ? const Color(0xFF1E293B) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF0F172A);

    return Scaffold(
      backgroundColor: surfaceColor,
      appBar: AppBar(
        backgroundColor: cardColor,
        elevation: 1,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: widget.tabInfo.accentColor.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(widget.tabInfo.selectedIcon, color: widget.tabInfo.accentColor, size: 20),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.tabInfo.title,
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                    color: textColor,
                  ),
                ),
                Text(
                  '${widget.tabInfo.appId} • ${widget.tabInfo.route}',
                  style: TextStyle(
                    fontSize: 10,
                    color: isDark ? Colors.white60 : Colors.black54,
                    fontFamily: 'monospace',
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: Icon(isDark ? Icons.light_mode : Icons.dark_mode, size: 20),
            tooltip: 'Toggle Theme Mode',
            onPressed: () {
              widget.onToggleTheme();
              _controller?.setTheme(!isDark);
            },
          ),
          IconButton(
            icon: const Icon(Icons.refresh, size: 20),
            tooltip: 'Reload Mini-App',
            onPressed: () => _controller?.reload(),
          ),
        ],
      ),
      body: Column(
        children: [
          // Telemetry Status Bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: cardColor,
              border: Border(
                bottom: BorderSide(
                  color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0),
                  width: 1,
                ),
              ),
            ),
            child: Row(
              children: [
                // Scheme Badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFF10B981).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.lock_outline, size: 12, color: Color(0xFF10B981)),
                      SizedBox(width: 4),
                      Text(
                        'Virtual HTTPS Scheme (AssetLoader)',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF10B981),
                        ),
                      ),
                    ],
                  ),
                ),
                const Spacer(),
                ElevatedButton.icon(
                  onPressed: _sendSampleDispatch,
                  icon: const Icon(Icons.send_rounded, size: 12),
                  label: const Text('Call Web JS', style: TextStyle(fontSize: 11)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: widget.tabInfo.accentColor,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    minimumSize: const Size(40, 28),
                  ),
                ),
              ],
            ),
          ),

          if (_isLoading)
            LinearProgressIndicator(
              value: _loadProgress > 0 ? _loadProgress / 100.0 : null,
              backgroundColor: const Color(0xFF1E293B),
              valueColor: AlwaysStoppedAnimation<Color>(widget.tabInfo.accentColor),
              minHeight: 2,
            ),

          // PlatformView GoatWebView
          Expanded(
            child: Stack(
              children: [
                GoatWebView(
                  appId: widget.tabInfo.appId,
                  initialUrl: 'https://appassets.androidplatform.net/assets/index.html${widget.tabInfo.route}',
                  algorithmicDarkening: true,
                  popupRoutingPolicy: GoatPopupRoutingPolicy.auto,
                  onWebViewCreated: (controller) {
                    _controller = controller;
                    _setupListeners(controller);
                    GoatBiometricsCapabilityPlugin.attachTo(controller);
                    GoatBluetoothCapabilityPlugin.attachTo(controller);
                    GoatLocationCapabilityPlugin.attachTo(controller);
                    GoatMediaCapabilityPlugin.attachTo(controller);
                    GoatNetworkCapabilityPlugin.attachTo(controller);
                    GoatPaymentsCapabilityPlugin.attachTo(controller);
                    GoatScannerCapabilityPlugin.attachTo(controller);
                    if (mounted) {
                      setState(() {
                        _isLoading = false;
                      });
                    }
                    TelemetryService.instance.recordIpcMessage(
                      IpcMessageEntry(
                        id: 'init_${DateTime.now().millisecondsSinceEpoch}',
                        action: 'WEBVIEW_INITIALIZED',
                        direction: 'INBOUND',
                        status: 'SUCCESS',
                        durationMs: 1.8,
                        requestPayload: {'appId': widget.tabInfo.appId},
                      ),
                    );
                  },
                ),
                if (_isLoading && _loadProgress == 0)
                  Container(
                    color: surfaceColor,
                    child: Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          CircularProgressIndicator(
                            valueColor: AlwaysStoppedAnimation<Color>(widget.tabInfo.accentColor),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            'Loading ${widget.tabInfo.title}...',
                            style: TextStyle(
                              color: textColor,
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            widget.tabInfo.subtitle,
                            style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
