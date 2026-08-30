/**
 * @goat/devtools - Elements & DOM Inspector Component
 * Live VDOM/DOM tree hierarchy explorer, computed CSS styles viewer, box model visualizer,
 * and interactive element highlight overlay communication with simulator.
 */

import React, { useState, useMemo } from 'react';
import { useDevToolsStore } from '../../store/index.ts';
import {
  Layers,
  ChevronRight,
  ChevronDown,
  Box,
  Tag,
  Search,
  Sliders,
  Plus,
  Trash2,
  ChevronsUpDown,
  FileCode,
  Sparkles,
} from 'lucide-react';
import type { DomNodeInfo } from '../../types/debugger.ts';

export const ElementsInspector: React.FC = () => {
  const {
    domTree,
    vdomTree,
    domElements,
    selectedDomNodeId,
    selectedNodeId,
    hoveredDomNodeId,
    hoveredNodeId,
    setSelectedDomNodeId,
    setHoveredDomNodeId,
    setComputedStyles,
  } = useDevToolsStore();

  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    root: true,
    'page-root': true,
    'container-1': true,
    'card-1': true,
  });

  const [activeTab, setActiveTab] = useState<'styles' | 'computed' | 'box' | 'attributes'>('styles');
  const [styleSearch, setStyleSearch] = useState('');
  const [treeSearch, setTreeSearch] = useState('');
  const [newProp, setNewProp] = useState('');
  const [newVal, setNewVal] = useState('');

  const activeSelectedId = selectedDomNodeId || selectedNodeId || domElements?.selectedNodeId || 'root';
  const activeHoveredId = hoveredDomNodeId || hoveredNodeId || domElements?.hoveredNodeId || null;

  // Fallback representative mini-app VDOM tree if none in runtime yet
  const defaultTree: DomNodeInfo = useMemo(() => {
    return domTree || vdomTree || domElements?.vdomTree || domElements?.domTree || {
      vnodeId: 'root',
      tag: 'page',
      classes: ['root-page', 'theme-dark'],
      attributes: { id: 'root', role: 'main' },
      computedStyles: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: '#09090b',
        color: '#f4f4f5',
      },
      bounds: { x: 0, y: 0, width: 393, height: 852 },
      children: [
        {
          vnodeId: 'container-1',
          tag: 'view',
          classes: ['container', 'p-4'],
          attributes: { class: 'container p-4', id: 'container-1' },
          computedStyles: {
            display: 'flex',
            flexDirection: 'column',
            padding: '16px',
            gap: '12px',
            width: '100%',
          },
          bounds: { x: 0, y: 59, width: 393, height: 759 },
          children: [
            {
              vnodeId: 'card-1',
              tag: 'view',
              classes: ['card', 'bg-zinc-900', 'rounded-xl', 'p-4'],
              attributes: { class: 'card bg-zinc-900 rounded-xl p-4', id: 'card-1' },
              computedStyles: {
                backgroundColor: '#18181b',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid #27272a',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.3)',
              },
              bounds: { x: 16, y: 75, width: 361, height: 120 },
              children: [
                {
                  vnodeId: 'title-1',
                  tag: 'text',
                  classes: ['font-bold', 'text-lg'],
                  textContent: 'Welcome to Goat Mini-App',
                  attributes: { class: 'font-bold text-lg', id: 'title-1' },
                  computedStyles: {
                    fontSize: '18px',
                    fontWeight: '700',
                    color: '#ffffff',
                    lineHeight: '28px',
                  },
                  bounds: { x: 32, y: 91, width: 329, height: 28 },
                },
                {
                  vnodeId: 'desc-1',
                  tag: 'text',
                  classes: ['text-zinc-400', 'text-xs'],
                  textContent: 'Dual-Thread AppService + AppView active at 60 FPS.',
                  attributes: { class: 'text-zinc-400 text-xs', id: 'desc-1' },
                  computedStyles: {
                    fontSize: '12px',
                    color: '#a1a1aa',
                    lineHeight: '20px',
                  },
                  bounds: { x: 32, y: 123, width: 329, height: 20 },
                },
              ],
            },
            {
              vnodeId: 'button-1',
              tag: 'button',
              classes: ['btn', 'btn-primary'],
              textContent: '✨ Invoke Native Bridge Action',
              attributes: { class: 'btn btn-primary', type: 'button', id: 'button-1' },
              computedStyles: {
                backgroundColor: '#2563eb',
                color: '#ffffff',
                borderRadius: '8px',
                padding: '10px 16px',
                fontWeight: '600',
                cursor: 'pointer',
              },
              bounds: { x: 16, y: 207, width: 361, height: 44 },
            },
          ],
        },
      ],
    };
  }, [domTree, vdomTree, domElements]);

  const toggleExpand = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    const traverse = (n: any) => {
      if (!n) return;
      const id = n.vnodeId || n.id || n.tag;
      next[id] = true;
      if (n.children) n.children.forEach(traverse);
    };
    traverse(defaultTree);
    setExpandedNodes(next);
  };

  const collapseAll = () => {
    setExpandedNodes({});
  };

  // Node lookup and lineage breadcrumb builder
  const { selectedNode, lineage } = useMemo(() => {
    let target: DomNodeInfo | null = null;
    const path: DomNodeInfo[] = [];

    const findNodeAndPath = (node: DomNodeInfo, currentPath: DomNodeInfo[]): boolean => {
      const id = node.vnodeId || (node as any).id || (node as any).nodeId;
      const nextPath = [...currentPath, node];

      if (id === activeSelectedId) {
        target = node;
        path.push(...nextPath);
        return true;
      }

      if (node.children) {
        for (const child of node.children) {
          if (findNodeAndPath(child, nextPath)) return true;
        }
      }
      return false;
    };

    findNodeAndPath(defaultTree, []);
    return {
      selectedNode: target || defaultTree,
      lineage: path.length > 0 ? path : [defaultTree],
    };
  }, [defaultTree, activeSelectedId]);

  const computedStylesMap = selectedNode.computedStyles || domElements?.computedStyles || {};

  const handleAddStyle = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProp.trim() && newVal.trim()) {
      const updated = { ...computedStylesMap, [newProp.trim()]: newVal.trim() };
      setComputedStyles(updated);
      setNewProp('');
      setNewVal('');
    }
  };

  const filteredStyles = Object.entries(computedStylesMap).filter(([prop, val]) => {
    if (!styleSearch) return true;
    const q = styleSearch.toLowerCase();
    return prop.toLowerCase().includes(q) || String(val).toLowerCase().includes(q);
  });

  const renderTreeNode = (node: DomNodeInfo, depth: number = 0): React.ReactNode => {
    const id = node.vnodeId || (node as any).id || (node as any).nodeId || `node-${depth}`;
    const isSelected = activeSelectedId === id;
    const isHovered = activeHoveredId === id;
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes[id] ?? true;

    // Check search matching
    const nodeText = `${node.tag} ${node.classes?.join(' ') || ''} ${node.attributes?.id || ''} ${node.textContent || ''}`.toLowerCase();
    const isMatch = !treeSearch || nodeText.includes(treeSearch.toLowerCase());

    return (
      <div key={id} className={`select-none font-mono text-[11px] ${!isMatch && treeSearch ? 'opacity-40' : ''}`}>
        <div
          data-testid={`dom-node-${id}`}
          onClick={() => setSelectedDomNodeId(id)}
          onMouseEnter={() => setHoveredDomNodeId(id)}
          onMouseLeave={() => setHoveredDomNodeId(null)}
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
          className={`flex items-center py-0.5 px-2 cursor-pointer transition-colors rounded ${
            isSelected
              ? 'bg-blue-600/30 text-blue-300 border-l-2 border-blue-500 font-bold'
              : isHovered
              ? 'bg-neutral-800/80 text-neutral-200'
              : 'text-neutral-400 hover:bg-neutral-900/60 hover:text-neutral-300'
          }`}
        >
          {hasChildren ? (
            <button
              onClick={(e) => toggleExpand(id, e)}
              className="p-0.5 mr-1 text-neutral-500 hover:text-neutral-300 focus:outline-none"
            >
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
          ) : (
            <span className="w-4 mr-1" />
          )}

          <span className="text-purple-400 font-semibold">&lt;{node.tag}</span>
          {node.classes && node.classes.length > 0 && (
            <span className="text-emerald-400 ml-1 truncate max-w-[140px]">class="{node.classes.join(' ')}"</span>
          )}
          {node.attributes?.id && (
            <span className="text-amber-400 ml-1">id="{node.attributes.id}"</span>
          )}
          <span className="text-purple-400">&gt;</span>

          {node.textContent && (
            <span className="text-neutral-300 ml-1.5 truncate max-w-xs text-[10px]">
              "{node.textContent}"
            </span>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div>
            {node.children!.map((child) => renderTreeNode(child, depth + 1))}
            <div
              style={{ paddingLeft: `${depth * 14 + 22}px` }}
              className="py-0.2 text-purple-400/70 font-mono text-[11px]"
            >
              &lt;/{node.tag}&gt;
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex text-xs select-none bg-neutral-950" data-testid="elements-inspector-panel">
      {/* Left Column: Live VDOM Tree Hierarchy */}
      <div className="flex-1 border-r border-neutral-800 flex flex-col min-w-0 overflow-hidden">
        {/* Tree Toolbar Header */}
        <div className="h-9 border-b border-neutral-800 px-3 flex items-center justify-between text-neutral-300 shrink-0 bg-neutral-900/40">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-700/80">
              <Search className="w-3 h-3 text-neutral-400" />
              <input
                type="text"
                placeholder="Filter DOM tree..."
                value={treeSearch}
                onChange={(e) => setTreeSearch(e.target.value)}
                className="bg-transparent text-white focus:outline-none w-36 text-[11px] placeholder:text-neutral-500"
              />
            </div>
            <span className="text-[10px] text-neutral-500 font-mono">
              Selected: #{activeSelectedId}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={expandAll}
              className="px-1.5 py-0.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 text-[10px]"
              title="Expand All"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="px-1.5 py-0.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 text-[10px]"
              title="Collapse All"
            >
              Collapse
            </button>
          </div>
        </div>

        {/* Live Tree Hierarchy */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {renderTreeNode(defaultTree)}
        </div>

        {/* Ancestor Breadcrumbs */}
        <div className="h-6 border-t border-neutral-800 px-2 flex items-center gap-1 overflow-x-auto text-[10px] font-mono text-neutral-400 bg-neutral-900/60 shrink-0">
          {lineage.map((item, idx) => {
            const itemId = item.vnodeId || (item as any).id || item.tag;
            return (
              <React.Fragment key={itemId}>
                {idx > 0 && <span className="text-neutral-600">&gt;</span>}
                <button
                  onClick={() => setSelectedDomNodeId(itemId)}
                  className={`hover:text-blue-400 truncate max-w-[120px] ${
                    itemId === activeSelectedId ? 'text-blue-400 font-bold' : 'text-neutral-400'
                  }`}
                >
                  {item.tag}
                  {item.attributes?.id ? `#${item.attributes.id}` : ''}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Right Column: Computed Styles, Box Model, and Attributes Pane */}
      <div className="w-80 flex flex-col bg-neutral-900/30 overflow-hidden">
        {/* Tab Navigation */}
        <div className="h-9 border-b border-neutral-800 px-2 flex items-center gap-1 text-neutral-400 text-[11px] shrink-0 bg-neutral-900/50">
          <button
            onClick={() => setActiveTab('styles')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === 'styles'
                ? 'bg-blue-600/30 text-blue-300 font-bold border border-blue-500/50'
                : 'hover:text-neutral-200'
            }`}
          >
            Styles
          </button>
          <button
            onClick={() => setActiveTab('computed')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === 'computed'
                ? 'bg-blue-600/30 text-blue-300 font-bold border border-blue-500/50'
                : 'hover:text-neutral-200'
            }`}
          >
            Computed
          </button>
          <button
            onClick={() => setActiveTab('box')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === 'box'
                ? 'bg-blue-600/30 text-blue-300 font-bold border border-blue-500/50'
                : 'hover:text-neutral-200'
            }`}
          >
            Box Model
          </button>
          <button
            onClick={() => setActiveTab('attributes')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === 'attributes'
                ? 'bg-blue-600/30 text-blue-300 font-bold border border-blue-500/50'
                : 'hover:text-neutral-200'
            }`}
          >
            Attributes
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 font-mono text-[11px]">
          {/* 1. Styles Tab: Custom rules & Computed */}
          {activeTab === 'styles' && (
            <div className="space-y-3">
              {/* Add Custom Style Inline */}
              <form onSubmit={handleAddStyle} className="p-2 rounded bg-neutral-950 border border-neutral-800 space-y-1.5">
                <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                  Add Inline Style
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="property"
                    value={newProp}
                    onChange={(e) => setNewProp(e.target.value)}
                    className="flex-1 bg-neutral-900 px-2 py-1 rounded text-white text-[10px] border border-neutral-700/80 focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="value"
                    value={newVal}
                    onChange={(e) => setNewVal(e.target.value)}
                    className="flex-1 bg-neutral-900 px-2 py-1 rounded text-white text-[10px] border border-neutral-700/80 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    title="Add Style"
                    className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-bold"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </form>

              {/* Styles List */}
              <div className="p-2.5 rounded bg-neutral-950 border border-neutral-800 space-y-1.5">
                <div className="text-[10px] font-bold text-blue-400 pb-1 border-b border-neutral-800">
                  element.style &#123;
                </div>
                <div className="space-y-1 pl-2">
                  {Object.entries(computedStylesMap).map(([prop, val]) => (
                    <div key={prop} className="flex justify-between items-center text-[10px]">
                      <span className="text-neutral-400">{prop}:</span>
                      <span className="text-amber-300 font-medium truncate max-w-[130px]">{String(val)};</span>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] font-bold text-blue-400 pt-1 border-t border-neutral-800">
                  &#125;
                </div>
              </div>
            </div>
          )}

          {/* 2. Computed Tab */}
          {activeTab === 'computed' && (
            <div className="space-y-2">
              <div className="flex items-center gap-1 bg-neutral-950 px-2 py-1 rounded border border-neutral-800">
                <Search className="w-3 h-3 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Filter computed..."
                  value={styleSearch}
                  onChange={(e) => setStyleSearch(e.target.value)}
                  className="bg-transparent text-white focus:outline-none w-full text-[10px]"
                />
              </div>

              <div className="bg-neutral-950 p-2.5 rounded border border-neutral-800 space-y-1 text-[10px]">
                {filteredStyles.length === 0 ? (
                  <div className="text-neutral-500 text-center py-2">No matching styles</div>
                ) : (
                  filteredStyles.map(([prop, val]) => (
                    <div key={prop} className="flex justify-between border-b border-neutral-900/80 pb-0.5">
                      <span className="text-neutral-400">{prop}:</span>
                      <span className="text-blue-400 font-medium truncate max-w-[140px]">{String(val)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 3. Box Model Visualizer Tab */}
          {activeTab === 'box' && (
            <div className="space-y-3">
              <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                <Box className="w-3.5 h-3.5 text-amber-400" />
                <span>Box Model (#{activeSelectedId})</span>
              </div>

              <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800 flex flex-col items-center justify-center text-[9px] text-center">
                {/* Margin */}
                <div className="w-full bg-amber-950/40 border border-amber-800/60 p-2 rounded text-amber-400">
                  <span className="text-[8px] text-amber-500 font-bold block mb-0.5">margin: 0px</span>
                  {/* Border */}
                  <div className="w-full bg-yellow-950/40 border border-yellow-800/60 p-2 rounded text-yellow-300">
                    <span className="text-[8px] text-yellow-500 font-bold block mb-0.5">border: 1px</span>
                    {/* Padding */}
                    <div className="w-full bg-emerald-950/40 border border-emerald-800/60 p-2 rounded text-emerald-300">
                      <span className="text-[8px] text-emerald-500 font-bold block mb-0.5">padding: 16px</span>
                      {/* Content */}
                      <div className="bg-blue-950/70 border border-blue-600/70 p-2 rounded text-blue-300 font-bold">
                        {selectedNode.bounds
                          ? `${selectedNode.bounds.width} × ${selectedNode.bounds.height}`
                          : '361 × 120'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. Attributes Tab */}
          {activeTab === 'attributes' && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                DOM Attributes
              </div>
              <div className="bg-neutral-950 p-2.5 rounded border border-neutral-800 space-y-1.5 text-[10px]">
                {Object.entries(selectedNode.attributes || {}).map(([attr, val]) => (
                  <div key={attr} className="flex justify-between items-center border-b border-neutral-900 pb-1">
                    <span className="text-emerald-400 font-bold">{attr}</span>
                    <span className="text-neutral-300 font-mono truncate max-w-[140px]">"{String(val)}"</span>
                  </div>
                ))}
                {(!selectedNode.attributes || Object.keys(selectedNode.attributes).length === 0) && (
                  <div className="text-neutral-600 text-center py-2">No attributes present</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
