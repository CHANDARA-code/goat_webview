/**
 * @goat/devtools - Monaco Editor Setup & Service Registrar
 */

import { GOAT_BRIDGE_DTS } from './typings/goatBridgeRawDts.ts';
import { registerGoatBridgeCompletionProvider } from './completionProvider.ts';
import { registerGoatBridgeHoverProvider } from './hoverProvider.ts';

let isConfigured = false;

export function configureMonaco(monaco: any): void {
  if (isConfigured || !monaco) return;

  // 1. Configure TypeScript / JavaScript language defaults
  if (monaco.languages && monaco.languages.typescript) {
    const tsDefaults = monaco.languages.typescript.typescriptDefaults;
    const jsDefaults = monaco.languages.typescript.javascriptDefaults;

    const compilerOptions = {
      target: monaco.languages.typescript?.ScriptTarget?.ES2022 ?? 99,
      allowNonTextFiles: true,
      allowJs: true,
      jsx: monaco.languages.typescript?.JsxEmit?.React ?? 2,
      moduleResolution: monaco.languages.typescript?.ModuleResolutionKind?.NodeJs ?? 2,
      module: monaco.languages.typescript?.ModuleKind?.ESNext ?? 99,
      noEmit: true,
      typeRoots: ['node_modules/@types'],
    };

    tsDefaults?.setCompilerOptions?.(compilerOptions);
    jsDefaults?.setCompilerOptions?.(compilerOptions);

    // Register ambient GoatBridge type declarations
    tsDefaults?.addExtraLib?.(
      GOAT_BRIDGE_DTS,
      'ts:goat-bridge.d.ts'
    );
    jsDefaults?.addExtraLib?.(
      GOAT_BRIDGE_DTS,
      'ts:goat-bridge.d.ts'
    );
  }

  // 2. Configure JSON Diagnostics & Schemas
  if (monaco.languages && monaco.languages.json) {
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: true,
      schemas: [
        {
          uri: 'https://goat-engine.dev/schemas/v1/manifest.schema.json',
          fileMatch: ['*manifest.json'],
          schema: {
            $schema: 'http://json-schema.org/draft-07/schema#',
            type: 'object',
            required: ['appId', 'appName', 'version', 'versionCode', 'entryPage'],
            properties: {
              appId: { type: 'string', pattern: '^[a-z0-9]+(\\.[a-z0-9]+)+$' },
              appName: { type: 'string' },
              version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+(-[a-z0-9.]+)?$' },
              versionCode: { type: 'integer', minimum: 1 },
              entryPage: { type: 'string' },
              permissions: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: [
                    'CAMERA',
                    'LOCATION',
                    'RECORD_AUDIO',
                    'STORAGE',
                    'BIOMETRIC',
                    'BLUETOOTH',
                    'PAYMENT',
                    'CONTACTS',
                    'CLIPBOARD',
                    'HAPTICS',
                    'NFC',
                  ],
                },
              },
            },
          },
        },
        {
          uri: 'https://goat-engine.dev/schemas/v1/goat.config.schema.json',
          fileMatch: ['*goat.config.json'],
          schema: {
            $schema: 'http://json-schema.org/draft-07/schema#',
            type: 'object',
            required: ['name', 'version', 'appId', 'entryPage'],
          },
        },
      ],
    });
  }

  // 3. Register Custom Dark & Light Monaco Themes
  if (monaco.editor) {
    monaco.editor.defineTheme('goat-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955' },
        { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'type', foreground: '4EC9B0' },
      ],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.foreground': '#d4d4d4',
        'editor.lineHighlightBackground': '#2a2d2e',
        'editorCursor.foreground': '#007acc',
        'editorWhitespace.foreground': '#3e3e3e',
        'editorIndentGuide.background': '#404040',
        'editorIndentGuide.activeBackground': '#707070',
      },
    });

    monaco.editor.defineTheme('goat-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '008000' },
        { token: 'keyword', foreground: '0000FF', fontStyle: 'bold' },
        { token: 'string', foreground: 'A31515' },
        { token: 'number', foreground: '098658' },
        { token: 'type', foreground: '267F99' },
      ],
      colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#000000',
        'editor.lineHighlightBackground': '#f5f5f5',
        'editorCursor.foreground': '#007acc',
      },
    });
  }

  // 4. Register Autocomplete & Hover Providers
  registerGoatBridgeCompletionProvider(monaco);
  registerGoatBridgeHoverProvider(monaco);

  isConfigured = true;
}

export function setupMonacoTypings(monaco: any): void {
  configureMonaco(monaco);
}

export function setupMonacoJsonSchemas(monaco: any): void {
  configureMonaco(monaco);
}
