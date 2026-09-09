import React, { useState, useRef, useEffect } from 'react';
import { ExternalLink, RefreshCw, Maximize2, ChevronDown } from 'lucide-react';

// ─── Game Definitions ─────────────────────────────────────────────────────────

interface GameDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  tech: string;
  color: string;
  borderColor: string;
  /** Relative path from miniapp-web dev server root to the game's dist/ index.html.
   *  In dev mode these won't work without a separate preview server, so we
   *  also provide a devPort so the iframe can point to the Vite preview server. */
  devPort: number;
}

const GAMES: GameDef[] = [
  {
    id: 'littlejs',
    name: 'LittleJS',
    emoji: '🎮',
    description: '2D physics & particle mini-game — ultra-lightweight 10 KB engine',
    tech: 'LittleJS Engine',
    color: 'text-emerald-400',
    borderColor: 'border-emerald-500/40',
    devPort: 5174,
  },
  {
    id: 'phaser',
    name: 'Phaser 3',
    emoji: '🕹️',
    description: '2D arcade game — sprites, physics, touch & keyboard controls',
    tech: 'Phaser 3',
    color: 'text-cyan-400',
    borderColor: 'border-cyan-500/40',
    devPort: 5175,
  },
  {
    id: 'threejs',
    name: 'Three.js',
    emoji: '🌐',
    description: '3D interactive scene — geometry, lighting, shadows, camera orbit',
    tech: 'Three.js r169',
    color: 'text-violet-400',
    borderColor: 'border-violet-500/40',
    devPort: 5176,
  },
  {
    id: 'r3f',
    name: 'React Three Fiber',
    emoji: '⚛️',
    description: '3D declarative WebGL — component-driven React scene graph',
    tech: '@react-three/fiber + drei',
    color: 'text-pink-400',
    borderColor: 'border-pink-500/40',
    devPort: 4173,
  },
  {
    id: 'pixi',
    name: 'PixiJS',
    emoji: '✨',
    description: '2D WebGL renderer — elastic ball collisions, starfield, touch push',
    tech: 'PixiJS v8',
    color: 'text-amber-400',
    borderColor: 'border-amber-500/40',
    devPort: 5177,
  },
  {
    id: 'babylon',
    name: 'Babylon.js',
    emoji: '🏛️',
    description: '3D game engine — shadows, glow, particles, orbit camera, score',
    tech: 'Babylon.js v7',
    color: 'text-orange-400',
    borderColor: 'border-orange-500/40',
    devPort: 5178,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export const GamesApp: React.FC = () => {
  const [selectedGame, setSelectedGame] = useState<GameDef | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPicker, setShowPicker] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // When a game is selected, collapse the picker on mobile
  useEffect(() => {
    if (selectedGame) setShowPicker(false);
  }, [selectedGame]);

  const handleSelect = (game: GameDef) => {
    setSelectedGame(game);
    setIframeKey((k) => k + 1);
  };

  const handleReload = () => setIframeKey((k) => k + 1);

  const handleFullscreen = () => {
    const el = iframeRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    } else {
      el.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    }
  };

  const gameUrl = selectedGame
    ? `http://localhost:${selectedGame.devPort}/`
    : null;

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-950">
      {/* ── Game Picker ─────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-white/10">
        {/* Collapse toggle */}
        <button
          onClick={() => setShowPicker((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <span className="text-xs font-semibold uppercase tracking-widest">
            {selectedGame ? `▶ ${selectedGame.name}` : 'Select a Game Engine'}
          </span>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${showPicker ? 'rotate-180' : ''}`}
          />
        </button>

        {showPicker && (
          <div className="grid grid-cols-2 gap-2 px-3 pb-3 sm:grid-cols-3">
            {GAMES.map((game) => {
              const isActive = selectedGame?.id === game.id;
              return (
                <button
                  key={game.id}
                  onClick={() => handleSelect(game)}
                  className={`flex flex-col items-start p-3 rounded-xl border transition-all text-left ${
                    isActive
                      ? `${game.borderColor} bg-white/5 shadow-lg`
                      : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{game.emoji}</span>
                    <span className={`text-sm font-bold ${isActive ? game.color : 'text-slate-200'}`}>
                      {game.name}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight line-clamp-2">
                    {game.description}
                  </p>
                  <span className={`mt-1.5 text-[10px] font-mono ${game.color} opacity-70`}>
                    {game.tech}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Game Viewport ───────────────────────────────────────────────── */}
      <div className="flex-1 relative min-h-0 flex flex-col">
        {!selectedGame ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="text-5xl">🎮</div>
            <h2 className="text-slate-200 font-bold text-lg">6 Game Engines Ready</h2>
            <p className="text-slate-400 text-sm max-w-xs">
              Select an engine above to load it in the WebView iframe.
              Each game runs as a standalone Vite build on its preview port.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-500">
              {GAMES.map((g) => (
                <span key={g.id} className={`${g.color} font-mono`}>
                  {g.emoji} {g.name}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 bg-slate-900/80 border-b border-white/5">
              <span className="text-lg">{selectedGame.emoji}</span>
              <span className={`text-sm font-bold ${selectedGame.color}`}>
                {selectedGame.name}
              </span>
              <span className="text-xs text-slate-500 font-mono ml-1">
                :{selectedGame.devPort}
              </span>
              <div className="flex-1" />
              <a
                href={gameUrl ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-slate-200 p-1 rounded transition-colors"
                title="Open in new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
              <button
                onClick={handleReload}
                className="text-slate-400 hover:text-slate-200 p-1 rounded transition-colors"
                title="Reload"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={handleFullscreen}
                className="text-slate-400 hover:text-slate-200 p-1 rounded transition-colors"
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>

            {/* iframe */}
            <div className="flex-1 relative min-h-0">
              <iframe
                ref={iframeRef}
                key={iframeKey}
                src={gameUrl ?? ''}
                title={`${selectedGame.name} Game`}
                className="absolute inset-0 w-full h-full border-0 bg-black"
                allow="fullscreen; autoplay"
                sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-popups"
              />
              {/* Port hint overlay when iframe likely fails due to CORS/closed port */}
              <div className="absolute bottom-2 left-2 right-2 pointer-events-none">
                <p className="text-center text-[10px] text-slate-600 font-mono bg-black/40 rounded px-2 py-1">
                  Requires: cd tests/games/{selectedGame.id}-demo &amp;&amp; npm run preview
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

