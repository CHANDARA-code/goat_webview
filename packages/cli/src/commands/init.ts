/**
 * `goat init <name>` — Scaffold a new Goat mini-app project.
 */

import { parseArgs } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface InitOptions {
  name: string;
  template: "react" | "vue" | "svelte";
  typescript: boolean;
  outDir?: string;
}

function parseInitArgs(args: string[]): InitOptions {
  const name = args[0];
  if (!name || name.startsWith("--")) {
    throw new Error(
      "Usage: goat init <name> [--template=react|vue|svelte] [--typescript]",
    );
  }

  const { values } = parseArgs({
    args: args.slice(1),
    options: {
      template: { type: "string", default: "react" },
      typescript: { type: "boolean", default: true },
      "out-dir": { type: "string" },
    },
    strict: false,
  });

  const template = values.template as string as "react" | "vue" | "svelte";
  if (!["react", "vue", "svelte"].includes(template)) {
    throw new Error(
      `Invalid template "${template}". Choose from: react, vue, svelte`,
    );
  }

  return {
    name,
    template,
    typescript: values.typescript as boolean,
    outDir: values["out-dir"] as string | undefined,
  };
}

function generateGoatConfig(opts: InitOptions): string {
  return JSON.stringify(
    {
      name: opts.name,
      version: "1.0.0",
      appId: `com.example.${opts.name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}`,
      entryPage: "src/main.tsx",
      window: { title: opts.name, backgroundColor: "#ffffff" },
      permissions: [],
      subpackages: [],
      bridge: {
        timeout: 5000,
        mockMode: false,
      },
    },
    null,
    2,
  );
}

function generateIndexHtml(opts: InitOptions): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${opts.name}</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
`;
}

function generateMainTsx(opts: InitOptions): string {
  if (opts.template === "react") {
    return `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('root')!;
createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;
  }
  return `// ${opts.template} entry — see framework docs for details\n`;
}

function generateAppTsx(opts: InitOptions): string {
  return `import React, { useEffect, useState } from 'react';

// Access the native bridge injected into window by GoatWebView
declare global {
  interface Window {
    nativeBridge?: {
      postMessage: (msg: string) => void;
    };
    goatBridge?: {
      callNative: (action: string, payload?: Record<string, unknown>) => Promise<unknown>;
    };
  }
}

export default function App() {
  const [deviceInfo, setDeviceInfo] = useState<string>('Loading...');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.goatBridge) {
      window.goatBridge.callNative('GET_DEVICE_INFO', {}).then((info: any) => {
        setDeviceInfo(JSON.stringify(info, null, 2));
      }).catch(() => setDeviceInfo('Bridge not available (browser mode)'));
    } else {
      setDeviceInfo('Bridge not available (browser mode)');
    }
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h1>🐐 ${opts.name}</h1>
      <p>Your Goat mini-app is running!</p>
      <pre style={{ background: '#f4f4f4', padding: 16, borderRadius: 8 }}>
        {deviceInfo}
      </pre>
    </div>
  );
}
`;
}

function generateViteConfig(opts: InitOptions): string {
  return `import { defineConfig } from 'vite';
${opts.template === "react" ? "import react from '@vitejs/plugin-react';" : ""}

export default defineConfig({
  ${opts.template === "react" ? "plugins: [react()]," : ""}
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: { manualChunks: { vendor: ['react', 'react-dom'] } },
    },
  },
});
`;
}

function generatePackageJson(opts: InitOptions): string {
  return JSON.stringify(
    {
      name: opts.name,
      version: "1.0.0",
      private: true,
      type: "module",
      scripts: {
        dev: "goat dev",
        build: "goat build",
        preview: "vite preview",
      },
      dependencies: {
        react: "^19.0.0",
        "react-dom": "^19.0.0",
      },
      devDependencies: {
        "@types/react": "^19.0.0",
        "@types/react-dom": "^19.0.0",
        "@vitejs/plugin-react": "^4.0.0",
        vite: "^6.0.0",
        ...(opts.typescript ? { typescript: "^5.7.0" } : {}),
      },
    },
    null,
    2,
  );
}

function generateTsConfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: "ESNext",
        lib: ["ESNext", "DOM"],
        module: "ESNext",
        moduleResolution: "bundler",
        jsx: "react-jsx",
        strict: true,
        noEmit: true,
        skipLibCheck: true,
      },
      include: ["src"],
    },
    null,
    2,
  );
}

export async function initCommand(args: string[]): Promise<void> {
  let opts: InitOptions;
  try {
    opts = parseInitArgs(args);
  } catch (e: unknown) {
    console.error(`\n❌ ${(e as Error).message}\n`);
    process.exit(1);
  }

  const dest = opts.outDir ?? join(process.cwd(), opts.name);

  console.log(`\n🐐 Scaffolding Goat mini-app "${opts.name}"...`);
  console.log(
    `   Template : ${opts.template}${opts.typescript ? " + TypeScript" : ""}`,
  );
  console.log(`   Output   : ${dest}\n`);

  await mkdir(join(dest, "src"), { recursive: true });
  await mkdir(join(dest, "public"), { recursive: true });

  await writeFile(join(dest, "goat.config.json"), generateGoatConfig(opts));
  await writeFile(join(dest, "index.html"), generateIndexHtml(opts));
  await writeFile(join(dest, "src", "main.tsx"), generateMainTsx(opts));
  await writeFile(join(dest, "src", "App.tsx"), generateAppTsx(opts));
  await writeFile(join(dest, "vite.config.ts"), generateViteConfig(opts));
  await writeFile(join(dest, "package.json"), generatePackageJson(opts));
  if (opts.typescript) {
    await writeFile(join(dest, "tsconfig.json"), generateTsConfig());
  }

  console.log(`✅ Created project "${opts.name}" at ${dest}`);
  console.log(`\nNext steps:\n  cd ${opts.name}\n  npm install\n  goat dev\n`);
}
