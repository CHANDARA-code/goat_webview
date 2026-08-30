import React from 'react';
import { AlertCircle, AlertTriangle, ChevronRight, X } from 'lucide-react';
import { useDevToolsStore } from '../../store/index.ts';

export const SchemaValidationBanner: React.FC = () => {
  const { validationMarkers, openFile } = useDevToolsStore();
  const [dismissed, setDismissed] = React.useState(false);

  const markers = validationMarkers || [];
  if (dismissed || markers.length === 0) return null;

  const errors = markers.filter((m: any) => m.severity === 'error');
  const warnings = markers.filter((m: any) => m.severity === 'warning');

  return (
    <div className="bg-amber-950/90 dark:bg-amber-950/90 light:bg-amber-100 border-b border-amber-800/60 dark:border-amber-800/60 light:border-amber-300 px-3 py-1.5 text-xs flex items-center justify-between z-10">
      <div className="flex items-center gap-2 overflow-x-auto">
        {errors.length > 0 ? (
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
        )}

        <div className="flex items-center gap-2">
          <span className="font-semibold text-amber-200 dark:text-amber-200 light:text-amber-900">
            Schema Validation:
          </span>
          <span className="text-amber-300/90 dark:text-amber-300/90 light:text-amber-800">
            {errors.length > 0 && `${errors.length} error(s)`}
            {errors.length > 0 && warnings.length > 0 && ', '}
            {warnings.length > 0 && `${warnings.length} warning(s)`} found in project configuration.
          </span>
        </div>

        {/* First issue snippet */}
        {markers[0] && (
          <button
            onClick={() => openFile(markers[0].filePath)}
            className="flex items-center gap-1 text-amber-200 hover:text-white underline font-mono text-[11px] ml-2"
          >
            <span>{markers[0].filePath}:{markers[0].line} - {markers[0].message}</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

      <button
        onClick={() => setDismissed(true)}
        className="text-amber-400/80 hover:text-amber-200 p-1 rounded"
        title="Dismiss Banner"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
