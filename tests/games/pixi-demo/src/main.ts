import { Application } from 'pixi.js';
import { PixiGame } from './game';

let pixiApp: Application | null = null;
let game: PixiGame | null = null;

async function initGame(): Promise<void> {
  pixiApp = new Application();

  await pixiApp.init({
    resizeTo: window,
    backgroundColor: 0x0a0a1a,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    hello: false,
  });

  // Mount canvas into #app
  const appDiv = document.getElementById('app');
  if (!appDiv) throw new Error('Missing #app element');
  appDiv.appendChild(pixiApp.canvas);

  // Create game
  game = new PixiGame(pixiApp);

  // Hook into Pixi ticker
  pixiApp.ticker.add((ticker) => {
    game?.update(ticker);
  });

  // Teardown on page unload
  window.addEventListener('beforeunload', disposeAll, { once: true });
  window.addEventListener('pagehide', disposeAll, { once: true });

  console.log('[PixiJS Demo] Initialized — PixiJS', (Application as unknown as { VERSION: string }).VERSION ?? 'v8');
}

function disposeAll(): void {
  game?.dispose();
  game = null;
  if (pixiApp) {
    pixiApp.ticker.stop();
    pixiApp.destroy(true, { children: true, texture: true });
    pixiApp = null;
  }
}

initGame().catch((err) => {
  console.error('[PixiJS Demo] Init failed:', err);
});
