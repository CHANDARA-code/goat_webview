import { GoatHoverProvider } from "./providers/GoatHoverProvider.js";
import { ManifestCompletionProvider } from "./providers/ManifestCompletionProvider.js";
import { GoatDiagnosticProvider } from "./providers/GoatDiagnosticProvider.js";
import { SimulatorWebviewPanel } from "./panels/SimulatorWebviewPanel.js";
import { BridgeControlPanel } from "./panels/BridgeControlPanel.js";
import { GoatCommands } from "./commands/GoatCommands.js";
import {
  registerGoatCommands,
  type ExtensionContextLike,
  type VscodeLike,
} from "./commands/register.js";

export {
  GoatHoverProvider,
  ManifestCompletionProvider,
  GoatDiagnosticProvider,
  SimulatorWebviewPanel,
  BridgeControlPanel,
  GoatCommands,
};

export interface ActivationResult {
  version: string;
  activated: boolean;
  commands: string[];
}

export async function activate(
  context?: ExtensionContextLike,
  vscodeModule?: VscodeLike,
): Promise<ActivationResult> {
  let vscode: VscodeLike | undefined = vscodeModule;
  if (!vscode) {
    try {
      const loaded = (await import("vscode")) as unknown as
        | ({ default?: VscodeLike } & VscodeLike)
        | undefined;
      vscode = loaded?.default ?? loaded;
    } catch {
      vscode = undefined;
    }
  }
  if (!vscode) {
    return { version: "1.0.0", activated: false, commands: [] };
  }
  const ctx = context ?? { subscriptions: [] };
  const commands = registerGoatCommands(ctx, vscode);
  console.log("Goat WebView Developer Tools activated successfully.");
  return { version: "1.0.0", activated: true, commands };
}

export function deactivate(): void {}
