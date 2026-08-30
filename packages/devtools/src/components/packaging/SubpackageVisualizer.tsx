/**
 * @goat/devtools - Subpackage Bundle Visualizer Component
 * Subpackage chunk size treemap, dependency graph, 2MB size quota limit warnings.
 */

import React from 'react';
import { useDevToolsStore } from '../../store/index.ts';
import { Box, Layers, AlertTriangle, CheckCircle2, PieChart, GitBranch, ArrowRight } from 'lucide-react';
import type { SubpackageConfig } from '../../types/packaging.ts';

export const SubpackageVisualizer: React.FC = () => {
  const {
    subpackages = [],
    bundleStats = {
      mainPackageBytes: 65740,
      subpackagesBytes: { 'subpackages/checkout': 18400, 'subpackages/profile': 12200 },
      totalBytes: 96340,
    },
    bundleSizeStats,
  } = useDevToolsStore();

  const stats = bundleSizeStats || bundleStats || {};
  const mainBytes = stats.mainPackageBytes || stats.mainSizeBytes || 65740;
  const subBytesMap = stats.subpackagesBytes || {};
  const totalBytes = stats.totalBytes || stats.totalSizeBytes || (mainBytes + Object.values(subBytesMap).reduce((a: any, b: any) => a + b, 0));

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const defaultSubpackages: SubpackageConfig[] = subpackages.length > 0 ? subpackages : [
    {
      root: 'subpackages/checkout',
      name: 'Checkout & Payment',
      pages: ['pages/checkout/index', 'pages/checkout/success'],
      independent: false,
      sizeBytes: 18400,
    },
    {
      root: 'subpackages/profile',
      name: 'User Profile & Settings',
      pages: ['pages/profile/index', 'pages/profile/security'],
      independent: true,
      sizeBytes: 12200,
    },
  ];

  const MAX_MAIN_PACKAGE_BYTES = 2 * 1024 * 1024; // 2MB WeChat/Alibaba standard quota
  const isMainOverLimit = mainBytes > MAX_MAIN_PACKAGE_BYTES;

  return (
    <div className="p-4 space-y-4 text-xs select-none" data-testid="subpackage-visualizer-panel">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <div className="flex items-center gap-2">
          <Box className="w-4 h-4 text-blue-400" />
          <h3 className="font-bold text-neutral-200 uppercase tracking-wider text-[11px]">
            Subpackage Bundle Visualizer
          </h3>
        </div>
        <div className="font-mono text-[10px] text-neutral-400">
          Total Size: <span className="text-blue-400 font-bold">{formatSize(totalBytes)}</span>
        </div>
      </div>

      {/* Quota & Size Warning */}
      {isMainOverLimit ? (
        <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-lg flex items-start gap-2 text-rose-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Main Package Exceeds 2MB Quota!</div>
            <div className="text-[10px] text-rose-400">
              Main package is {formatSize(mainBytes)}. Move non-critical pages to subpackages.
            </div>
          </div>
        </div>
      ) : (
        <div className="p-2.5 bg-emerald-950/40 border border-emerald-800/60 rounded-lg flex items-center justify-between text-emerald-300 text-[11px]">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Main package size is within optimal quota ({formatSize(mainBytes)} / 2.0 MB)</span>
          </div>
          <span className="font-mono font-bold">{((mainBytes / MAX_MAIN_PACKAGE_BYTES) * 100).toFixed(1)}%</span>
        </div>
      )}

      {/* Visual Treemap Bar */}
      <div>
        <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
          Chunk Treemap Allocation
        </div>
        <div className="h-6 w-full rounded-lg overflow-hidden flex bg-neutral-900 border border-neutral-800">
          <div
            style={{ width: `${Math.max(15, (mainBytes / totalBytes) * 100)}%` }}
            className="bg-blue-600 h-full flex items-center justify-center text-[9px] font-mono text-white font-bold truncate px-1"
            title={`Main Package: ${formatSize(mainBytes)}`}
          >
            Main ({formatSize(mainBytes)})
          </div>
          {defaultSubpackages.map((sub, idx) => {
            const size = sub.sizeBytes || subBytesMap[sub.root] || 15000;
            const pct = Math.max(10, (size / totalBytes) * 100);
            const colors = ['bg-purple-600', 'bg-emerald-600', 'bg-amber-600', 'bg-rose-600'];
            return (
              <div
                key={sub.root}
                style={{ width: `${pct}%` }}
                className={`${colors[idx % colors.length]} h-full flex items-center justify-center text-[9px] font-mono text-white font-bold truncate px-1 border-l border-neutral-950`}
                title={`${sub.name || sub.root}: ${formatSize(size)}`}
              >
                {sub.name ? sub.name.split(' ')[0] : sub.root.split('/')[1]} ({formatSize(size)})
              </div>
            );
          })}
        </div>
      </div>

      {/* Subpackages Breakdown List */}
      <div className="space-y-2">
        <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
          Package Modules Breakdown
        </div>

        {/* Main Package Card */}
        <div className="p-3 bg-neutral-900/60 rounded-lg border border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <div>
              <div className="font-bold text-neutral-200 text-xs">Main Package (Root)</div>
              <div className="text-[10px] text-neutral-400 font-mono">pages/index, app.js, app.json</div>
            </div>
          </div>
          <span className="font-mono text-blue-400 font-bold">{formatSize(mainBytes)}</span>
        </div>

        {/* Subpackages Cards */}
        {defaultSubpackages.map((sub, idx) => {
          const size = sub.sizeBytes || subBytesMap[sub.root] || 15000;
          return (
            <div
              key={sub.root}
              className="p-3 bg-neutral-900/60 rounded-lg border border-neutral-800 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                <div>
                  <div className="font-bold text-neutral-200 text-xs flex items-center gap-1.5">
                    <span>{sub.name || sub.root}</span>
                    {sub.independent && (
                      <span className="px-1.5 py-0.2 bg-purple-950/60 border border-purple-800/60 text-purple-300 text-[9px] rounded font-mono">
                        Independent
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-neutral-400 font-mono">
                    Root: {sub.root} ({sub.pages.length} pages)
                  </div>
                </div>
              </div>
              <span className="font-mono text-purple-400 font-bold">{formatSize(size)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
