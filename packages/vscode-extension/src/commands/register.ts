import { GoatCommands } from "./GoatCommands.js";

export interface VscodeLike {
  commands: {
    registerCommand(
      command: string,
      callback: (...args: unknown[]) => unknown,
    ): { dispose(): void };
  };
  window: {
    showInputBox(options?: {
      prompt?: string;
      placeHolder?: string;
    }): Promise<string | undefined>;
    showInformationMessage(message: string): Promise<string | undefined>;
    showErrorMessage(message: string): Promise<string | undefined>;
  };
}

export interface ExtensionContextLike {
  subscriptions: Array<{ dispose(): void }>;
}

export const GOAT_COMMAND_IDS = [
  "goat.init",
  "goat.dev",
  "goat.openSimulator",
  "goat.runAndroid",
  "goat.runIos",
  "goat.doctor",
  "goat.openTraces",
];

export function registerGoatCommands(
  context: ExtensionContextLike,
  vscode: VscodeLike,
): string[] {
  const registered: string[] = [];

  const register = (
    id: string,
    handler: (...args: unknown[]) => unknown,
  ): void => {
    const disposable = vscode.commands.registerCommand(id, handler);
    if (context && Array.isArray(context.subscriptions)) {
      context.subscriptions.push(disposable);
    }
    registered.push(id);
  };

  register("goat.init", async () => {
    const name = await vscode.window.showInputBox({
      prompt: "Mini-app project name",
      placeHolder: "my-mini-app",
    });
    if (!name) return;
    const result = await GoatCommands.scaffoldProject(name);
    if (result.status === "success") {
      await vscode.window.showInformationMessage(result.message);
    } else {
      await vscode.window.showErrorMessage(result.message);
    }
  });

  register("goat.dev", async () => {
    await vscode.window.showInformationMessage(
      "Goat dev server starting on the configured port (goat.devServerPort)",
    );
  });

  register("goat.openSimulator", async () => {
    const result = await GoatCommands.runSimulator();
    await vscode.window.showInformationMessage(result.message);
  });

  register("goat.runAndroid", async () => {
    const result = await GoatCommands.runDevice("android");
    await vscode.window.showInformationMessage(result.message);
  });

  register("goat.runIos", async () => {
    const result = await GoatCommands.runDevice("ios");
    await vscode.window.showInformationMessage(result.message);
  });

  register("goat.doctor", async () => {
    const result = await GoatCommands.triggerDevDoctor();
    await vscode.window.showInformationMessage(result.message);
  });

  register("goat.openTraces", async () => {
    await vscode.window.showInformationMessage(
      "Bridge Trace Inspector — connect DevTools Studio to the CDP relay to inspect live traces",
    );
  });

  return registered;
}
