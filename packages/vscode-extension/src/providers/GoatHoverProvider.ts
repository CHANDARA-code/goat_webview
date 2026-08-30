/**
 * GoatHoverProvider — Contextual hover documentation for `@goat/sdk` APIs.
 */

export interface GoatApiDoc {
  name: string;
  signature: string;
  description: string;
  permission?: string;
  returns: string;
  example: string;
}

export const GOAT_API_DOCS: Record<string, GoatApiDoc> = {
  getDeviceInfo: {
    name: "MiniAppBridge.getDeviceInfo",
    signature: "getDeviceInfo(): Promise<DeviceInfo>",
    description:
      "Retrieves hardware, OS platform, screen dimensions, pixel density, and notch / Dynamic Island safe area insets.",
    returns:
      "Promise<DeviceInfo> with platform, osVersion, screen, safeArea, and theme.",
    example:
      "const info = await bridge.getDeviceInfo();\nconsole.log(info.safeArea.top);",
  },
  scanCode: {
    name: "MiniAppBridge.scanCode",
    signature: "scanCode(options?: ScanCodeOptions): Promise<ScanCodeResult>",
    description:
      "Launches native hardware camera scanner for QR codes and barcodes with live viewfinder.",
    permission: "CAMERA",
    returns:
      "Promise<ScanCodeResult> containing decoded content string and format.",
    example:
      'const result = await bridge.scanCode({ promptMessage: "Scan payment QR" });',
  },
  authenticateBiometrics: {
    name: "MiniAppBridge.authenticateBiometrics",
    signature:
      "authenticateBiometrics(options: BiometricAuthOptions): Promise<BiometricAuthResult>",
    description:
      "Prompts the user for TouchID, FaceID, or Android BiometricPrompt authentication.",
    permission: "BIOMETRIC",
    returns:
      "Promise<BiometricAuthResult> indicating authenticated boolean status.",
    example:
      'const auth = await bridge.authenticateBiometrics({ promptMessage: "Verify payment" });',
  },
  vibrate: {
    name: "MiniAppBridge.vibrate",
    signature:
      'vibrate(type?: "light" | "medium" | "heavy" | "success" | "error"): Promise<void>',
    description: "Triggers native tactile haptic feedback actuator.",
    permission: "HAPTICS",
    returns: "Promise<void>",
    example: 'await bridge.vibrate("success");',
  },
  canIUse: {
    name: "MiniAppBridge.canIUse",
    signature: "canIUse(actionName: string): Promise<boolean>",
    description:
      "Queries the native host runtime to check whether a specific bridge action or modular plugin is available.",
    returns: "Promise<boolean>",
    example: 'if (await bridge.canIUse("NFC_WRITE_TAG")) { ... }',
  },
  setNavigationBarTitle: {
    name: "MiniAppBridge.setNavigationBarTitle",
    signature: "setNavigationBarTitle(title: string): Promise<void>",
    description:
      "Dynamically updates the native host navigation bar title for the current mini-app page.",
    returns: "Promise<void>",
    example: 'await bridge.setNavigationBarTitle("Checkout");',
  },
  openBottomSheet: {
    name: "MiniAppBridge.openBottomSheet",
    signature: "openBottomSheet(options: BottomSheetOptions): Promise<void>",
    description:
      "Presents a native bottom sheet modal stack with custom height detents and swipe-to-dismiss.",
    returns: "Promise<void>",
    example:
      'await bridge.openBottomSheet({ heightRatio: 0.6, title: "Select Card" });',
  },
};

export class GoatHoverProvider {
  public provideHover(
    text: string,
    positionOffset: number,
  ): { contents: string[] } | null {
    for (const [key, doc] of Object.entries(GOAT_API_DOCS)) {
      if (text.includes(key)) {
        const md = [
          `### 🐐 \`${doc.name}\``,
          `\`\`\`typescript\n${doc.signature}\n\`\`\``,
          doc.description,
          doc.permission
            ? `**Required Permission:** \`${doc.permission}\``
            : "**Permissions:** None required",
          `**Returns:** ${doc.returns}`,
          `**Example:**\n\`\`\`typescript\n${doc.example}\n\`\`\``,
        ];
        return { contents: md };
      }
    }
    return null;
  }
}
