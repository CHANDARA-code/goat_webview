import { parseArgs } from "node:util";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve, dirname, relative, extname } from "node:path";
import { createRequire } from "node:module";

export interface BuildOptions {
  prod: boolean;
  bytecode: boolean;
  splitSubpackages: boolean;
  outDir: string;
  entry?: string;
}

function parseBuildArgs(args: string[]): BuildOptions {
  const { values } = parseArgs({
    args,
    options: {
      prod: { type: "boolean", default: true },
      bytecode: { type: "boolean", default: false },
      "split-subpackages": { type: "boolean", default: false },
      "out-dir": { type: "string", default: "dist" },
      entry: { type: "string" },
    },
    strict: false,
  });
  return {
    prod: values.prod as boolean,
    bytecode: values.bytecode as boolean,
    splitSubpackages: values["split-subpackages"] as boolean,
    outDir: values["out-dir"] as string,
    entry: values.entry as string | undefined,
  };
}

function sha256(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function findEntry(root: string, entryFlag?: string): string {
  if (entryFlag) {
    const abs = resolve(root, entryFlag);
    if (!existsSync(abs) || !statSync(abs).isFile()) {
      throw new Error(`Entry point not found: ${abs}`);
    }
    return abs;
  }
  const configPath = join(root, "goat.config.json");
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      if (config.entryPage) return resolve(root, config.entryPage);
    } catch {
      void 0;
    }
  }
  const candidates = [
    "src/main.tsx",
    "src/main.ts",
    "src/App.tsx",
    "src/App.ts",
    "src/index.ts",
    "src/index.js",
    "main.ts",
    "main.js",
    "index.ts",
    "index.js",
  ];
  for (const candidate of candidates) {
    const abs = join(root, candidate);
    if (existsSync(abs) && statSync(abs).isFile()) return abs;
  }
  throw new Error(
    `No entry point found in ${root}. Pass --entry <file> or declare "entryPage" in goat.config.json.`,
  );
}

function splitTopLevel(source: string, sep: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of source) {
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    if (ch === sep && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts;
}

function extractDeclaratorNames(statement: string): string[] {
  const clean = statement.replace(/;\s*$/, "").trim();
  const body = clean.replace(/^(?:const|let|var)\s+/, "");
  return splitTopLevel(body, ",")
    .flatMap((part) => {
      const trimmed = part.trim();
      if (trimmed.startsWith("[")) {
        return trimmed
          .slice(1, trimmed.indexOf("]"))
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      if (trimmed.startsWith("{")) {
        return trimmed
          .slice(1, trimmed.indexOf("}"))
          .split(",")
          .map((s) => s.trim().replace(/:.*/, ""))
          .filter(Boolean);
      }
      return [trimmed.split(/[=:\s]/)[0].trim()];
    })
    .filter((name) => /^[A-Za-z_$][\w$]*$/.test(name));
}

function parseNamedImports(list: string): Array<[string, string]> {
  return list
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      if (item.includes(" as ")) {
        const [imported, local] = item.split(/\s+as\s+/);
        return [local.trim(), imported.trim()];
      }
      return [item, item];
    });
}

type ResolvedSpecifier =
  | { kind: "relative"; abs: string }
  | { kind: "external"; name: string }
  | { kind: "missing"; spec: string };

class MiniBundler {
  private readonly moduleCodes = new Map<string, string>();
  private readonly moduleIds = new Map<string, string>();
  private readonly externals = new Set<string>();
  private counter = 0;
  private ts: any = null;

  constructor(
    private readonly root: string,
    private readonly entryAbs: string,
  ) {}

  private moduleIdFor(abs: string): string {
    if (this.moduleIds.has(abs)) return this.moduleIds.get(abs)!;
    const rel = relative(this.root, abs).replace(/[\\/.]/g, "_");
    const base = rel || "entry";
    let id = base;
    let suffix = 0;
    while ([...this.moduleIds.values()].includes(id)) {
      id = `${base}_${++suffix}`;
    }
    this.moduleIds.set(abs, id);
    return id;
  }

