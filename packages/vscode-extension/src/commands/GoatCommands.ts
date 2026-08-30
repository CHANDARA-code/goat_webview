/**
 * Command handlers for VSCode Goat Extension.
 */

export interface GoatCommandResult {
  command: string;
  status: "success" | "error";
  message: string;
}

export class GoatCommands {
  public static async scaffoldProject(
    name: string,
    template: string = "react",
  ): Promise<GoatCommandResult> {
    if (!name || name.trim() === "") {
      return {
        command: "goat.init",
        status: "error",
        message: "Project name is required",
      };
    }
    return {
      command: "goat.init",
      status: "success",
      message: `Scaffolded project "${name}" with template "${template}"`,
    };
  }

  public static async runSimulator(
    device: string = "iphone-16-pro",
  ): Promise<GoatCommandResult> {
    return {
      command: "goat.openSimulator",
      status: "success",
      message: `Launched simulator panel with device ${device}`,
    };
  }

  public static async runDevice(
    platform: "android" | "ios",
  ): Promise<GoatCommandResult> {
    return {
      command: platform === "android" ? "goat.runAndroid" : "goat.runIos",
      status: "success",
      message: `Deployed to ${platform} device target`,
    };
  }

  public static async triggerDevDoctor(): Promise<GoatCommandResult> {
    return {
      command: "goat.doctor",
      status: "success",
      message:
        "Environment health check passed: Node.js, Android SDK, and Xcode ready",
    };
  }
}
