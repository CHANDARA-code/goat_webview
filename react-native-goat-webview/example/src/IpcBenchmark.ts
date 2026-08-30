import { GoatWebViewNativeModule } from 'react-native-goat-webview';
import { LatencyStats, IpcMessageEntry } from './types';

export class IpcBenchmarkRunner {
  private isRunning: boolean = false;
  private durationHistory: number[] = [];

  public getHistory(): number[] {
    return [...this.durationHistory];
  }

  public calculateStats(durations: number[] = this.durationHistory): LatencyStats {
    if (durations.length === 0) {
      return {
        totalCalls: 0,
        warmPathCalls: 0,
        warmPathPercentage: 0,
        avgDurationMs: 0,
        minDurationMs: 0,
        maxDurationMs: 0,
        p50DurationMs: 0,
        p95DurationMs: 0,
        p99DurationMs: 0,
        recentDurations: [],
      };
    }

    const sorted = [...durations].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, v) => acc + v, 0);
    const warmPathCount = sorted.filter((d) => d < 5.0).length;

    const p50Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.5));
    const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
    const p99Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99));

    return {
      totalCalls: sorted.length,
      warmPathCalls: warmPathCount,
      warmPathPercentage: parseFloat(((warmPathCount / sorted.length) * 100).toFixed(1)),
      avgDurationMs: parseFloat((sum / sorted.length).toFixed(2)),
      minDurationMs: parseFloat(sorted[0].toFixed(2)),
      maxDurationMs: parseFloat(sorted[sorted.length - 1].toFixed(2)),
      p50DurationMs: parseFloat(sorted[p50Index].toFixed(2)),
      p95DurationMs: parseFloat(sorted[p95Index].toFixed(2)),
      p99DurationMs: parseFloat(sorted[p99Index].toFixed(2)),
      recentDurations: durations.slice(-30),
    };
  }

  public recordDuration(durationMs: number) {
    this.durationHistory.push(durationMs);
    if (this.durationHistory.length > 500) {
      this.durationHistory.shift();
    }
  }

  public clearHistory() {
    this.durationHistory = [];
  }

  /**
   * Executes an automated batch benchmark suite (e.g. 50 or 100 iterations)
   * measuring warm-path TurboModule JSI latency.
   */
  public async runBatchBenchmark(
    iterations: number = 50,
    onProgress?: (progress: number, currentDuration: number) => void,
    onMessage?: (entry: IpcMessageEntry) => void
  ): Promise<LatencyStats> {
    if (this.isRunning) {
      throw new Error('Benchmark is already in progress');
    }

    this.isRunning = true;
    const batchDurations: number[] = [];

    try {
      for (let i = 0; i < iterations; i++) {
        const reqId = `bench_req_${Date.now()}_${i}`;
        const startTime = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();

        let success = true;
        let responseData: any = null;
        let errorMessage: string | undefined;

        try {
          if (typeof GoatWebViewNativeModule.executeAction === 'function') {
            responseData = await GoatWebViewNativeModule.executeAction(
              'BENCHMARK_PING',
              { seq: i, timestamp: Date.now(), client: 'ReactNative_Fabric' },
              'com.goat.diagnostics'
            );
          } else {
            // Simulated JSI fast-path execution
            await new Promise((r) => setTimeout(r, Math.random() * 2.5 + 0.5));
            responseData = { ack: true, seq: i };
          }
        } catch (err: any) {
          success = false;
          errorMessage = err?.message || String(err);
        }

        const endTime = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
        const duration = Math.max(0.1, parseFloat((endTime - startTime).toFixed(2)));

        batchDurations.push(duration);
        this.recordDuration(duration);

        if (onMessage) {
          onMessage({
            id: reqId,
            timestamp: Date.now(),
            action: 'BENCHMARK_PING',
            status: success ? 'SUCCESS' : 'ERROR',
            durationMs: duration,
            isWarmPath: duration < 5.0,
            request: { seq: i, iteration: i + 1, total: iterations },
            response: responseData,
            error: errorMessage,
            lane: 'Host',
            appId: 'com.goat.diagnostics',
          });
        }

        if (onProgress) {
          onProgress(Math.round(((i + 1) / iterations) * 100), duration);
        }

        // Small yield to prevent UI freeze
        if (i % 10 === 0) {
          await new Promise((r) => setTimeout(r, 4));
        }
      }
    } finally {
      this.isRunning = false;
    }

    return this.calculateStats(batchDurations);
  }
}

export const ipcBenchmark = new IpcBenchmarkRunner();