  private resolveSpecifier(fromFile: string, spec: string): ResolvedSpecifier {
    if (!spec.startsWith(".")) return { kind: "external", name: spec };
    const base = resolve(dirname(fromFile), spec);
    const candidates = [base];
    if (!extname(base)) {
      candidates.push(
        `${base}.js`,
        `${base}.mjs`,
        `${base}.ts`,
        `${base}.tsx`,
        `${base}.json`,
        join(base, "index.js"),
        join(base, "index.ts"),
        join(base, "index.tsx"),
        join(base, "index.mjs"),
        join(base, "index.json"),
      );
    }
    for (const candidate of candidates) {
      try {
        if (statSync(candidate).isFile()) return { kind: "relative", abs: candidate };
      } catch {
        continue;
      }
    }
    return { kind: "missing", spec };
  }

  private loadTypescript(): any | null {
    if (this.ts) return this.ts;
    try {
      const req = createRequire(join(this.root, "__goat_resolve__.js"));
      this.ts = req("typescript");
    } catch {
      this.ts = null;
    }
    return this.ts;
  }

  private async loadModule(abs: string): Promise<string> {
    const raw = await readFile(abs, "utf-8");
    const ext = extname(abs);
    if (ext === ".json") {
      JSON.parse(raw);
      return `module.exports = ${raw.trim()};`;
    }
    if (ext === ".ts" || ext === ".tsx" || ext === ".mts") {
      const ts = this.loadTypescript();
      if (!ts) {
        throw new Error(
          `TypeScript is required to bundle ${abs} but is not installed in this project. Run "npm install" first.`,
        );
      }
      const compilerOptions: Record<string, unknown> = {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      };
      if (ext === ".tsx") compilerOptions.jsx = ts.JsxEmit.React;
      const result = ts.transpileModule(raw, {
        fileName: abs,
        reportDiagnostics: true,
        compilerOptions,
      });
      const errors = (result.diagnostics || []).filter(
        (d: any) => d.category === 1,
      );
      if (errors.length > 0) {
        const messages = errors
          .map((d: any) =>
            typeof d.messageText === "string"
              ? d.messageText
              : (d.messageText?.messageText ?? "syntax error"),
          )
          .join("; ");
        throw new Error(`Syntax errors in ${abs}: ${messages}`);
      }
      return result.outputText;
    }
    return raw;
  }

  private enqueue(abs: string): void {
    if (!this.moduleIds.has(abs) && !this.moduleCodes.has(abs)) {
      this.moduleCodes.set(abs, "PENDING");
    }
  }

  private async processModule(abs: string): Promise<void> {
    if (this.moduleCodes.has(abs) && this.moduleCodes.get(abs) !== "PENDING") {
      return;
    }
    const source = await this.loadModule(abs);
    this.moduleCodes.set(abs, this.transformModule(source, abs));
  }

  private importStatements(
    spec: string,
    fromFile: string,
    parts: { def?: string; named?: Array<[string, string]>; ns?: string },
  ): string {
    const resolved = this.resolveSpecifier(fromFile, spec);
    if (resolved.kind === "missing") {
      throw new Error(
        `Cannot resolve import "${spec}" from ${fromFile}.`,
      );
    }
    let id: string;
    if (resolved.kind === "relative") {
      this.enqueue(resolved.abs);
      id = this.moduleIdFor(resolved.abs);
    } else {
      this.externals.add(resolved.name);
      id = resolved.name;
    }
    if (parts.ns) return `const ${parts.ns} = __goat_require(${JSON.stringify(id)});`;
    const tmp = `__goat_mod${this.counter++}`;
    const lines: string[] = [
      `const ${tmp} = __goat_require(${JSON.stringify(id)});`,
    ];
    if (parts.def) lines.push(`const ${parts.def} = __goat_interop(${tmp});`);
    for (const [local, imported] of parts.named ?? []) {
      lines.push(`const ${local} = ${tmp}.${imported};`);
    }
    return lines.join("\n");
  }

  private statementEnd(code: string, start: number): number {
    let depth = 0;
    for (let i = start; i < code.length; i++) {
      const ch = code[i];
      if (ch === "(" || ch === "[" || ch === "{") depth++;
      else if (ch === ")" || ch === "]" || ch === "}") depth--;
      else if (ch === ";" && depth === 0) return i + 1;
    }
    return code.length;
  }

