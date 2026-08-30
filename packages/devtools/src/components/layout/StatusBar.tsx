import React, { useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Radio,
  Wifi,
  Activity,
  Cpu,
  FileCode2,
  Layers,
} from 'lucide-react';
import { useDevToolsStore } from '../../store/index.ts';
import { validateManifestJson, validateGoatConfigJson } from '../../services/monaco/schemaValidator.ts';

export const StatusBar: React.FC = () => {
  const {
    activeFilePath,
    files,
    fps,
    networkThrottling,
    networkProfileId,
    consoleLogs,
    logs: stateLogs,
    v8BytecodeStats,
    validationMarkers,
  } = useDevToolsStore();

  const logs = consoleLogs || stateLogs || [];
  const markers = validationMarkers || [];

  const errorCount = logs.filter((l: any) => l.level === 'error').length + markers.filter((m: any) => m.severity === 'error').length;
  const warnCount = logs.filter((l: any) => l.level === 'warn').length + markers.filter((m: any) => m.severity === 'warning').length;

  const schemaValidation = useMemo(() => {
    if (!activeFilePath || !files) return null;
    const content = files[activeFilePath] || '';
    if (activeFilePath.endsWith('manifest.json')) {
      return validateManifestJson(content, activeFilePath);
    }
    if (activeFilePath.endsWith('goat.config.json')) {
      return validateGoatConfigJson(content, activeFilePath);
    }
    return null;
  }, [activeFilePath, files]);

  const fileLang = useMemo(() => {
    if (!activeFilePath) return 'Plaintext';
    if (activeFilePath.endsWith('.ts') || activeFilePath.endsWith('.tsx')) return 'TypeScript';
    if (activeFilePath.endsWith('.js') || activeFilePath.endsWith('.jsx')) return 'JavaScript';
    if (activeFilePath.endsWith('.json')) return 'JSON Schema';
    if (activeFilePath.endsWith('.css')) return 'CSS';
    if (activeFilePath.endsWith('.html') || activeFilePath.endsWith('.vue')) return 'HTML';
    if (activeFilePath.endsWith('.xml') || activeFilePath.endsWith('.gpx')) return 'XML';
    return 'Text';
  }, [activeFilePath]);

  const isSchemaValid = schemaValidation ? (schemaValidation.isValid ?? (schemaValidation as any).valid) : true;

  return (
    <footer className="h-6 bg-blue-700 text-white flex items-center justify-between px-3 text-[11px] select-none font-mono z-20">
      {/* Left items */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-1">
          <Radio className="w-3 h-3 text-green-300 animate-pulse" />
          <span className="font-semibold">Goat Dual-Thread Engine</span>
        </div>

        <div className="h-3 w-px bg-blue-500/60" />

        {/* Schema Status */}
        {schemaValidation ? (
          <div className="flex items-center space-x-1">
            {isSchemaValid ? (
              <span className="flex items-center space-x-1 text-green-200">
                <CheckCircle2 className="w-3 h-3" />
                <span>Schema Valid</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1 text-amber-200 font-bold">
                <AlertTriangle className="w-3 h-3" />
                <span>{schemaValidation.errors.length} Schema Error(s)</span>
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center space-x-1 text-green-200">
            <CheckCircle2 className="w-3 h-3" />
            <span>Schema Valid</span>
          </div>
        )}

        <div className="h-3 w-px bg-blue-500/60" />

        {/* Error / Warning count */}
        <div className="flex items-center space-x-2">
          <span className="flex items-center space-x-0.5 text-red-200">
            <span className="font-bold">❌ {errorCount}</span>
          </span>
          <span className="flex items-center space-x-0.5 text-yellow-200">
            <span className="font-bold">⚠️ {warnCount}</span>
          </span>
        </div>

        <div className="h-3 w-px bg-blue-500/60" />

        {/* 203 GoatBridge Actions */}
        <div className="flex items-center space-x-1 text-blue-100">
          <Layers className="w-3 h-3 text-blue-200" />
          <span>203 Actions Active</span>
        </div>
      </div>

      {/* Right items */}
      <div className="flex items-center space-x-3">
        {/* Network Preset */}
        <div className="flex items-center space-x-1">
          <Wifi className="w-3 h-3 text-blue-200" />
          <span className="capitalize">
            {networkThrottling?.preset || networkProfileId || 'online'} ({networkThrottling?.latencyMs ?? 0}ms)
          </span>
        </div>

        <div className="h-3 w-px bg-blue-500/60" />

        {/* Simulator Stats */}
        <div className="flex items-center space-x-1 text-blue-100">
          <Activity className="w-3 h-3 text-green-300" />
          <span>{fps || 60} FPS</span>
        </div>

        <div className="h-3 w-px bg-blue-500/60" />

        {/* V8 Bytecode */}
        <div className="flex items-center space-x-1">
          <Cpu className="w-3 h-3 text-purple-200" />
          <span>V8: {v8BytecodeStats?.enabled ? 'WARM' : 'OFF'}</span>
        </div>

        <div className="h-3 w-px bg-blue-500/60" />

        {/* File Language & Encoding */}
        <div className="flex items-center space-x-1 text-blue-100">
          <FileCode2 className="w-3 h-3" />
          <span>{fileLang}</span>
          <span className="text-blue-300">| UTF-8</span>
        </div>
      </div>
    </footer>
  );
};
