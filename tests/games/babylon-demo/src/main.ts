import { BabylonGame } from './game';

let game: BabylonGame | null = null;

function initGame(): void {
  const canvas = document.getElementById('babylon-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('[Babylon.js Demo] Canvas element #babylon-canvas not found');
    return;
  }

  game = new BabylonGame(canvas);

  // Teardown on page unload
  const teardown = () => {
    game?.dispose();
    game = null;
  };
  window.addEventListener('beforeunload', teardown, { once: true });
  window.addEventListener('pagehide', teardown, { once: true });
}

initGame();

