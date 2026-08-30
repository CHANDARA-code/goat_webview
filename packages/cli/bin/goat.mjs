#!/usr/bin/env node
import { initCommand } from "../dist/commands/init.js";
import { devCommand } from "../dist/commands/dev.js";
import { studioCommand } from "../dist/commands/studio.js";
import { runCommand } from "../dist/commands/run.js";
import { buildCommand } from "../dist/commands/build.js";
import { doctorCommand } from "../dist/commands/doctor.js";

const GOAT_VERSION = "1.0.0";

const USAGE = `
🐐 Goat Mini-App CLI v${GOAT_VERSION}

Usage: goat <command> [options]

Commands:
  init <name>              Scaffold a new Goat mini-app project
  dev                      Start local development server with HMR
  studio                   Launch browser-based DevTools Studio IDE
  run <android|ios>        Build & run on emulator, simulator, or device
  build                    Production bundle with integrity checksums
  doctor                   Check development environment health

Options:
  --version, -v            Show CLI version
  --help, -h               Show this help message

Examples:
  goat init my-app --template=react --typescript
  goat dev --port=3000 --mock
  goat run android --emulator
  goat run ios --simulator --qr
  goat build --prod --bytecode
  goat doctor --fix
`.trim();

const command = process.argv[2];

if (!command || command === "--help" || command === "-h") {
  console.log(USAGE);
  process.exit(0);
}

if (command === "--version" || command === "-v") {
  console.log(GOAT_VERSION);
  process.exit(0);
}

const args = process.argv.slice(3);

switch (command) {
  case "init":
    await initCommand(args);
    break;
  case "dev":
    await devCommand(args);
    break;
  case "studio":
    await studioCommand(args);
    break;
  case "run":
    await runCommand(args);
    break;
  case "build":
    await buildCommand(args);
    break;
  case "doctor":
    await doctorCommand(args);
    break;
  default:
    console.error(`\n❌ Unknown command: "${command}"\n`);
    console.log(USAGE);
    process.exit(1);
}
