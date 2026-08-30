/**
 * ManifestCompletionProvider — Auto-completion items for manifest.json and goat.config.json.
 */

export interface CompletionItem {
  label: string;
  kind: "Property" | "Value" | "Enum";
  detail: string;
  insertText?: string;
  documentation?: string;
}

export const VALID_PERMISSIONS = [
  "CAMERA",
  "LOCATION",
  "RECORD_AUDIO",
  "STORAGE",
  "BIOMETRIC",
  "BLUETOOTH",
  "PAYMENT",
  "CONTACTS",
  "CLIPBOARD",
  "HAPTICS",
  "NFC",
  "SYSTEM",
  "FILE_SYSTEM",
  "NETWORK",
  "MEDIA",
  "PUSH_NOTIFICATION",
  "WEB3",
  "BINARY_IPC",
];

export const VALID_ORIENTATIONS = ["portrait", "landscape", "auto"];
export const VALID_NAV_BAR_TEXT_STYLES = ["black", "white"];

export class ManifestCompletionProvider {
  public provideCompletionItems(contextKey: string): CompletionItem[] {
    if (contextKey === "permissions") {
      return VALID_PERMISSIONS.map((perm) => ({
        label: `"${perm}"`,
        kind: "Enum",
        detail: `Goat Native Permission: ${perm}`,
        documentation: `Grants mini-app access to ${perm.toLowerCase()} capability.`,
      }));
    }

    if (contextKey === "orientation") {
      return VALID_ORIENTATIONS.map((orient) => ({
        label: `"${orient}"`,
        kind: "Value",
        detail: `Screen orientation: ${orient}`,
      }));
    }

    if (contextKey === "navigationBarTextStyle") {
      return VALID_NAV_BAR_TEXT_STYLES.map((style) => ({
        label: `"${style}"`,
        kind: "Value",
        detail: `Navigation bar text style: ${style}`,
      }));
    }

    // Default top-level properties
    return [
      {
        label: '"appId"',
        kind: "Property",
        detail: "Unique reverse-domain identifier (e.g. com.example.app)",
      },
      {
        label: '"appName"',
        kind: "Property",
        detail: "Display name in native header",
      },
      {
        label: '"version"',
        kind: "Property",
        detail: "Semantic version string (e.g. 1.0.0)",
      },
      {
        label: '"versionCode"',
        kind: "Property",
        detail: "Monotonic integer version code",
      },
      {
        label: '"entryPage"',
        kind: "Property",
        detail: "Path to entry HTML/JS document",
      },
      {
        label: '"window"',
        kind: "Property",
        detail: "Window & navigation bar settings",
      },
      {
        label: '"permissions"',
        kind: "Property",
        detail: "Declared native permissions array",
      },
      {
        label: '"subpackages"',
        kind: "Property",
        detail: "Subpackage bundle definitions",
      },
    ];
  }
}