  private transformModule(code: string, fromFile: string): string {
    const exportTail: string[] = [];
    let out = code;

    out = out.replace(
      /import\s+([A-Za-z_$][\w$]*)\s*,\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]\s*;?/g,
      (_m, def, named, spec) =>
        this.importStatements(spec, fromFile, {
          def,
          named: parseNamedImports(named),
        }),
    );
    out = out.replace(
      /import\s*\*\s*as\s+([A-Za-z_$][\w$]*)\s+from\s*['"]([^'"]+)['"]\s*;?/g,
      (_m, ns, spec) => this.importStatements(spec, fromFile, { ns }),
    );
    out = out.replace(
      /import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]\s*;?/g,
      (_m, named, spec) =>
        this.importStatements(spec, fromFile, {
          named: parseNamedImports(named),
        }),
    );
    out = out.replace(
      /import\s+([A-Za-z_$][\w$]*)\s+from\s*['"]([^'"]+)['"]\s*;?/g,
      (_m, def, spec) => this.importStatements(spec, fromFile, { def }),
    );
    out = out.replace(/import\s+['"]([^'"]+)['"]\s*;?/g, (_m, spec) =>
      this.importStatements(spec, fromFile, {}),
    );

    out = out.replace(/export\s*\*\s*from\s*['"]([^'"]+)['"]\s*;?/g, (_m, spec) => {
      const resolved = this.resolveSpecifier(fromFile, spec);
      if (resolved.kind === "missing") {
        throw new Error(`Cannot resolve re-export "${spec}" from ${fromFile}.`);
      }
      let id: string;
      if (resolved.kind === "relative") {
        this.enqueue(resolved.abs);
        id = this.moduleIdFor(resolved.abs);
      } else {
        this.externals.add(resolved.name);
        id = resolved.name;
      }
      const tmp = `__goat_mod${this.counter++}`;
      return `const ${tmp} = __goat_require(${JSON.stringify(id)}); for (const __goat_key in ${tmp}) { if (__goat_key !== "default" && __goat_key !== "__esModule") exports[__goat_key] = ${tmp}[__goat_key]; }`;
    });
    out = out.replace(
      /export\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]\s*;?/g,
      (_m, list, spec) => {
        const resolved = this.resolveSpecifier(fromFile, spec);
        if (resolved.kind === "missing") {
          throw new Error(
            `Cannot resolve re-export "${spec}" from ${fromFile}.`,
          );
        }
        let id: string;
        if (resolved.kind === "relative") {
          this.enqueue(resolved.abs);
          id = this.moduleIdFor(resolved.abs);
        } else {
          this.externals.add(resolved.name);
          id = resolved.name;
        }
        const tmp = `__goat_mod${this.counter++}`;
        const lines = [
          `const ${tmp} = __goat_require(${JSON.stringify(id)});`,
        ];
        for (const [local, imported] of parseNamedImports(list)) {
          lines.push(`exports.${local} = ${tmp}.${imported};`);
        }
        return lines.join("\n");
      },
    );
    out = out.replace(/export\s*\{([^}]*)\}\s*;?/g, (_m, list) =>
      parseNamedImports(list)
        .map(([local, imported]) => `exports.${local} = ${imported};`)
        .join("\n"),
    );
    out = out.replace(/export\s+(async\s+)?function\s+([A-Za-z_$][\w$]*)/g, (_m, asyncKw, name) => {
      exportTail.push(`exports.${name} = ${name};`);
      return `${asyncKw ?? ""}function ${name}`;
    });
    out = out.replace(/export\s+class\s+([A-Za-z_$][\w$]*)/g, (_m, name) => {
      exportTail.push(`exports.${name} = ${name};`);
      return `class ${name}`;
    });
    out = out.replace(
      /export\s+default\s+(?=(?:async\s+)?function|class)/g,
      "exports.default = ",
    );

    const exportRe = /\bexport\s+/g;
    const chunks: string[] = [];
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = exportRe.exec(out)) !== null) {
      const after = out.slice(exportRe.lastIndex);
      if (/^default\s+(?!(?:async\s+)?function|class)/.test(after)) {
        const exprStart = exportRe.lastIndex + "default".length;
        const end = this.statementEnd(out, exprStart);
        const expr = out.slice(exprStart, end).replace(/;?\s*$/, "").trim();
        chunks.push(out.slice(last, match.index));
        chunks.push(`exports.default = ${expr};\n`);
        last = end;
        exportRe.lastIndex = end;
      } else if (/^(?:const|let|var)\b/.test(after)) {
        const end = this.statementEnd(out, exportRe.lastIndex);
        const statement = out.slice(exportRe.lastIndex, end);
        const names = extractDeclaratorNames(statement);
        chunks.push(out.slice(last, match.index));
        chunks.push(
          statement +
            "\n" +
            names.map((n) => `exports.${n} = ${n};`).join("\n") +
            "\n",
        );
        last = end;
        exportRe.lastIndex = end;
      } else if (/^\{/.test(after) || /^\s*\*/.test(after)) {
        const end = this.statementEnd(out, exportRe.lastIndex);
        exportRe.lastIndex = end;
      } else {
        exportRe.lastIndex++;
      }
    }
    if (chunks.length > 0) {
      chunks.push(out.slice(last));
      out = chunks.join("");
    }

    if (exportTail.length > 0) {
      out = out + "\n" + exportTail.join("\n") + "\n";
    }
    return out;
  }

  public async bundle(): Promise<{
    code: string;
    moduleCount: number;
    externals: string[];
  }> {
    const queue: string[] = [this.entryAbs];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (this.moduleCodes.has(current) && this.moduleCodes.get(current) !== "PENDING") {
        continue;
      }
      await this.processModule(current);
      for (const [abs, status] of this.moduleCodes) {
        if (status === "PENDING" && !queue.includes(abs)) queue.push(abs);
      }
    }
    const ordered: Array<[string, string]> = [];
    const visited = new Set<string>();
    const visit = (abs: string): void => {
      if (visited.has(abs)) return;
      visited.add(abs);
      ordered.push([this.moduleIdFor(abs), this.moduleCodes.get(abs)!]);
    };
    visit(this.entryAbs);
    for (const abs of this.moduleCodes.keys()) {
      if (abs !== this.entryAbs) visit(abs);
    }

    const externals = [...this.externals];
    const parts: string[] = [
      "(function () {",
      '"use strict";',
      "var __goat_modules = new Map();",
      "var __goat_cache = new Map();",
      "var __goat_interop = function (m) { return m && typeof m === 'object' && 'default' in m ? m.default : m; };",
      "var __goat_require = function (id) {",
      "  if (__goat_cache.has(id)) return __goat_cache.get(id).exports;",
      "  if (!__goat_modules.has(id)) {",
      "    if (typeof window !== 'undefined' && window.__goatExternals && id in window.__goatExternals) {",
      "      return window.__goatExternals[id];",
      "    }",
      `    throw new Error("[GoatBundle] External dependency '" + id + "' is not bundled (externals: ${JSON.stringify(
        externals,
      )}). Provide it via window.__goatExternals before loading this bundle.");`,
      "  }",
      "  var module = { exports: {} };",
      "  __goat_cache.set(id, module);",
      "  __goat_modules.get(id)(module, module.exports, __goat_require);",
      "  return module.exports;",
      "};",
    ];
    for (const [id, moduleCode] of ordered) {
      parts.push(
        `__goat_modules.set(${JSON.stringify(id)}, function (module, exports, require) {`,
      );
      parts.push(moduleCode);
      parts.push("});");
    }
    parts.push(`__goat_require(${JSON.stringify(this.moduleIdFor(this.entryAbs))});`);
    parts.push("})();");
    return {
      code: parts.join("\n"),
      moduleCount: ordered.length,
      externals,
    };
  }
}

