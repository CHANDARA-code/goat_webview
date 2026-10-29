#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execSync, spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const isOffline = args.includes('--offline');
const allowExisting = args.includes('--allow-existing');
const pkgListArg = args.find(a => a.startsWith('--package-list='));
const pkgListFile = pkgListArg
  ? path.resolve(REPO_ROOT, pkgListArg.split('=')[1])
  : path.join(REPO_ROOT, 'scripts', 'npm-packages.txt');

if (!fs.existsSync(pkgListFile)) {
  console.error(`❌ Package list file not found: ${pkgListFile}`);
  process.exit(1);
}

const packageDirs = fs.readFileSync(pkgListFile, 'utf8')
  .split('\n')
  .map(l => l.trim())
  .filter(l => l && !l.startsWith('#'));

if (packageDirs.length === 0) {
  console.error(`❌ No packages found in ${pkgListFile}`);
  process.exit(1);
}

console.log('================================================================================');
console.log('🧪 [Goat WebView] NPM Pre-Publish Master Validation Gate');
console.log(`Mode: ${isOffline ? 'OFFLINE' : 'ONLINE'} | Allow Existing: ${allowExisting}`);
console.log(`Packages to validate: ${packageDirs.length}`);
console.log('================================================================================\n');

const SEMVER_REGEX = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

function computeDistTag(version) {
  if (version.includes('-alpha')) return 'alpha';
  if (version.includes('-beta')) return 'beta';
  if (version.includes('-rc')) return 'rc';
  if (version.includes('-')) return 'next';
  return 'latest';
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

// Versioned independently of the monorepo release; excluded from the version-sync check.
const INDEPENDENT_VERSION_PACKAGES = new Set(['@goat/bridge-mock', '@goat/server']);

const tagRef = process.env.GITHUB_REF_NAME;
const expectedTagVersion = tagRef && tagRef.startsWith('v') ? tagRef.slice(1) : null;

const packageDataList = [];
let sharedReleaseVersion = expectedTagVersion;

for (const relDir of packageDirs) {
  const fullDir = path.resolve(REPO_ROOT, relDir);
  const pkgJsonPath = path.join(fullDir, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) {
    console.error(`❌ package.json not found in ${relDir}`);
    process.exit(1);
  }
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  if (!sharedReleaseVersion && !INDEPENDENT_VERSION_PACKAGES.has(pkgJson.name)) {
    sharedReleaseVersion = pkgJson.version;
  }
  packageDataList.push({ relDir, fullDir, pkgJsonPath, pkgJson });
}

const packageMap = new Map();
for (const p of packageDataList) {
  packageMap.set(p.pkgJson.name, p);
}

const results = [];

function checkDtsDependencies(fullDir, pkgJson, errors) {
  const dtsDir = pkgJson.name === 'react-native-goat-webview'
    ? path.join(fullDir, 'lib')
    : path.join(fullDir, 'dist');
  if (!fs.existsSync(dtsDir)) return;

  const imports = new Set();
  function scan(dir) {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, f.name);
      if (f.isDirectory()) {
        scan(full);
      } else if (f.name.endsWith('.d.ts')) {
        const text = fs.readFileSync(full, 'utf8');
        const re = /(?:from\s+["'`]|import\s*\(\s*["'`]|<reference\s+types=["'`])([@\w\d_./-]+)["'`]/g;
        let match;
        while ((match = re.exec(text)) !== null) {
          const spec = match[1];
          if (!spec.startsWith('.') && !spec.startsWith('/') && !spec.startsWith('node:')) {
            const rootPkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
            imports.add(rootPkg);
          }
        }
      }
    }
  }
  scan(dtsDir);

  const nodeBuiltins = new Set([
    'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console',
    'constants', 'crypto', 'dgram', 'diagnostics_channel', 'dns', 'domain',
    'events', 'fs', 'http', 'http2', 'https', 'inspector', 'module', 'net',
    'os', 'path', 'perf_hooks', 'process', 'punycode', 'querystring', 'readline',
    'repl', 'stream', 'string_decoder', 'test', 'timers', 'tls', 'trace_events',
    'tty', 'url', 'util', 'v8', 'vm', 'wasi', 'worker_threads', 'zlib', 'node'
  ]);

  const deps = Object.keys(pkgJson.dependencies || {});
  const peerDeps = Object.keys(pkgJson.peerDependencies || {});
  const devDeps = Object.keys(pkgJson.devDependencies || {});

  for (const imp of imports) {
    if (nodeBuiltins.has(imp)) continue;
    const inProd = deps.includes(imp) || peerDeps.includes(imp);
    const typesName = imp.startsWith('@') ? `@types/${imp.slice(1).replace('/', '__')}` : `@types/${imp}`;
    const typesInProd = deps.includes(typesName) || peerDeps.includes(typesName);
    if (!inProd && !typesInProd) {
      if (devDeps.includes(imp) || devDeps.includes(typesName)) {
        errors.push(`Type definitions import '${imp}' which is only in devDependencies (must be in dependencies or peerDependencies)`);
      } else {
        errors.push(`Type definitions import '${imp}' which is missing from dependencies and peerDependencies`);
      }
    }
  }
}

