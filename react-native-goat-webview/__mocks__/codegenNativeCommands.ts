export default function codegenNativeCommands<T extends {}>(options: { supportedCommands: ReadonlyArray<keyof T> }): T {
  const commands: Record<string, any> = {};
  for (const cmd of options.supportedCommands) {
    commands[cmd as string] = jest.fn();
  }
  return commands as T;
}
