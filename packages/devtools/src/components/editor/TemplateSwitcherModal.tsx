import React from 'react';
import { X, Check, Atom, Layers, Code2, Sparkles } from 'lucide-react';
import { useDevToolsStore } from '../../store/index.ts';
import { TEMPLATES } from '../../services/templates/index.ts';

export const TemplateSwitcherModal: React.FC = () => {
  const {
    isTemplateModalOpen,
    setTemplateModalOpen,
    activeTemplateId,
    loadTemplate,
  } = useDevToolsStore();

  if (!isTemplateModalOpen) return null;

  const currentTemplate = activeTemplateId || 'react-19';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 select-none">
      <div className="bg-ide-panel-dark dark:bg-ide-panel-dark bg-white border border-ide-border-dark dark:border-ide-border-dark border-ide-border-light rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-ide-border-dark dark:border-ide-border-dark border-ide-border-light flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-bold text-white dark:text-white text-gray-900">
              Select Mini-App Template
            </h2>
          </div>
          <button
            onClick={() => setTemplateModalOpen(false)}
            className="p-1 rounded hover:bg-gray-700/60 text-gray-400 hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Template Cards */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {TEMPLATES.map((tpl) => {
            const isSelected = currentTemplate === tpl.id || currentTemplate.startsWith(tpl.framework);
            const icon =
              tpl.framework === 'react' ? (
                <Atom className="w-6 h-6 text-cyan-400" />
              ) : tpl.framework === 'vue' ? (
                <Layers className="w-6 h-6 text-emerald-400" />
              ) : (
                <Code2 className="w-6 h-6 text-blue-400" />
              );

            return (
              <div
                key={tpl.id}
                onClick={() => {
                  loadTemplate(tpl.id);
                }}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-950/30 ring-2 ring-blue-500/20'
                    : 'border-ide-border-dark dark:border-ide-border-dark border-gray-200 hover:border-gray-600 bg-ide-bg-dark/40 dark:bg-ide-bg-dark/40 bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 rounded-lg bg-gray-800/80 border border-gray-700/60">
                      {icon}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-bold text-sm text-white dark:text-white text-gray-900">
                          {tpl.name}
                        </h3>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-300 font-medium border border-blue-700/50">
                          v{tpl.version}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{tpl.description}</p>
                    </div>
                  </div>

                  {isSelected && (
                    <span className="flex items-center space-x-1 text-xs font-bold text-blue-400 bg-blue-900/40 px-2 py-1 rounded">
                      <Check className="w-3.5 h-3.5" />
                      <span>Active</span>
                    </span>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-gray-700/30 grid grid-cols-2 gap-2 text-[11px] text-gray-300 dark:text-gray-300 text-gray-600">
                  <div className="flex items-center space-x-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    <span>Entry: {tpl.entryFile}</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>203 Bridge Actions</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-ide-border-dark dark:border-ide-border-dark border-ide-border-light bg-ide-bg-dark/60 dark:bg-ide-bg-dark/60 bg-gray-50 flex items-center justify-between text-xs text-gray-400">
          <span>Templates include dual-thread runtime config & 203 GoatBridge typings.</span>
          <button
            onClick={() => setTemplateModalOpen(false)}
            className="px-4 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
