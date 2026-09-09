'use strict';

/**
 * T15 — forbid retaining migration/compat config at runtime.
 *
 * The RN twin of the Flutter `goat_compat_retained_config` lint. Compat prop objects are meant to
 * be built inline and handed to <WebView>; storing one in a module-level binding, a class field or
 * a useRef keeps it alive for the process lifetime, which is the RAM regression G1 exists to
 * prevent. Escape hatch is the usual eslint-disable comment.
 */

const CONFIG_TYPES = new Set([
  'WebViewProps',
  'WebViewSource',
  'WebViewSourceUri',
  'WebViewSourceHtml',
  'CreationProps',
]);

const CONFIG_FACTORIES = new Set(['toCreationProps']);

const MESSAGE =
  'Migration/compat config must be built inline and passed to <WebView>, never stored — ' +
  'retaining it wastes RAM for the process lifetime (G1).';

function annotationName(node) {
  const ann = node && node.typeAnnotation && node.typeAnnotation.typeAnnotation;
  if (!ann) return null;
  if (ann.type === 'TSTypeReference' && ann.typeName && ann.typeName.type === 'Identifier') {
    return ann.typeName.name;
  }
  return null;
}

function isConfigFactoryCall(init) {
  return (
    init &&
    init.type === 'CallExpression' &&
    init.callee.type === 'Identifier' &&
    CONFIG_FACTORIES.has(init.callee.name)
  );
}

module.exports = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow retaining compat/migration config objects at runtime.' },
    schema: [],
    messages: { retained: MESSAGE },
  },

  create(context) {
    function report(node) {
      context.report({ node, messageId: 'retained' });
    }

    function isRetainedScope(node) {
      // Module scope or a class body means it outlives the render that created it.
      let parent = node.parent;
      while (parent) {
        if (parent.type === 'Program') return true;
        if (parent.type === 'ClassBody') return true;
        if (
          parent.type === 'FunctionDeclaration' ||
          parent.type === 'FunctionExpression' ||
          parent.type === 'ArrowFunctionExpression'
        ) {
          return false;
        }
        parent = parent.parent;
      }
      return false;
    }

    return {
      VariableDeclarator(node) {
        const named = annotationName(node.id);
        const viaFactory = isConfigFactoryCall(node.init);
        if (!named && !viaFactory) return;
        if (named && !CONFIG_TYPES.has(named)) return;
        if (isRetainedScope(node)) report(node);
      },

      PropertyDefinition(node) {
        const named = annotationName(node.key) || annotationName(node);
        const viaFactory = isConfigFactoryCall(node.value);
        if ((named && CONFIG_TYPES.has(named)) || viaFactory) report(node);
      },

      CallExpression(node) {
        // useRef<WebViewProps>(...) / useRef(toCreationProps(...)) retains across renders.
        if (node.callee.type !== 'Identifier' || node.callee.name !== 'useRef') return;
        const typeArgs = node.typeArguments || node.typeParameters;
        const firstArg = node.arguments && node.arguments[0];
        const paramName =
          typeArgs &&
          typeArgs.params &&
          typeArgs.params[0] &&
          typeArgs.params[0].typeName &&
          typeArgs.params[0].typeName.name;
        if ((paramName && CONFIG_TYPES.has(paramName)) || isConfigFactoryCall(firstArg)) {
          report(node);
        }
      },
    };
  },
};
