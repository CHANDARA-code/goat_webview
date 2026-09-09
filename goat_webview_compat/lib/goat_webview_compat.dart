/// flutter_inappwebview-compatible value types over goat_webview.
///
/// This package is a staged-migration aid, not a general-purpose WebView
/// replacement — see `dg_super_app_goat_webview_migration.md` in the parent
/// repo for the risk context that scopes its intended use to one contained
/// spike at a time, never a wholesale swap.
library goat_webview_compat;

export 'src/bootstrap.dart';
export 'src/console_message.dart';
export 'src/cookie_manager.dart';
export 'src/enums.dart';
export 'src/in_app_web_view.dart';
export 'src/in_app_web_view_controller.dart';
export 'src/navigation.dart';
export 'src/pull_to_refresh.dart';
export 'src/server_trust.dart';
export 'src/settings.dart';
export 'src/url_request.dart';
export 'src/web_resource.dart';
export 'src/web_uri.dart';
