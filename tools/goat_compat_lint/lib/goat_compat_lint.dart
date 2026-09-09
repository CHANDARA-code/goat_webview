import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/error/error.dart';
import 'package:analyzer/error/listener.dart';
import 'package:custom_lint_builder/custom_lint_builder.dart';

PluginBase createPlugin() => _GoatCompatLintPlugin();

class _GoatCompatLintPlugin extends PluginBase {
  @override
  List<LintRule> getLintRules(CustomLintConfigs configs) => [
        NoRetainedCompatConfig(),
      ];
}

/// T14 (`TASK_PORTABLE_PLUG_AND_PLAY_ADAPTER.md`): forbids storing a
/// `goat_webview_compat` migration/config value type in a field, top-level
/// variable, or generic state holder (`ValueNotifier<T>`,
/// `StateController<T>`, etc.) — these types must be built inline and passed
/// straight to `InAppWebView`/its controller, never kept alive past that call
/// (G1). Escape hatch: `// ignore: goat_compat_retained_config`.
class NoRetainedCompatConfig extends DartLintRule {
  NoRetainedCompatConfig() : super(code: _code);

  static const _code = LintCode(
    name: 'goat_compat_retained_config',
    problemMessage:
        'Migration/compat config must be built inline and passed to InAppWebView, '
        'never stored — retaining it wastes RAM for the process lifetime (G1).',
    correctionMessage:
        'Construct this value inline at the call site instead of storing it '
        'in a field, top-level variable, or notifier/provider.',
    errorSeverity: ErrorSeverity.WARNING,
  );

  static const _bannedTypeNames = {
    'InAppWebViewSettings',
    'InAppWebViewGroupOptions',
    'InAppWebViewOptions',
    'URLRequest',
    'PullToRefreshSettings',
    'LoadedResource',
  };

  static const _widgetSuperclassNames = {
    'StatefulWidget',
    'StatelessWidget',
    'Widget',
  };

  bool _isBanned(TypeAnnotation? type) {
    if (type is! NamedType) return false;
    if (_bannedTypeNames.contains(type.name2.lexeme)) return true;
    final typeArgs = type.typeArguments?.arguments;
    if (typeArgs == null) return false;
    return typeArgs.any(_isBanned);
  }

  /// A field only counts as "retained" (G1) when it outlives one build/call.
  /// Two shapes don't: (1) a `Widget` subclass's own constructor-parameter
  /// field — that's the widget's per-build configuration, discarded with the
  /// widget itself, not state; (2) a field inside one of this package's own
  /// `@immutable` value types — that's the type's definition (composing one
  /// value type inside another), not a consumer holding onto config.
  bool _isExemptEnclosingClass(FieldDeclaration node) {
    final enclosingClass = node.parent;
    if (enclosingClass is! ClassDeclaration) return false;
    final superclassName =
        enclosingClass.extendsClause?.superclass.name2.lexeme;
    if (superclassName != null &&
        _widgetSuperclassNames.contains(superclassName)) {
      return true;
    }
    return enclosingClass.metadata
        .any((annotation) => annotation.name.name == 'immutable');
  }

  @override
  void run(
    CustomLintResolver resolver,
    ErrorReporter reporter,
    CustomLintContext context,
  ) {
    context.registry.addFieldDeclaration((node) {
      final type = node.fields.type;
      if (!_isBanned(type)) return;
      if (_isExemptEnclosingClass(node)) return;
      for (final variable in node.fields.variables) {
        reporter.reportErrorForNode(_code, variable);
      }
    });

    context.registry.addTopLevelVariableDeclaration((node) {
      final type = node.variables.type;
      if (!_isBanned(type)) return;
      for (final variable in node.variables.variables) {
        reporter.reportErrorForNode(_code, variable);
      }
    });
  }
}