function createSealedBytecodeContainer(source: string): Buffer {
  const payload = Buffer.from(source, "utf-8");
  const compressed = deflateSync(payload, { level: 9 });
  const digest = createHash("sha256").update(compressed).digest();
  const header = Buffer.alloc(16);
  header.write("GSB1", 0, "ascii");
  header.writeUInt32LE(1, 4);
  header.writeUInt32LE(payload.length, 8);
  header.writeUInt32LE(compressed.length, 12);
  return Buffer.concat([header, compressed, digest]);
}

function readSubpackageNames(root: string): string[] {
  const configPath = join(root, "goat.config.json");
  if (!existsSync(configPath)) return [];
  try {
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    return Array.isArray(config.subpackages) ? config.subpackages : [];
  } catch {
    return [];
  }
}

function findSubpackageEntry(root: string, name: string): string | null {
  const bases = [join(root, "src", name), join(root, name)];
  for (const base of bases) {
    for (const ext of ["index.ts", "index.tsx", "index.js", "index.mjs"]) {
      const candidate = join(base, ext);
      if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
    }
  }
  return null;
}

interface IntegrityArtifact {
  file: string;
  sha256: string;
  sizeBytes: number;
}

export async function buildCommand(args: string[]): Promise<void> {
  let opts: BuildOptions;
  try {
    opts = parseBuildArgs(args);
  } catch (e: unknown) {
    console.error(`\n❌ ${(e as Error).message}\n`);
    process.exit(1);
  }

  const root = process.cwd();
  const outDirAbs = resolve(root, opts.outDir);

  console.log("\n🐐 Goat Build — Production");
  console.log(
    `   Mode            : ${opts.prod ? "production" : "development"}`,
  );
  console.log(`   V8 Bytecode     : ${opts.bytecode ? "enabled" : "disabled"}`);
  console.log(
    `   Subpackage split: ${opts.splitSubpackages ? "enabled" : "disabled"}`,
  );
  console.log(`   Output dir      : ${outDirAbs}\n`);

  const artifacts: IntegrityArtifact[] = [];
  let exitCode = 0;

  const bundleTo = async (
    entryAbs: string,
    outputFile: string,
    label: string,
  ): Promise<void> => {
    console.log(`[GoatBuild] Resolving module graph for ${label}...`);
    const bundler = new MiniBundler(root, entryAbs);
    const { code, moduleCount, externals } = await bundler.bundle();
    console.log(`[GoatBuild] Bundling ${moduleCount} module(s) into ${outputFile}...`);
    const outputPath = join(outDirAbs, outputFile);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, code, "utf-8");
    const size = Buffer.byteLength(code, "utf-8");
    artifacts.push({
      file: outputFile,
      sha256: sha256(code),
      sizeBytes: size,
    });
    if (externals.length > 0) {
      console.log(
        `[GoatBuild] External dependencies (provide via window.__goatExternals): ${externals.join(", ")}`,
      );
    }
  };

  try {
    const entry = findEntry(root, opts.entry);
    await bundleTo(entry, "main.js", relative(root, entry));

    if (opts.splitSubpackages) {
      const names = readSubpackageNames(root);
      if (names.length === 0) {
        console.log(
          "[GoatBuild] Subpackage splitting: no subpackages declared in goat.config.json — skipping split.",
        );
      }
      for (const name of names) {
        const subEntry = findSubpackageEntry(root, name);
        if (!subEntry) {
          console.error(
            `❌ Subpackage "${name}" has no index entry under src/${name} or ${name}.`,
          );
          exitCode = 1;
          continue;
        }
        await bundleTo(
          subEntry,
          join("subpackages", `${name}.js`),
          `subpackage ${name}`,
        );
      }
    }

    if (opts.bytecode) {
      console.log(
        "[GoatBuild] V8 bytecode pre-compilation: sealing main bundle into .jsc container...",
      );
      const mainPath = join(outDirAbs, "main.js");
      const source = await readFile(mainPath, "utf-8");
      const container = createSealedBytecodeContainer(source);
      const jscPath = join(outDirAbs, "main.jsc");
      await writeFile(jscPath, container);
      artifacts.push({
        file: "main.jsc",
        sha256: sha256(container),
        sizeBytes: container.length,
      });
      console.log("[GoatBuild] Sealed bytecode container written to main.jsc.");
    }

    const integrityManifest = {
      format: "goat-integrity-v1",
      mode: opts.prod ? "production" : "development",
      generatedAt: new Date().toISOString(),
      artifacts,
    };
    const manifestPath = join(outDirAbs, "integrity.json");
    await writeFile(
      manifestPath,
      JSON.stringify(integrityManifest, null, 2),
      "utf-8",
    );
    console.log(
      `[GoatBuild] Writing integrity manifest to ${manifestPath}`,
    );

    console.log(`\n✅ Build complete → ${outDirAbs}/`);
    for (const artifact of artifacts) {
      console.log(
        `   ${artifact.file.padEnd(24)} ${(artifact.sizeBytes / 1024).toFixed(1)} KB  sha256:${artifact.sha256.slice(0, 16)}…`,
      );
    }
    console.log(
      `   integrity.json  checksums for all ${artifacts.length} artifact(s)`,
    );
  } catch (e: unknown) {
    console.error(`\n❌ Build failed: ${(e as Error).message}\n`);
    exitCode = 1;
  }

  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}
