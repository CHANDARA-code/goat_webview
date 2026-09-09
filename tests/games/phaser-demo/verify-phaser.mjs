import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== Verifying tests/games/phaser-demo ===\n');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failedTests++;
  }
}

// 1. package.json check
const pkgPath = path.join(__dirname, 'package.json');
assert(fs.existsSync(pkgPath), 'package.json exists');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
assert(pkg.dependencies && pkg.dependencies.phaser === '^3.88.2', 'dependencies includes phaser@^3.88.2');
assert(pkg.devDependencies && pkg.devDependencies.typescript === '^5.7.3', 'devDependencies includes typescript@^5.7.3');
assert(pkg.devDependencies && pkg.devDependencies.vite === '^6.1.0', 'devDependencies includes vite@^6.1.0');
assert(pkg.scripts.dev === 'vite', 'scripts.dev is "vite"');
assert(pkg.scripts.build === 'tsc && vite build', 'scripts.build is "tsc && vite build"');
assert(pkg.scripts.preview === 'vite preview', 'scripts.preview is "vite preview"');

// 2. tsconfig.json check
const tsconfigPath = path.join(__dirname, 'tsconfig.json');
assert(fs.existsSync(tsconfigPath), 'tsconfig.json exists');
const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
assert(tsconfig.compilerOptions.target === 'ES2022', 'tsconfig target is ES2022');
assert(tsconfig.compilerOptions.module === 'ESNext', 'tsconfig module is ESNext');
assert(tsconfig.compilerOptions.moduleResolution.toLowerCase() === 'bundler', 'tsconfig moduleResolution is Bundler');
assert(tsconfig.compilerOptions.strict === true, 'tsconfig strict is true');
assert(tsconfig.compilerOptions.esModuleInterop === true, 'tsconfig esModuleInterop is true');
assert(tsconfig.compilerOptions.skipLibCheck === true, 'tsconfig skipLibCheck is true');

// 3. vite.config.ts check
const viteConfigPath = path.join(__dirname, 'vite.config.ts');
assert(fs.existsSync(viteConfigPath), 'vite.config.ts exists');
const viteContent = fs.readFileSync(viteConfigPath, 'utf-8');
assert(viteContent.includes("base: './'"), "vite.config.ts specifies base: './'");
assert(viteContent.includes("outDir: 'dist'"), "vite.config.ts specifies outDir: 'dist'");
assert(viteContent.includes("target: 'es2022'"), "vite.config.ts specifies target: 'es2022'");

// 4. index.html check
const indexHtmlPath = path.join(__dirname, 'index.html');
assert(fs.existsSync(indexHtmlPath), 'index.html exists');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf-8');
assert(indexHtml.includes('width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'), 'index.html has canonical viewport meta');
assert(indexHtml.includes('position: fixed;'), 'index.html has position: fixed');
assert(indexHtml.includes('touch-action: none;'), 'index.html has touch-action: none');
assert(indexHtml.includes('user-select: none;'), 'index.html has user-select: none');
assert(indexHtml.includes('#game-container'), 'index.html contains #game-container');

// 5. dist/ check
const distDir = path.join(__dirname, 'dist');
assert(fs.existsSync(distDir), 'dist/ directory exists');
const distIndex = path.join(distDir, 'index.html');
assert(fs.existsSync(distIndex), 'dist/index.html exists');
const distHtml = fs.readFileSync(distIndex, 'utf-8');
assert(!/src=["']\/[a-zA-Z0-9]/.test(distHtml), 'dist/index.html does not contain absolute root paths');
assert(distHtml.includes('src="./assets/'), 'dist/index.html uses relative ./assets/ paths');

const assetsDir = path.join(distDir, 'assets');
assert(fs.existsSync(assetsDir), 'dist/assets exists');
const assetFiles = fs.readdirSync(assetsDir);
const hasPhaserChunk = assetFiles.some((f) => f.startsWith('phaser-') && f.endsWith('.js'));
const hasIndexChunk = assetFiles.some((f) => f.startsWith('index-') && f.endsWith('.js'));
assert(hasPhaserChunk, 'dist/assets contains phaser bundle chunk');
assert(hasIndexChunk, 'dist/assets contains application index chunk');

// 6. Source modules check
const mainTsPath = path.join(__dirname, 'src', 'main.ts');
assert(fs.existsSync(mainTsPath), 'src/main.ts exists');
const mainTs = fs.readFileSync(mainTsPath, 'utf-8');
assert(mainTs.includes('window.__gameStats'), 'src/main.ts defines window.__gameStats');
assert(mainTs.includes('window.__teardownGame'), 'src/main.ts defines window.__teardownGame');
assert(mainTs.includes('window.__pauseGame'), 'src/main.ts defines window.__pauseGame');
assert(mainTs.includes('window.__resumeGame'), 'src/main.ts defines window.__resumeGame');
assert(mainTs.includes('game.destroy(true, false)'), 'src/main.ts calls game.destroy(true, false)');
assert(mainTs.includes('Math.min(window.devicePixelRatio || 1, 2.0)'), 'src/main.ts implements DPR clamping');

const scenePath = path.join(__dirname, 'src', 'scenes', 'MainScene.ts');
assert(fs.existsSync(scenePath), 'src/scenes/MainScene.ts exists');
const sceneTs = fs.readFileSync(scenePath, 'utf-8');
assert(sceneTs.includes("generateTexture('player_tex'"), 'MainScene generates procedural player texture');
assert(sceneTs.includes("generateTexture('platform_tex'"), 'MainScene generates procedural platform texture');
assert(sceneTs.includes("generateTexture('gem_tex'"), 'MainScene generates procedural gem texture');
assert(sceneTs.includes("generateTexture('hazard_tex'"), 'MainScene generates procedural hazard texture');
assert(sceneTs.includes('gemEmitter'), 'MainScene sets up gem particle emitter');
assert(sceneTs.includes('jumpEmitter'), 'MainScene sets up jump particle emitter');
assert(sceneTs.includes('setupVirtualTouchControls'), 'MainScene sets up virtual touch controls');
assert(sceneTs.includes('setupKeyboardInput'), 'MainScene sets up keyboard controls');

const audioPath = path.join(__dirname, 'src', 'audio.ts');
assert(fs.existsSync(audioPath), 'src/audio.ts exists');
const audioTs = fs.readFileSync(audioPath, 'utf-8');
assert(audioTs.includes('jump()'), 'SynthAudio includes jump()');
assert(audioTs.includes('pickup()'), 'SynthAudio includes pickup()');
assert(audioTs.includes('bump()'), 'SynthAudio includes bump()');

const hudPath = path.join(__dirname, 'src', 'hud.ts');
assert(fs.existsSync(hudPath), 'src/hud.ts exists');
const hudTs = fs.readFileSync(hudPath, 'utf-8');
assert(hudTs.includes('DebugHUD'), 'hud.ts exports DebugHUD');
assert(hudTs.includes('FPS:'), 'DebugHUD displays FPS');
assert(hudTs.includes('DELTA:'), 'DebugHUD displays frame delta');
assert(hudTs.includes('BODIES:'), 'DebugHUD displays physics bodies count');

console.log(`\nResults: ${passedTests} passed, ${failedTests} failed.`);
if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('All Phaser 3 verification checks PASSED! ✨\n');
}