function verifyTargetFilesExist(fullDir, pkgJson, errors) {
  if (pkgJson.main && !fs.existsSync(path.resolve(fullDir, pkgJson.main))) {
    errors.push(`main target does not exist: ${pkgJson.main}`);
  }
  if (pkgJson.module && !fs.existsSync(path.resolve(fullDir, pkgJson.module))) {
    errors.push(`module target does not exist: ${pkgJson.module}`);
  }
  const typesTarget = pkgJson.types || pkgJson.typings;
  if (typesTarget && !fs.existsSync(path.resolve(fullDir, typesTarget))) {
    errors.push(`types target does not exist: ${typesTarget}`);
  }
  if (pkgJson.exports) {
    function walkExports(obj) {
      if (typeof obj === 'string') {
        if (obj.startsWith('./') && !fs.existsSync(path.resolve(fullDir, obj))) {
          errors.push(`export target file does not exist: ${obj}`);
        }
      } else if (obj && typeof obj === 'object') {
        for (const val of Object.values(obj)) {
          walkExports(val);
        }
      }
    }
    walkExports(pkgJson.exports);
  }
}

for (const pkgItem of packageDataList) {
  const { relDir, fullDir, pkgJson } = pkgItem;
  console.log(`🔍 [1/7] Validating ${relDir} (${pkgJson.name}@${pkgJson.version})...`);
  const pkgErrors = [];
  const checks = {
    sanity: true,
    version: true,
    dependencies: true,
    buildTest: true,
    tarball: true,
    registry: true
  };

  // Check a: package.json sanity
  if (!pkgJson.name || typeof pkgJson.name !== 'string') {
    pkgErrors.push('Missing or invalid "name" field');
    checks.sanity = false;
  }
  if (!pkgJson.version || !SEMVER_REGEX.test(pkgJson.version)) {
    pkgErrors.push(`Invalid semver version: "${pkgJson.version}"`);
    checks.sanity = false;
  }
  if (!pkgJson.license) {
    pkgErrors.push('Missing "license" field');
    checks.sanity = false;
  }
  if (!pkgJson.repository) {
    pkgErrors.push('Missing "repository" field');
    checks.sanity = false;
  }
  const hasFiles = Array.isArray(pkgJson.files) && pkgJson.files.length > 0;
  const hasNpmignore = fs.existsSync(path.join(fullDir, '.npmignore'));
  if (!hasFiles && !hasNpmignore) {
    pkgErrors.push('Missing "files" array or .npmignore file');
    checks.sanity = false;
  }
  if (pkgJson.private === true) {
    pkgErrors.push('Package is marked "private": true and cannot be published to npm');
    checks.sanity = false;
  }

  // Check b: version consistency
  const versionIsIndependent = INDEPENDENT_VERSION_PACKAGES.has(pkgJson.name);
  if (!versionIsIndependent) {
    if (pkgJson.version !== sharedReleaseVersion) {
      pkgErrors.push(`Version mismatch: package has ${pkgJson.version}, expected ${sharedReleaseVersion}`);
      checks.version = false;
    }
    if (expectedTagVersion && pkgJson.version !== expectedTagVersion) {
      pkgErrors.push(`Version ${pkgJson.version} does not match tag version ${expectedTagVersion}`);
      checks.version = false;
    }
  }
  const isPrerelease = pkgJson.version.includes('-');
  const computedTag = computeDistTag(pkgJson.version);
  if (isPrerelease && computedTag === 'latest') {
    pkgErrors.push(`Prerelease version ${pkgJson.version} computed invalid dist-tag "latest"`);
    checks.version = false;
  }

  // Check c: dependency hygiene
  const depSections = ['dependencies', 'peerDependencies', 'optionalDependencies'];
  for (const sec of depSections) {
    const depsObj = pkgJson[sec] || {};
    for (const [depName, spec] of Object.entries(depsObj)) {
      if (typeof spec === 'string' && (spec.startsWith('file:') || spec.startsWith('link:') || spec.startsWith('workspace:'))) {
        pkgErrors.push(`Forbidden specifier "${spec}" in ${sec} for ${depName}`);
        checks.dependencies = false;
      }
      if (depName.startsWith('@goat/')) {
        if (packageMap.has(depName)) {
          const targetPkg = packageMap.get(depName);
          const cleanTargetVer = targetPkg.pkgJson.version;
          const cleanSpec = spec.replace(/^[~^>=< ]+/, '');
          if (!spec.includes('*') && cleanSpec !== cleanTargetVer && !spec.includes(cleanTargetVer)) {
            pkgErrors.push(`@goat dependency ${depName}@${spec} does not match local version ${cleanTargetVer}`);
            checks.dependencies = false;
          }
        } else if (!isOffline) {
          try {
            execSync(`npm view "${depName}" version`, { stdio: 'pipe', encoding: 'utf8' });
          } catch {
            pkgErrors.push(`Ghost dependency: "${depName}" is not in the publish list and does not exist on npm`);
            checks.dependencies = false;
          }
        }
      }
    }
  }

  // Check d: npm ci + build + npm test + typecheck
  const hasLockfile = fs.existsSync(path.join(fullDir, 'package-lock.json'));
  if (hasLockfile) {
    try {
      execSync('npm ci --workspaces=false', { cwd: fullDir, stdio: 'pipe' });
    } catch (e) {
      pkgErrors.push(`npm ci failed: ${e.message}`);
      checks.buildTest = false;
    }
  }

  if (pkgJson.scripts && pkgJson.scripts.build) {
    try {
      execSync('npm run build', { cwd: fullDir, stdio: 'pipe' });
    } catch (e) {
      pkgErrors.push(`npm run build failed: ${e.message}`);
      checks.buildTest = false;
    }
  }

  verifyTargetFilesExist(fullDir, pkgJson, pkgErrors);
  checkDtsDependencies(fullDir, pkgJson, pkgErrors);

  if (pkgJson.scripts && pkgJson.scripts.test) {
    const testCmd = pkgJson.scripts.test;
    const isDummy = testCmd.includes('Error: no test specified') || testCmd.trim() === 'exit 0';
    if (!isDummy) {
      try {
        execSync('npm test', { cwd: fullDir, stdio: 'pipe' });
      } catch (e) {
        pkgErrors.push(`npm test failed: ${e.message}`);
        checks.buildTest = false;
      }
    }
  }

  if (pkgJson.scripts && (pkgJson.scripts.typecheck || pkgJson.scripts['type-check'])) {
    const typeCmd = pkgJson.scripts.typecheck ? 'npm run typecheck' : 'npm run type-check';
    try {
      execSync(typeCmd, { cwd: fullDir, stdio: 'pipe' });
    } catch (e) {
      pkgErrors.push(`${typeCmd} failed: ${e.message}`);
      checks.buildTest = false;
    }
  }

  // Check e: tarball contents
  let packedSize = 0;
  let unpackedSize = 0;
  try {
    const packJsonRaw = execSync('npm pack --dry-run --json', { cwd: fullDir, encoding: 'utf8' });
    const packInfo = JSON.parse(packJsonRaw)[0];
    packedSize = packInfo.size || 0;
    unpackedSize = packInfo.unpackedSize || 0;
    const packedFiles = packInfo.files || [];
    const packedPaths = packedFiles.map(f => f.path);

    const hasReadme = packedPaths.some(p => /^readme(\.[a-z0-9]+)?$/i.test(path.basename(p)));
    if (!hasReadme) {
      pkgErrors.push('Tarball missing README');
      checks.tarball = false;
    }

    const hasLicense = packedPaths.some(p => /^license(\.[a-z0-9]+)?$/i.test(path.basename(p)));
    if (!hasLicense) {
      pkgErrors.push('Tarball missing LICENSE');
      checks.tarball = false;
    }

    // Check entry files are included
    const entryFiles = [];
    if (pkgJson.main) entryFiles.push(pkgJson.main.replace(/^\.\//, ''));
    if (pkgJson.module) entryFiles.push(pkgJson.module.replace(/^\.\//, ''));
    const typTarget = pkgJson.types || pkgJson.typings;
    if (typTarget) entryFiles.push(typTarget.replace(/^\.\//, ''));
    for (const ent of entryFiles) {
      if (!packedPaths.includes(ent)) {
        pkgErrors.push(`Entry file missing from tarball: ${ent}`);
        checks.tarball = false;
      }
    }

    // Leaked test files
    const leakedTests = packedPaths.filter(p => p.includes('__tests__') || /\.(test|spec)\.[a-zA-Z0-9]+$/.test(p));
    if (leakedTests.length > 0) {
      pkgErrors.push(`Test files leaked into tarball: ${leakedTests.join(', ')}`);
      checks.tarball = false;
    }

    // TS source files unless intentionally shipped (e.g. react-native SDK)
    const intentionallyShipsSources = Boolean(pkgJson['react-native'] || pkgJson.source);
    if (!intentionallyShipsSources) {
      const leakedSources = packedPaths.filter(p => /^src\/.*\.tsx?$/.test(p));
      if (leakedSources.length > 0) {
        pkgErrors.push(`TypeScript sources leaked into tarball (${leakedSources.length} files under src/)`);
        checks.tarball = false;
      }
    }

    // Leaked env files
    const leakedEnvs = packedPaths.filter(p => path.basename(p).startsWith('.env'));
    if (leakedEnvs.length > 0) {
      pkgErrors.push(`.env files leaked into tarball: ${leakedEnvs.join(', ')}`);
      checks.tarball = false;
    }

    // Leaked task notes
    const leakedTasks = packedPaths.filter(p => /TASK_.*\.md$/i.test(path.basename(p)));
    if (leakedTasks.length > 0) {
      pkgErrors.push(`Internal TASK_*.md files leaked into tarball: ${leakedTasks.join(', ')}`);
      checks.tarball = false;
    }

    // Leaked agents
    const leakedAgents = packedPaths.filter(p => p.includes('.agents/'));
    if (leakedAgents.length > 0) {
      pkgErrors.push(`.agents/ leaked into tarball: ${leakedAgents.join(', ')}`);
      checks.tarball = false;
    }

    // Files > 5 MB
    const oversizedFiles = packedFiles.filter(f => f.size > 5 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      pkgErrors.push(`Oversized files (>5MB) in tarball: ${oversizedFiles.map(f => `${f.path} (${formatBytes(f.size)})`).join(', ')}`);
      checks.tarball = false;
    }

    // Sourcemaps with absolute local paths
    const mapFiles = packedPaths.filter(p => p.endsWith('.map'));
    for (const mf of mapFiles) {
      const absMapPath = path.join(fullDir, mf);
      if (fs.existsSync(absMapPath)) {
        try {
          const mapJson = JSON.parse(fs.readFileSync(absMapPath, 'utf8'));
          const sources = mapJson.sources || [];
          for (const s of sources) {
            if (path.isAbsolute(s) || s.startsWith('/Users') || s.startsWith('/home') || s.startsWith('C:\\')) {
              pkgErrors.push(`Sourcemap ${mf} points to absolute local path: ${s}`);
              checks.tarball = false;
              break;
            }
          }
          if (mapJson.sourceRoot && path.isAbsolute(mapJson.sourceRoot)) {
            pkgErrors.push(`Sourcemap ${mf} has absolute sourceRoot: ${mapJson.sourceRoot}`);
            checks.tarball = false;
          }
        } catch {}
      }
    }
  } catch (e) {
    pkgErrors.push(`npm pack --dry-run failed: ${e.message}`);
    checks.tarball = false;
  }

  // Check f: registry state
  let registrySkip = false;
  if (isOffline) {
    // Offline mode: skip registry check
  } else {
    try {
      const viewOut = execSync(`npm view "${pkgJson.name}@${pkgJson.version}" version --json`, { stdio: 'pipe', encoding: 'utf8' });
      const existing = JSON.parse(viewOut.trim() || 'null');
      if (existing) {
        if (allowExisting) {
          registrySkip = true;
        } else {
          pkgErrors.push(`Version ${pkgJson.name}@${pkgJson.version} already exists on npm registry`);
          checks.registry = false;
        }
      }
    } catch {
      // 404 / error means version not published yet, which is expected for release
    }
  }

  const passed = pkgErrors.length === 0;
  results.push({
    relDir,
    name: pkgJson.name,
    version: pkgJson.version,
    passed,
    registrySkip,
    errors: pkgErrors,
    checks,
    packedSize,
    unpackedSize
  });
}

// Check g: clean-room consumer smoke test
console.log('\n🧹 [7/7] Executing clean-room consumer smoke test...');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'goat-smoke-'));
const packDir = path.join(tmpDir, 'packs');
const consumerDir = path.join(tmpDir, 'consumer');
fs.mkdirSync(packDir);
fs.mkdirSync(consumerDir);

let smokePassed = true;
const smokeErrors = [];

try {
  const tarballs = [];
  for (const pkgItem of packageDataList) {
    const out = execSync(`npm pack --pack-destination="${packDir}"`, { cwd: pkgItem.fullDir, encoding: 'utf8' }).trim();
    const tarballName = out.split('\n').pop().trim();
    tarballs.push(path.join(packDir, tarballName));
  }

  fs.writeFileSync(path.join(consumerDir, 'package.json'), JSON.stringify({
    name: 'smoke-consumer',
    version: '1.0.0',
    type: 'module',
    private: true
  }, null, 2));

  // Install all tarballs together with dummy peers
  const installCmd = `npm install --legacy-peer-deps --no-audit --no-fund typescript @types/react ${tarballs.map(t => `"${t}"`).join(' ')}`;
  execSync(installCmd, { cwd: consumerDir, stdio: 'pipe' });

  // Smoke test each package
  for (const pkgItem of packageDataList) {
    const { pkgJson, relDir } = pkgItem;
    const name = pkgJson.name;

    // React Native packages require native environment, validate via types
    if (name === 'react-native-goat-webview') {
      continue;
    }

    if (pkgJson.exports) {
      for (const [subpath, config] of Object.entries(pkgJson.exports)) {
        const importTarget = subpath === '.' ? name : `${name}/${subpath.replace(/^\.\//, '')}`;
        const hasImport = typeof config === 'string' || (config && config.import) || (config && config.default);
        const hasRequire = config && config.require;

        if (hasImport) {
          try {
            execSync(`node --input-type=module -e "import('${importTarget}')"`, { cwd: consumerDir, stdio: 'pipe' });
          } catch (e) {
            smokePassed = false;
            smokeErrors.push(`Failed to import('${importTarget}') in clean consumer: ${e.message}`);
          }
        }
        if (hasRequire) {
          try {
            execSync(`node --input-type=commonjs -e "require('${importTarget}')"`, { cwd: consumerDir, stdio: 'pipe' });
          } catch (e) {
            smokePassed = false;
            smokeErrors.push(`Failed to require('${importTarget}') in clean consumer: ${e.message}`);
          }
        }
      }
    } else if (pkgJson.main || pkgJson.module) {
      try {
        execSync(`node -e "import('${name}').catch(() => require('${name}'))"`, { cwd: consumerDir, stdio: 'pipe' });
      } catch (e) {
        smokePassed = false;
        smokeErrors.push(`Failed to load ${name} in clean consumer: ${e.message}`);
      }
    }
  }

  // Type check test
  fs.writeFileSync(path.join(consumerDir, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      strict: true,
      skipLibCheck: true,
      noEmit: true
    },
    include: ['smoke-types.ts']
  }, null, 2));

  const typeImports = [];
  for (const pkgItem of packageDataList) {
    const { pkgJson } = pkgItem;
    const name = pkgJson.name;
    if (pkgJson.exports) {
      let idx = 0;
      for (const [subpath, config] of Object.entries(pkgJson.exports)) {
        const target = subpath === '.' ? name : `${name}/${subpath.replace(/^\.\//, '')}`;
        const hasTypes = (typeof config === 'object' && config.types) || pkgJson.types;
        if (hasTypes) {
          typeImports.push(`import type * as _t_${name.replace(/[^a-zA-Z0-9]/g, '_')}_${idx++} from '${target}';`);
        }
      }
    } else if (pkgJson.types || pkgJson.typings) {
      typeImports.push(`import type * as _t_${name.replace(/[^a-zA-Z0-9]/g, '_')} from '${name}';`);
    }
  }

  fs.writeFileSync(path.join(consumerDir, 'smoke-types.ts'), typeImports.join('\n') + '\nexport {};\n');
  try {
    execSync('npx tsc --noEmit', { cwd: consumerDir, stdio: 'pipe' });
  } catch (e) {
    smokePassed = false;
    smokeErrors.push(`tsc --noEmit failed in clean consumer: ${e.message}`);
  }
} catch (e) {
  smokePassed = false;
  smokeErrors.push(`Clean-room consumer smoke test failed: ${e.message}`);
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// Print Report Table
console.log('\n================================================================================');
console.log('📊 NPM Pre-Publish Validation Report Table');
console.log('================================================================================');
console.log(
  'Package'.padEnd(28) +
  'Version'.padEnd(16) +
  'Sanity'.padEnd(8) +
  'Ver'.padEnd(6) +
  'Deps'.padEnd(6) +
  'Build'.padEnd(7) +
  'Tar'.padEnd(6) +
  'Reg'.padEnd(6) +
  'Smoke'.padEnd(7) +
  'Packed'.padEnd(10) +
  'Result'
);
console.log('-'.repeat(106));

let allPassed = smokePassed;
for (const r of results) {
  if (!r.passed) allPassed = false;
  const sanityStr = r.checks.sanity ? 'PASS' : 'FAIL';
  const verStr = r.checks.version ? 'PASS' : 'FAIL';
  const depsStr = r.checks.dependencies ? 'PASS' : 'FAIL';
  const buildStr = r.checks.buildTest ? 'PASS' : 'FAIL';
  const tarStr = r.checks.tarball ? 'PASS' : 'FAIL';
  const regStr = isOffline ? 'SKIP' : (r.registrySkip ? 'SKIP' : (r.checks.registry ? 'PASS' : 'FAIL'));
  const smokeStr = smokePassed ? 'PASS' : 'FAIL';
  const resultStr = r.passed && smokePassed ? (r.registrySkip ? 'SKIP' : 'PASS') : 'FAIL';

  console.log(
    r.relDir.padEnd(28) +
    r.version.padEnd(16) +
    sanityStr.padEnd(8) +
    verStr.padEnd(6) +
    depsStr.padEnd(6) +
    buildStr.padEnd(7) +
    tarStr.padEnd(6) +
    regStr.padEnd(6) +
    smokeStr.padEnd(7) +
    formatBytes(r.packedSize).padEnd(10) +
    resultStr
  );
}
console.log('-'.repeat(106));

if (!smokePassed) {
  console.log('\n❌ Clean-room Consumer Smoke Test Errors:');
  for (const err of smokeErrors) {
    console.log(`  - ${err}`);
  }
}

let hasDefects = false;
for (const r of results) {
  if (r.errors.length > 0) {
    hasDefects = true;
    console.log(`\n❌ Defects found in ${r.relDir} (${r.name}):`);
    for (const err of r.errors) {
      console.log(`  - ${err}`);
    }
  }
}

if (!allPassed || hasDefects) {
  console.log('\n❌ [GATE FAILED] NPM publish validation failed with defects.');
  process.exit(1);
} else {
  console.log('\n✅ [GATE PASSED] All npm packages successfully validated and ready for publish.');
  process.exit(0);
}
