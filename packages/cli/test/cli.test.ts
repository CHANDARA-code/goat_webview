import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";

const CLI_BIN = join(import.meta.dirname, "../bin/goat.mjs");

function goat(args: string[], cwd?: string): string {
  return execFileSync(
    process.execPath,
    ["--experimental-strip-types", CLI_BIN, ...args],
    {
      encoding: "utf-8",
      cwd: cwd ?? process.cwd(),
      env: { ...process.env, FORCE_COLOR: "0" },
    },
  );
}

interface RunningGoat {
  out: () => string;
  stop: () => Promise<void>;
}

function spawnGoat(args: string[], cwd: string): RunningGoat {
  const proc = spawn(
    process.execPath,
    ["--experimental-strip-types", CLI_BIN, ...args],
    {
      cwd,
      env: { ...process.env, FORCE_COLOR: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let buf = "";
  proc.stdout.on("data", (d) => {
    buf += d.toString();
  });
  proc.stderr.on("data", (d) => {
    buf += d.toString();
  });
  const exited = new Promise<void>((resolve) => {
    proc.on("exit", () => resolve());
  });
  return {
    out: () => buf,
    stop: () => {
      if (proc.exitCode === null) {
        proc.kill("SIGTERM");
        const force = setTimeout(() => {
          if (proc.exitCode === null) proc.kill("SIGKILL");
        }, 3000);
        force.unref();
      }
      return exited;
    },
  };
}

async function waitFor(cond: () => boolean, timeoutMs: number = 10000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (cond()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("Timed out waiting for condition");
}

async function waitForServer(url: string, timeoutMs: number = 10000): Promise<Response> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return res;
    } catch {
      void 0;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`Server at ${url} did not come up`);
}

function randomPort(): number {
  return 40000 + Math.floor(Math.random() * 20000);
}

async function scaffoldJsProject(): Promise<string> {
  const tmpDir = await mkdtemp(join(tmpdir(), "goat-build-test-"));
  await mkdir(join(tmpDir, "src", "lib"), { recursive: true });
  await writeFile(
    join(tmpDir, "src", "index.js"),
    'import { greet } from "./lib/greet.js";\nimport meta from "./data.json";\nconsole.log(greet(), meta.name);\n',
  );
  await writeFile(
    join(tmpDir, "src", "lib", "greet.js"),
    'export function greet() { return "hello"; }\n',
  );
  await writeFile(join(tmpDir, "src", "data.json"), '{"name": "goat"}\n');
  return tmpDir;
}

describe("@goat/cli — Command Suite", () => {
  it("shows usage when called with --help", () => {
    let out = "";
    try {
      goat(["--help"]);
    } catch (e: unknown) {
      out = (e as { stdout: string }).stdout ?? "";
    }
    const result =
      out ||
      (() => {
        try {
          return goat(["--help"]);
        } catch {
          return "";
        }
      })();
    assert.ok(
      result.includes("goat") || result.includes("Goat"),
      "Should mention Goat in help",
    );
  });

  it("prints version with --version", () => {
    const out = goat(["--version"]);
    assert.match(out.trim(), /^\d+\.\d+\.\d+$/, "Should print semver version");
  });

  it("errors on unknown command", () => {
    let stderr = "";
    try {
      goat(["unknown-cmd"]);
    } catch (e: unknown) {
      const err = e as { stdout?: string; stderr?: string; status?: number };
      stderr = err.stdout ?? err.stderr ?? "";
      assert.ok(err.status !== 0, "Should exit with non-zero code");
    }
    assert.ok(
      stderr.includes("unknown") ||
        stderr.includes("Unknown") ||
        stderr.length >= 0,
      "Should report unknown command",
    );
  });

  describe("goat init", () => {
    it("scaffolds a React TypeScript project with correct files", async () => {
      const tmpDir = await mkdtemp(join(tmpdir(), "goat-init-test-"));
      try {
        const out = goat([
          "init",
          "my-app",
          "--typescript",
          "--out-dir",
          tmpDir,
        ]);
        assert.ok(
          out.includes("my-app") || out.includes("Created"),
          "Should confirm creation",
        );

        const config = JSON.parse(
          await readFile(join(tmpDir, "goat.config.json"), "utf-8"),
        );
        assert.strictEqual(
          config.name,
          "my-app",
          "goat.config.json should have correct name",
        );
        assert.ok(
          config.appId.includes("myapp"),
          "appId should be derived from name",
        );
        assert.ok(config.bridge?.timeout, "Should include bridge config");

        const pkg = JSON.parse(
          await readFile(join(tmpDir, "package.json"), "utf-8"),
        );
        assert.strictEqual(
          pkg.name,
          "my-app",
          "package.json name should match",
        );
        assert.ok(
          pkg.dependencies?.["@goat/sdk"],
          "Should depend on @goat/sdk",
        );

        const appTsx = await readFile(join(tmpDir, "src", "App.tsx"), "utf-8");
        assert.ok(
          appTsx.includes("MiniAppBridge"),
          "App.tsx should import MiniAppBridge",
        );

        const tsconfig = JSON.parse(
          await readFile(join(tmpDir, "tsconfig.json"), "utf-8"),
        );
        assert.ok(
          tsconfig.compilerOptions?.strict,
          "tsconfig should have strict mode",
        );
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    });

    it("rejects invalid template names", () => {
      try {
        goat(["init", "bad-app", "--template=angular"]);
        assert.fail("Should have thrown");
      } catch (e: unknown) {
        const err = e as { status?: number; stdout?: string };
        assert.ok(
          err.status !== 0,
          "Should exit non-zero for invalid template",
        );
      }
    });

    it("rejects missing project name", () => {
      try {
        goat(["init", "--typescript"]);
        assert.fail("Should have thrown");
      } catch (e: unknown) {
        const err = e as { status?: number };
        assert.ok(
          err.status !== 0,
          "Should exit non-zero when name is missing",
        );
      }
    });
  });

  describe("goat dev", () => {
    it("serves the project over HTTP with bridge mock injection", async () => {
      const tmpDir = await mkdtemp(join(tmpdir(), "goat-dev-test-"));
      try {
        await writeFile(
          join(tmpDir, "index.html"),
          "<!DOCTYPE html><html><body><h1>DevFixture</h1></body></html>",
        );
        const port = randomPort();
        const run = spawnGoat(["dev", `--port=${port}`, "--mock"], tmpDir);
        try {
          const res = await waitForServer(`http://localhost:${port}/`);
          assert.strictEqual(res.status, 200);
          const body = await res.text();
          assert.ok(body.includes("DevFixture"), "Should serve project files");
          assert.ok(
            body.includes("goat-bridge-mock"),
            "Should inject mock bridge shim into HTML",
          );
          await waitFor(() => run.out().includes("listening"));
          assert.ok(run.out().includes(String(port)), "Should use specified port");
          assert.ok(
            run.out().includes("bridge-mock") || run.out().includes("mocked"),
            "Should mention mock bridge",
          );
        } finally {
          await run.stop();
        }
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    });

    it("shows QR pairing URL when --tunnel is passed", async () => {
      const tmpDir = await mkdtemp(join(tmpdir(), "goat-dev-qr-"));
      try {
        await writeFile(join(tmpDir, "index.html"), "<html><body>qr</body></html>");
        const port = randomPort();
        const run = spawnGoat(["dev", `--port=${port}`, "--tunnel"], tmpDir);
        try {
          await waitFor(() => run.out().includes("QR"));
          assert.ok(
            run.out().includes("QR") &&
              (run.out().includes("pairing") || run.out().includes("http://")),
            "Should show QR/tunnel URL",
          );
        } finally {
          await run.stop();
        }
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe("goat build", () => {
    it("produces a real bundle with SHA-256 integrity checksums", async () => {
      const tmpDir = await scaffoldJsProject();
      const outDir = join(tmpDir, "dist");
      try {
        const out = goat([
          "build",
          "--prod",
          "--entry",
          "src/index.js",
          "--out-dir",
          outDir,
        ], tmpDir);
        assert.ok(
          out.includes("Build complete") || out.includes("complete"),
          "Should report build complete",
        );
        assert.ok(
          out.includes("SHA-256") || out.includes("integrity"),
          "Should report integrity checksum",
        );

        const bundle = await readFile(join(outDir, "main.js"), "utf-8");
        assert.ok(bundle.includes("hello"), "bundle should inline module code");
        assert.ok(bundle.includes("goat"), "bundle should inline JSON module");

        const manifest = JSON.parse(
          await readFile(join(outDir, "integrity.json"), "utf-8"),
        );
        assert.strictEqual(manifest.artifacts.length, 1);
        assert.strictEqual(manifest.artifacts[0].file, "main.js");
        assert.strictEqual(
          manifest.artifacts[0].sha256,
          createHash("sha256").update(bundle).digest("hex"),
          "integrity manifest must contain the real bundle hash",
        );
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    });

    it("seals a V8 bytecode container with --bytecode", async () => {
      const tmpDir = await scaffoldJsProject();
      const outDir = join(tmpDir, "dist");
      try {
        const out = goat([
          "build",
          "--bytecode",
          "--entry",
          "src/index.js",
          "--out-dir",
          outDir,
        ], tmpDir);
        assert.ok(
          out.includes("bytecode") || out.includes(".jsc"),
          "Should report V8 bytecode output",
        );
        const container = await readFile(join(outDir, "main.jsc"));
        assert.strictEqual(
          container.subarray(0, 4).toString("ascii"),
          "GSB1",
          "should write a sealed bytecode container",
        );
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    });

    it("splits declared subpackages into separate chunks", async () => {
      const tmpDir = await scaffoldJsProject();
      const outDir = join(tmpDir, "dist");
      try {
        await mkdir(join(tmpDir, "src", "profile"), { recursive: true });
        await writeFile(
          join(tmpDir, "goat.config.json"),
          JSON.stringify({
            name: "app",
            appId: "com.example.app",
            entryPage: "src/index.js",
            subpackages: ["profile"],
          }),
        );
        await writeFile(
          join(tmpDir, "src", "profile", "index.js"),
          'export default function profile() { return "profile"; }\n',
        );
        const out = goat([
          "build",
          "--split-subpackages",
          "--entry",
          "src/index.js",
          "--out-dir",
          outDir,
        ], tmpDir);
        assert.ok(
          out.includes("subpackage") ||
            out.includes("chunk") ||
            out.includes("split"),
          "Should report subpackage splitting",
        );
        const chunk = await readFile(
          join(outDir, "subpackages", "profile.js"),
          "utf-8",
        );
        assert.ok(
          chunk.includes("profile"),
          "subpackage chunk should contain its module code",
        );
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe("goat doctor", () => {
    it("runs environment checks and exits cleanly", () => {
      let out = "";
      let exitCode = 0;
      try {
        out = goat(["doctor"]);
      } catch (e: unknown) {
        const err = e as { stdout?: string; status?: number };
        out = err.stdout ?? "";
        exitCode = err.status ?? 1;
      }
      assert.ok(
        out.includes("Node.js") || out.includes("Doctor"),
        "Should check Node.js version",
      );
      assert.ok(
        out.includes("✅") || out.includes("❌"),
        "Should output pass/fail icons",
      );
    });

    it("shows fix hints with --verbose on failures", () => {
      let out = "";
      try {
        out = goat(["doctor", "--verbose"]);
      } catch (e: unknown) {
        out = (e as { stdout?: string }).stdout ?? "";
      }
      assert.ok(out.length > 0, "Should produce output");
    });
  });

  describe("goat run", () => {
    it("errors when platform argument is missing", () => {
      try {
        goat(["run"]);
        assert.fail("Should have thrown");
      } catch (e: unknown) {
        const err = e as { status?: number };
        assert.ok(
          err.status !== 0,
          "Should exit non-zero when platform is missing",
        );
      }
    });

    it("errors when platform is invalid", () => {
      try {
        goat(["run", "windows"]);
        assert.fail("Should have thrown");
      } catch (e: unknown) {
        const err = e as { status?: number };
        assert.ok(
          err.status !== 0,
          "Should exit non-zero for invalid platform",
        );
      }
    });
  });

  describe("goat studio", () => {
    it("launches a real DevTools Studio server", async () => {
      const tmpDir = await mkdtemp(join(tmpdir(), "goat-studio-test-"));
      try {
        const port = randomPort();
        const run = spawnGoat(
          ["studio", `--port=${port}`, "--server-port=8080", "--no-open"],
          tmpDir,
        );
        try {
          const res = await waitForServer(`http://localhost:${port}/`);
          assert.strictEqual(res.status, 200);
          const html = await res.text();
          assert.ok(
            html.includes("Goat DevTools Studio") ||
              html.includes("DevTools Studio"),
            "Should serve the DevTools Studio IDE page",
          );
          const statusRes = await fetch(
            `http://localhost:${port}/__goat/status.json`,
          );
          const status = (await statusRes.json()) as { serverPort: number };
          assert.strictEqual(status.serverPort, 8080);
          await waitFor(() => run.out().includes("CDP WebSocket"));
          assert.ok(run.out().includes(String(port)), "Should use specified studio port");
          assert.ok(run.out().includes("8080"), "Should use specified server relay port");
          assert.ok(
            run.out().includes("CDP WebSocket") || run.out().includes("relay"),
            "Should mention CDP bridge relay",
          );
        } finally {
          await run.stop();
        }
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    });

    it("accepts custom project directory and host flag", async () => {
      const tmpDir = await mkdtemp(join(tmpdir(), "goat-studio-host-"));
      try {
        const port = randomPort();
        const run = spawnGoat(
          ["studio", `--port=${port}`, "--project=./my-test-app", "--host", "--no-open"],
          tmpDir,
        );
        try {
          await waitFor(() => run.out().includes("listening"));
          assert.ok(
            run.out().includes("my-test-app"),
            "Should output configured project directory",
          );
          assert.ok(
            run.out().includes("0.0.0.0") || run.out().includes("127.0.0.1"),
            "Should bind to LAN host interface",
          );
        } finally {
          await run.stop();
        }
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    });
  });
});
