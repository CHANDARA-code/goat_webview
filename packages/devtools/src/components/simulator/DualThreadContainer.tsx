/**
 * @goat/devtools - Dual-Thread Container Component
 * Hosts the @goat/appservice dual-thread mini-app engine (Web Worker container + AppView DOM renderer).
 * Computes VDOM diffs, batches UI mutations at 60fps (16.6ms), and provides live interactivity.
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useDevToolsStore } from "../../store/index.ts";
import {
  DualThreadRuntimeService,
  createDualThreadRuntime,
} from "../../services/dualThreadRuntime.ts";
import type { VNode } from "@goat/appservice";
import {
  Play,
  Pause,
  AlertCircle,
  Sparkles,
  MapPin,
  Battery,
  Layers,
  Database,
  Terminal,
  Activity,
} from "lucide-react";

export const DualThreadContainer: React.FC = () => {
  const {
    files,
    activeFilePath,
    isRunning = true,
    addConsoleLog,
    addBridgeTrace,
    updateMetrics,
    setSimulatorError,
    lastError,
    location = { latitude: 37.7749, longitude: -122.4194 },
    battery = { level: 100, isCharging: false },
    accelerometer = { x: 0, y: 0, z: 9.8 },
    storageData,
    setStorageKv,
  } = useDevToolsStore();

  const domContainerRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<DualThreadRuntimeService | null>(null);
  const prevCodeRef = useRef<string | null>(null);

  const [counter, setCounter] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [vdomNodeCount, setVdomNodeCount] = useState<number>(12);
  const [activeTab, setActiveTab] = useState<"demo" | "vdom" | "diagnostics">(
    "demo",
  );

  // Initialize Dual-Thread Runtime
  useEffect(() => {
    const runtime = createDualThreadRuntime({
      appId: "goat-studio-simulator",
      batchIntervalMs: 16,
      containerElement: domContainerRef.current,
      onLog: (log) => {
        if (typeof addConsoleLog === "function") {
          addConsoleLog(log);
        }
      },
      onTrace: (trace) => {
        if (typeof addBridgeTrace === "function") {
          addBridgeTrace(trace);
        }
      },
      onMetrics: (metrics) => {
        if (typeof updateMetrics === "function") {
          updateMetrics(metrics);
        }
      },
    });

    runtimeRef.current = runtime;

    // Boot default template logic
    try {
      if (runtime.worker.state === "UNINITIALIZED") {
        runtime.worker.launch();
      }
    } catch (err: any) {
      if (typeof setSimulatorError === "function") {
        setSimulatorError(err.message || String(err));
      }
    }

    return () => {
      runtime.destroy();
      runtimeRef.current = null;
    };
  }, []);

  // Update container DOM ref when mounted
  useEffect(() => {
    if (runtimeRef.current && domContainerRef.current) {
      runtimeRef.current.mountRenderer(domContainerRef.current);
    }
  }, [domContainerRef.current]);

  // Handle Pause / Resume
  useEffect(() => {
    if (!runtimeRef.current) return;
    if (isRunning) {
      if (runtimeRef.current.worker.state === "SUSPENDED") {
        runtimeRef.current.resume();
      }
    } else {
      if (
        runtimeRef.current.worker.state === "RUNNING" ||
        runtimeRef.current.worker.state === "READY"
      ) {
        runtimeRef.current.pause();
      }
    }
  }, [isRunning]);

  // Handle Hot Code Reloading on File Changes
  useEffect(() => {
    if (!runtimeRef.current || !files) return;

    const mainCode =
      files["app.js"] || files["src/app.ts"] || files["index.js"];
    if (mainCode && mainCode.trim().length > 0) {
      if (prevCodeRef.current === null) {
        prevCodeRef.current = mainCode;
        return;
      }
      if (prevCodeRef.current !== mainCode) {
        prevCodeRef.current = mainCode;
        const result = runtimeRef.current.evaluateCode(mainCode, false);
        if (!result.success) {
          if (typeof setSimulatorError === "function") {
            setSimulatorError(result.error || "Code evaluation error");
          }
        } else {
          if (typeof setSimulatorError === "function") {
            setSimulatorError(null);
          }
        }
      }
    }
  }, [files, activeFilePath]);

  // Interactive Action: Trigger Counter with VDOM Diff Calculation
  const handleIncrement = useCallback(() => {
    if (!isRunning || !runtimeRef.current) return;

    const nextCount = counter + 1;
    setCounter(nextCount);

    // Compute reactive VDOM tree diff in worker
    const vnodeTree: VNode = {
      type: "ELEMENT",
      tag: "div",
      nodeId: "root-counter-page",
      props: { class: "mini-app-page", "data-count": nextCount },
      children: [
        {
          type: "ELEMENT",
          tag: "div",
          nodeId: "counter-card",
          props: { class: "card" },
          children: [
            {
              type: "ELEMENT",
              tag: "span",
              nodeId: "count-display",
              text: `Count: ${nextCount}`,
            },
          ],
        },
      ],
    };

    runtimeRef.current.setData({ count: nextCount }, () => vnodeTree);

    runtimeRef.current.dispatchUiEvent("tap", "increment-button", {
      count: nextCount,
    });
  }, [counter, isRunning]);

  // Interactive Action: Call Bridge Location Action
  const handleCallLocation = useCallback(async () => {
    if (!runtimeRef.current) return;
    try {
      await runtimeRef.current.worker.GoatBridge.call(
        "location.getCurrent",
        {},
      );
      showToast(
        `Location: ${(location.latitude ?? 37.7749).toFixed(4)}, ${(location.longitude ?? -122.4194).toFixed(4)}`,
      );
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  }, [location]);

  // Interactive Action: Call Bridge Storage Action
  const handleCallStorage = useCallback(async () => {
    if (!runtimeRef.current) return;
    const key = `user_score_${Date.now()}`;
    const value = counter + 10;
    try {
      await runtimeRef.current.worker.GoatBridge.call("storage.set", {
        key,
        value,
      });
      if (typeof setStorageKv === "function") {
        setStorageKv(key, value);
      }
      showToast(`Saved ${key} = ${value}`);
    } catch (err: any) {
      showToast(`Storage Error: ${err.message}`);
    }
  }, [counter, setStorageKv]);

  // Interactive Action: Call Bridge ShowToast Action
  const handleShowToast = useCallback(async () => {
    if (!runtimeRef.current) return;
    try {
      await runtimeRef.current.worker.GoatBridge.call("ui.showToast", {
        title: "Goat Mini-App 60 FPS",
      });
      showToast("✨ Native Toast Executed (Host IPC)");
    } catch (err: any) {
      showToast(`Toast Error: ${err.message}`);
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  return (
    <div
      className="w-full h-full relative overflow-hidden flex flex-col bg-neutral-950 text-white font-sans select-none"
      data-testid="dual-thread-container"
    >
      {/* 1. AppView Live DOM Mounting Root Container (Hidden / Synthetic DOM node for AppViewDomRenderer) */}
      <div
        ref={domContainerRef}
        className="hidden"
        data-testid="appview-dom-mount"
      />

      {/* 2. Mini-App Navigation Header Bar */}
      <div className="h-10 px-3 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-bold tracking-tight text-neutral-200">
            Goat Mini-App
          </span>
        </div>
        <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-mono font-medium">
          Dual-Thread • 60fps
        </span>
      </div>

      {/* 3. Main Interactive Viewport Content */}
      <div
        className="flex-1 overflow-y-auto p-3 space-y-3"
        data-testid="mini-app-screen-body"
      >
        {/* Navigation Tabs inside Simulator */}
        <div className="flex bg-neutral-900 p-0.5 rounded-lg border border-neutral-800 text-[11px]">
          <button
            onClick={() => setActiveTab("demo")}
            className={`flex-1 py-1 rounded font-medium transition ${
              activeTab === "demo"
                ? "bg-blue-600 text-white shadow"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Live Demo
          </button>
          <button
            onClick={() => setActiveTab("vdom")}
            className={`flex-1 py-1 rounded font-medium transition ${
              activeTab === "vdom"
                ? "bg-blue-600 text-white shadow"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            VDOM Tree
          </button>
          <button
            onClick={() => setActiveTab("diagnostics")}
            className={`flex-1 py-1 rounded font-medium transition ${
              activeTab === "diagnostics"
                ? "bg-blue-600 text-white shadow"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Sensors
          </button>
        </div>

        {activeTab === "demo" && (
          <div className="space-y-3">
            {/* Reactive State Card */}
            <div className="p-3 bg-neutral-900/90 rounded-xl border border-neutral-800 shadow-md space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-300">
                  Reactive State (setData)
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">
                  16.6ms Batch
                </span>
              </div>
              <div className="flex items-center justify-between p-2 bg-black/60 rounded-lg border border-neutral-800">
                <span className="text-xs text-neutral-400">
                  Current Counter:
                </span>
                <span
                  className="text-xl font-bold font-mono text-blue-400"
                  data-testid="counter-display"
                >
                  {counter}
                </span>
              </div>
              <button
                onClick={handleIncrement}
                className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg font-bold text-xs shadow-lg transition active:scale-98 flex items-center justify-center gap-1.5"
                data-testid="increment-btn"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Trigger State Mutation (UI Event ➔ Worker)</span>
              </button>
            </div>

            {/* Native GoatBridge Action Triggers */}
            <div className="p-3 bg-neutral-900/90 rounded-xl border border-neutral-800 shadow-md space-y-2">
              <span className="text-xs font-bold text-neutral-300">
                Native Bridge RPC Calls (203 Actions)
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleCallLocation}
                  className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg border border-neutral-700 text-[11px] font-medium flex items-center gap-1.5 transition active:scale-95 text-neutral-200"
                  data-testid="bridge-location-btn"
                >
                  <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="truncate">GPS Location</span>
                </button>

                <button
                  onClick={handleCallStorage}
                  className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg border border-neutral-700 text-[11px] font-medium flex items-center gap-1.5 transition active:scale-95 text-neutral-200"
                  data-testid="bridge-storage-btn"
                >
                  <Database className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">KV Storage</span>
                </button>

                <button
                  onClick={handleShowToast}
                  className="col-span-2 p-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg border border-neutral-700 text-[11px] font-medium flex items-center justify-center gap-1.5 transition active:scale-95 text-neutral-200"
                  data-testid="bridge-toast-btn"
                >
                  <Terminal className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span>Show Native Toast (ui.showToast)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "vdom" && (
          <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800 space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between text-neutral-400 pb-1 border-b border-neutral-800">
              <span className="font-bold text-neutral-300">
                Live Virtual DOM Hierarchy
              </span>
              <span className="text-blue-400 text-[10px]">
                {vdomNodeCount} Nodes
              </span>
            </div>
            <div className="space-y-1 text-[11px] text-neutral-300">
              <div className="text-purple-400">&lt;page id="root-page"&gt;</div>
              <div className="pl-3 text-blue-400">
                &lt;view class="container"&gt;
              </div>
              <div className="pl-6 text-blue-400">
                &lt;view class="card shadow"&gt;
              </div>
              <div className="pl-9 text-emerald-400">
                &lt;text&gt;Counter: {counter}&lt;/text&gt;
              </div>
              <div className="pl-9 text-amber-300">
                &lt;button bindtap="onIncrement"&gt;Mutate&lt;/button&gt;
              </div>
              <div className="pl-6 text-blue-400">&lt;/view&gt;</div>
              <div className="pl-3 text-blue-400">&lt;/view&gt;</div>
              <div className="text-purple-400">&lt;/page&gt;</div>
            </div>
          </div>
        )}

        {activeTab === "diagnostics" && (
          <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800 space-y-2 text-xs">
            <span className="font-bold text-neutral-300">
              Hardware & Sensor Telemetry
            </span>
            <div className="space-y-1.5 text-[11px]">
              <div className="p-2 bg-black/50 rounded flex justify-between">
                <span className="text-neutral-400">GPS Coordinates:</span>
                <span className="font-mono text-emerald-400">
                  {(location.latitude ?? 37.7749).toFixed(4)},{" "}
                  {(location.longitude ?? -122.4194).toFixed(4)}
                </span>
              </div>
              <div className="p-2 bg-black/50 rounded flex justify-between">
                <span className="text-neutral-400">Battery Level:</span>
                <span className="font-mono text-blue-400">
                  {battery.level ?? 100}%{" "}
                  {battery.isCharging ? "(Charging)" : ""}
                </span>
              </div>
              <div className="p-2 bg-black/50 rounded flex justify-between">
                <span className="text-neutral-400">Accelerometer:</span>
                <span className="font-mono text-amber-400">
                  x:{(accelerometer.x ?? 0).toFixed(1)} y:
                  {(accelerometer.y ?? 0).toFixed(1)} z:
                  {(accelerometer.z ?? 9.8).toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Live Toast Overlay */}
      {toastMessage && (
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 bg-neutral-900/95 border border-neutral-700 text-white text-xs px-3 py-1.5 rounded-full shadow-2xl backdrop-blur animate-fade-in flex items-center gap-1.5"
          data-testid="mini-app-toast"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 5. Paused Overlay */}
      {!isRunning && (
        <div
          className="absolute inset-0 z-40 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center select-none"
          data-testid="paused-overlay"
        >
          <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mb-2">
            <Pause className="w-6 h-6" />
          </div>
          <p className="font-bold text-sm text-neutral-200">Simulator Paused</p>
          <p className="text-xs text-neutral-400 mt-1 max-w-[200px]">
            Mini-App execution and frame batcher temporarily suspended.
          </p>
        </div>
      )}

      {/* 6. Runtime Error Banner */}
      {lastError && (
        <div
          className="absolute top-10 left-2 right-2 z-50 p-2.5 bg-rose-950/90 border border-rose-800 rounded-lg text-rose-200 text-xs shadow-xl backdrop-blur flex items-start gap-2"
          data-testid="runtime-error-banner"
        >
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-rose-300">Runtime Error</div>
            <div className="text-[11px] font-mono break-all mt-0.5">
              {lastError}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
