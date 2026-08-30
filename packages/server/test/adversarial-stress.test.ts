import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { WebSocket } from "ws";
import { createGoatServer, GoatServerInstance } from "../src/server";
import * as crypto from "crypto";

const ADMIN_AUTH = { Authorization: "Bearer test_admin_token" };

describe("Adversarial Stress & Resilience Challenge Suite", () => {
  let server: GoatServerInstance;
  let serverPort: number;

  beforeEach(async () => {
    process.env.GOAT_ADMIN_TOKEN = "test_admin_token";
    server = createGoatServer({
      port: 0,
      cdpPort: 0,
      safariPort: 0,
      inMemoryDb: true,
      enableCors: true,
    });
    await server.start();
    const addr = server.httpServer.address() as any;
    serverPort = addr.port;
    server.targetManager.setHostAndPort("127.0.0.1", serverPort);
    server.pairingManager.setHostAndPort("127.0.0.1", serverPort);
  });

  afterEach(async () => {
    await server.stop();
    delete process.env.GOAT_ADMIN_TOKEN;
  });

  // =========================================================================
  // CHALLENGE 1: High Concurrency Trace Ingestion & Percentiles Accuracy
  // =========================================================================
  describe("Challenge 1: High Concurrency Trace Ingestion & Percentiles Accuracy", () => {
    it("should handle 1,000+ concurrent trace ingestions without loss or deadlock", async () => {
      const TOTAL_CONCURRENT = 1000;
      const appId = "com.goat.stress.concurrent";
      const startTime = Date.now();
      const agent = request.agent(server.httpServer);
      const results: any[] = [];
      const BATCH_SIZE = 50;

      for (let b = 0; b < TOTAL_CONCURRENT; b += BATCH_SIZE) {
        const batchPromises: Promise<any>[] = [];
        for (let i = b; i < Math.min(b + BATCH_SIZE, TOTAL_CONCURRENT); i++) {
          const payload = {
            callId: `call_conc_${i}`,
            appId,
            action:
              i % 3 === 0
                ? "FETCH_DATA"
                : i % 3 === 1
                  ? "STORE_DATA"
                  : "AUTH_USER",
            direction: "REQ" as const,
            params: { idx: i, key: `val_${i}` },
            response: { ok: true, i },
            durationMs: (i % 100) + 1, // 1ms to 100ms
            status: i % 10 === 0 ? ("ERROR" as const) : ("SUCCESS" as const),
            timestamp: startTime + i,
          };

          batchPromises.push(
            agent
              .post("/api/traces")
              .send(payload)
              .expect(201),
          );
        }
        const batchRes = await Promise.all(batchPromises);
        results.push(...batchRes);
      }

      expect(results.length).toBe(TOTAL_CONCURRENT);

      // Verify all records in SQLite
      const sqlite = server.dbService.getRawSqlite();
      const countRow = sqlite
        .prepare("SELECT COUNT(*) as count FROM traces WHERE app_id = ?")
        .get(appId) as { count: number };
      expect(countRow.count).toBe(TOTAL_CONCURRENT);

      // Query list with pagination
      const listRes = await request(server.app)
        .get(`/api/traces?appId=${appId}&limit=1000`)
        .expect(200);
      expect(listRes.body.total).toBe(TOTAL_CONCURRENT);
      expect(listRes.body.data.length).toBe(1000);
    }, 30000);

    it("should compute exact statistical percentiles (p50, p90, p95, p99) on 1,000 linear samples", async () => {
      const appId = "com.goat.stats.linear";
      const N = 1000;
      const batch: any[] = [];
      const now = Date.now();

      // Durations strictly 1.0 to 1000.0 ms
      for (let i = 1; i <= N; i++) {
        batch.push({
          callId: `lin_${i}`,
          appId,
          action: "BENCHMARK",
          durationMs: i, // 1 to 1000
          status: i > 900 ? ("ERROR" as const) : ("SUCCESS" as const),
          timestamp: now + i * 10,
        });
      }

      // Ingest in one batch
      server.tracesService.ingestTraces(batch);

      const stats = server.tracesService.getStats({ appId });
      expect(stats.totalCalls).toBe(1000);
      expect(stats.errorCount).toBe(100);
      expect(stats.errorRate).toBe(10.0);
      expect(stats.avgLatencyMs).toBe(500.5);

      // Verify percentile math
      // Index for p50: Math.floor(0.50 * 1000) = 500 -> rows[500].duration_ms = 501
      expect(stats.p50LatencyMs).toBe(501);
      // Index for p90: Math.floor(0.90 * 1000) = 900 -> rows[900].duration_ms = 901
      expect(stats.p90LatencyMs).toBe(901);
      // Index for p95: Math.floor(0.95 * 1000) = 950 -> rows[950].duration_ms = 951
      expect(stats.p95LatencyMs).toBe(951);
      // Index for p99: Math.floor(0.99 * 1000) = 990 -> rows[990].duration_ms = 991
      expect(stats.p99LatencyMs).toBe(991);
    });

    it("should compute exact statistical percentiles on heavily skewed bimodal distribution", async () => {
      const appId = "com.goat.stats.skewed";
      const batch: any[] = [];
      const now = Date.now();

      // 950 fast calls at 5ms
      for (let i = 0; i < 950; i++) {
        batch.push({
          callId: `fast_${i}`,
          appId,
          action: "FAST_OP",
          durationMs: 5,
          status: "SUCCESS" as const,
          timestamp: now + i,
        });
      }

      // 40 medium calls at 50ms
      for (let i = 0; i < 40; i++) {
        batch.push({
          callId: `med_${i}`,
          appId,
          action: "MED_OP",
          durationMs: 50,
          status: "SUCCESS" as const,
          timestamp: now + 1000 + i,
        });
      }

      // 10 extreme outliers at 500ms
      for (let i = 0; i < 10; i++) {
        batch.push({
          callId: `slow_${i}`,
          appId,
          action: "SLOW_OP",
          durationMs: 500,
          status: "ERROR" as const,
          timestamp: now + 2000 + i,
        });
      }

      server.tracesService.ingestTraces(batch);
      const stats = server.tracesService.getStats({ appId });

      expect(stats.totalCalls).toBe(1000);
      expect(stats.p50LatencyMs).toBe(5);
      expect(stats.p90LatencyMs).toBe(5);
      expect(stats.p95LatencyMs).toBe(50);
      expect(stats.p99LatencyMs).toBe(500);
      expect(stats.topSlowActions[0].action).toBe("SLOW_OP");
      expect(stats.topSlowActions[0].avgDurationMs).toBe(500);
      expect(stats.topSlowActions[1].action).toBe("MED_OP");
      expect(stats.topSlowActions[1].avgDurationMs).toBe(50);
    });

    it("should gracefully handle edge cases in stats calculation (1 item, 0 duration, nulls)", () => {
      const appId = "com.goat.stats.single";
      server.tracesService.ingestTrace({
        callId: "single_1",
        appId,
        action: "ZERO_DUR",
        durationMs: 0,
        status: "SUCCESS",
      });

      const stats = server.tracesService.getStats({ appId });
      expect(stats.totalCalls).toBe(1);
      expect(stats.p50LatencyMs).toBe(0);
      expect(stats.p99LatencyMs).toBe(0);
      expect(stats.avgLatencyMs).toBe(0);
      expect(stats.errorRate).toBe(0);
    });

    it("should correctly filter traces with complex search terms and SQL-escaping safety", async () => {
      const appId = "com.goat.search.safety";
      server.tracesService.ingestTraces([
        {
          callId: "c1",
          appId,
          action: "GET_USER",
          params: { query: "user%admin" },
        },
        {
          callId: "c2",
          appId,
          action: "PAYMENT",
          error: { message: "syntax error near ''" },
        },
        {
          callId: "c3",
          appId,
          action: "DISPATCH",
          payload: { special: "<script>alert(1)</script>" },
        },
      ]);

      // Search for percent sign
      const res1 = await request(server.app)
        .get(`/api/traces?appId=${appId}&search=user%admin`)
        .expect(200);
      expect(res1.body.total).toBe(1);

      // Search for single quote
      const res2 = await request(server.app)
        .get(`/api/traces?appId=${appId}&search=syntax`)
        .expect(200);
      expect(res2.body.total).toBe(1);

      // Search for script tag
      const res3 = await request(server.app)
        .get(`/api/traces?appId=${appId}&search=script`)
        .expect(200);
      expect(res3.body.total).toBe(1);
    });
  });

  // =========================================================================
  // CHALLENGE 2: Malformed CDP JSON-RPC Frames & Broken WebSocket Clients
  // =========================================================================
  describe("Challenge 2: CDP JSON-RPC Protocol Resilience & WebSocket Stress", () => {
    it("should return standard JSON-RPC parse error (-32700) on malformed JSON frame", async () => {
      const wsUrl = `ws://127.0.0.1:${serverPort}/devtools/page/fuzz-target`;
      const ws = new WebSocket(wsUrl);

      await new Promise<void>((resolve, reject) => {
        ws.on("open", resolve);
        ws.on("error", reject);
      });

      const replyPromise = new Promise<any>((resolve) => {
        ws.once("message", (data) => resolve(JSON.parse(data.toString())));
      });

      // Send unparseable garbage
      ws.send('{ "jsonrpc": "2.0", method: broken ... NOT VALID JSON');

      const reply = await replyPromise;
      expect(reply).toHaveProperty("error");
      expect(reply.error.code).toBe(-32700);
      expect(reply.error.message).toContain("Parse error");

      ws.close();
    });

    it("should handle unknown domains and synthesize empty result without crashing", async () => {
      const wsUrl = `ws://127.0.0.1:${serverPort}/devtools/page/unknown-domain-target`;
      const ws = new WebSocket(wsUrl);

      await new Promise<void>((resolve, reject) => {
        ws.on("open", resolve);
        ws.on("error", reject);
      });

      const replyPromise = new Promise<any>((resolve) => {
        ws.once("message", (data) => resolve(JSON.parse(data.toString())));
      });

      // Send unknown domain method
      ws.send(
        JSON.stringify({
          id: 888,
          method: "NonExistentDomain.arbitraryCall",
          params: { foo: "bar" },
        }),
      );

      const reply = await replyPromise;
      expect(reply.id).toBe(888);
      expect(reply.result).toBeDefined();

      ws.close();
    });

    it("should handle rapid open/close socket churn and abrupt termination under load", async () => {
      const CHURN_COUNT = 50;
      const targetId = "churn-target";

      // Continuously ingest traces in background while sockets churn
      const traceInterval = setInterval(() => {
        server.tracesService.ingestTrace({
          callId: `churn_trace_${Date.now()}_${Math.random()}`,
          appId: "com.goat.churn",
          action: "STREAM_EVENT",
          durationMs: 1,
        });
      }, 5);

      const sockets: WebSocket[] = [];

      for (let i = 0; i < CHURN_COUNT; i++) {
        const ws = new WebSocket(
          `ws://127.0.0.1:${serverPort}/devtools/page/${targetId}`,
        );
        ws.on("error", () => {});
        sockets.push(ws);
      }

      await new Promise((res) => setTimeout(res, 50));

      // Abruptly terminate half of them
      for (let i = 0; i < CHURN_COUNT / 2; i++) {
        sockets[i].terminate();
      }

      // Clean close the other half
      for (let i = CHURN_COUNT / 2; i < CHURN_COUNT; i++) {
        if (sockets[i].readyState === WebSocket.OPEN) {
          sockets[i].close();
        }
      }

      clearInterval(traceInterval);
      await new Promise((res) => setTimeout(res, 100));

      // Verify server is healthy and responding
      const healthRes = await request(server.app)
        .get("/api/health")
        .expect(200);
      expect(healthRes.body.status).toBe("ok");
    });

    it("should handle GoatBridge custom methods with edge cases", async () => {
      const wsUrl = `ws://127.0.0.1:${serverPort}/devtools/page/goatbridge-edge-target`;
      const ws = new WebSocket(wsUrl);

      await new Promise<void>((resolve, reject) => {
        ws.on("open", resolve);
        ws.on("error", reject);
      });

      // 1. GoatBridge.setMockResponse with error flag
      const setMockPromise = new Promise<any>((resolve) => {
        ws.once("message", (data) => resolve(JSON.parse(data.toString())));
      });

      ws.send(
        JSON.stringify({
          id: 101,
          method: "GoatBridge.setMockResponse",
          params: {
            action: "CRITICAL_PAYMENT",
            shouldFail: true,
            errorMessage: "Simulated Card Network Down",
            delayMs: 2,
          },
        }),
      );

      const mockRes = await setMockPromise;
      expect(mockRes.id).toBe(101);
      expect(mockRes.result.success).toBe(true);
      expect(mockRes.result.rule.shouldFail).toBe(true);

      // 2. GoatBridge.getStats via CDP WS
      const getStatsPromise = new Promise<any>((resolve) => {
        ws.once("message", (data) => resolve(JSON.parse(data.toString())));
      });

      ws.send(
        JSON.stringify({
          id: 102,
          method: "GoatBridge.getStats",
          params: {},
        }),
      );

      const statsRes = await getStatsPromise;
      expect(statsRes.id).toBe(102);
      expect(statsRes.result.totalCalls).toBeDefined();

      // 3. GoatBridge.clearMocks
      const clearPromise = new Promise<any>((resolve) => {
        ws.once("message", (data) => resolve(JSON.parse(data.toString())));
      });

      ws.send(
        JSON.stringify({
          id: 103,
          method: "GoatBridge.clearMocks",
          params: { action: "CRITICAL_PAYMENT" },
        }),
      );

      const clearRes = await clearPromise;
      expect(clearRes.id).toBe(103);
      expect(clearRes.result.success).toBe(true);

      ws.close();
    });

    it("should forward injected events from debugger to target via GoatBridge.injectEvent", async () => {
      const targetId = "inject-test-target";
      const debuggerWs = new WebSocket(
        `ws://127.0.0.1:${serverPort}/devtools/page/${targetId}`,
      );
      const targetWs = new WebSocket(
        `ws://127.0.0.1:${serverPort}/devtools/target/${targetId}`,
      );

      await Promise.all([
        new Promise<void>((res) => debuggerWs.on("open", res)),
        new Promise<void>((res) => targetWs.on("open", res)),
      ]);

      const eventPromise = new Promise<any>((resolve) => {
        targetWs.on("message", (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.method === "GoatBridge.eventInjected") {
            resolve(msg);
          }
        });
      });

      // Debugger injects event
      debuggerWs.send(
        JSON.stringify({
          id: 404,
          method: "GoatBridge.injectEvent",
          params: {
            event: "onAppShow",
            data: { scene: 1001, referrerInfo: { appId: "com.goat.parent" } },
          },
        }),
      );

      const injected = await eventPromise;
      expect(injected.params.event).toBe("onAppShow");
      expect(injected.params.data.scene).toBe(1001);

      debuggerWs.close();
      targetWs.close();
    });
  });

  // =========================================================================
  // CHALLENGE 3: Malformed Manifest Schemas & Path Traversal on /api/assets/
  // =========================================================================
  describe("Challenge 3: Manifest Validation & Asset Path Traversal Security", () => {
    it("should reject various malformed manifest.json schemas with descriptive 400 errors", async () => {
      const invalidCases = [
        { payload: {}, desc: "Empty object" },
        {
          payload: { appId: "com.goat.app" },
          desc: "Missing name, version, pages",
        },
        {
          payload: {
            appId: "com.goat.app",
            name: "App",
            version: "1.0",
            pages: [],
          },
          desc: "Empty pages array",
        },
        {
          payload: {
            appId: "",
            name: "App",
            version: "1.0",
            pages: ["pages/index"],
          },
          desc: "Empty appId string",
        },
        {
          payload: {
            appId: "com.goat.app",
            name: "App",
            version: "1.0",
            pages: ["pages/index"],
            window: { navigationBarTextStyle: "purple" }, // invalid enum (must be black | white)
          },
          desc: "Invalid enum in window config",
        },
        {
          payload: {
            appId: "com.goat.app",
            name: "App",
            version: "1.0",
            pages: ["pages/index"],
            subpackages: [{ root: 12345, pages: ["pages/sub"] }], // invalid non-string root
          },
          desc: "Non-string root in subpackage",
        },
        {
          payload: {
            appId: "com.goat.app",
            name: "App",
            version: "1.0",
            pages: ["pages/index"],
            window: { onReachBottomDistance: "invalid-number" },
          },
          desc: "Non-number onReachBottomDistance",
        },
      ];

      for (const testCase of invalidCases) {
        const res = await request(server.app)
          .post("/api/manifest/validate")
          .send(testCase.payload)
          .expect(400);

        expect(res.body.valid).toBe(false);
        expect(res.body.error).toBeDefined();
      }
    });

    it("should sanitize asset paths and prevent directory traversal / file exposure", async () => {
      const appId = "com.goat.traversal.test";

      // 1. Upload standard asset
      await request(server.app)
        .post(`/api/assets/${appId}/pages/index.js`)
        .set(ADMIN_AUTH)
        .set("Content-Type", "application/javascript")
        .send('console.log("index");')
        .expect(201);

      // 2. Traversal attempt via dot-dot in URL
      const traversalAttempt1 = await request(server.app).get(
        `/api/assets/${appId}/../../../../etc/passwd`,
      );
      // Should not return 200 or /etc/passwd contents
      expect(traversalAttempt1.status).not.toBe(200);

      // 3. Encoded traversal attempt %2e%2e%2f
      const traversalAttempt2 = await request(server.app).get(
        `/api/assets/${appId}/%2e%2e%2f%2e%2e%2fpackage.json`,
      );
      expect(traversalAttempt2.status).not.toBe(200);

      // 4. Storing asset with leading slashes should be cleaned
      const leadingSlashRes = await request(server.app)
        .post(`/api/assets/${appId}////deep/nested/file.txt`)
        .set(ADMIN_AUTH)
        .set("Content-Type", "text/plain")
        .send("clean nested")
        .expect(201);

      expect(leadingSlashRes.body.path).toBe("deep/nested/file.txt");

      // Fetch back with clean path
      const fetchClean = await request(server.app)
        .get(`/api/assets/${appId}/deep/nested/file.txt`)
        .expect(200);
      expect(fetchClean.text).toBe("clean nested");
    });

    it("should handle large asset payloads and binary wasm/bytecode assets", async () => {
      const appId = "com.goat.binary.test";
      const binaryData = crypto.randomBytes(1024 * 512); // 512KB binary payload

      // Upload binary wasm asset
      const uploadRes = await request(server.app)
        .post(`/api/assets/${appId}/core.wasm`)
        .set(ADMIN_AUTH)
        .set("Content-Type", "application/wasm")
        .send(binaryData)
        .expect(201);

      expect(uploadRes.body.size).toBe(512 * 1024);
      expect(uploadRes.body.sha256).toBeDefined();

      // Download binary wasm asset
      const getRes = await request(server.app)
        .get(`/api/assets/${appId}/core.wasm`)
        .buffer(true)
        .parse((res, cb) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);

      expect(getRes.headers["content-type"]).toBe("application/wasm");
      expect(getRes.headers["content-length"]).toBe(String(512 * 1024));
      expect(Buffer.isBuffer(getRes.body)).toBe(true);
      expect(getRes.body.length).toBe(512 * 1024);
    });
  });

  // =========================================================================
  // CHALLENGE 4: Rapid QR Pairing Token Generation & Race Conditions
  // =========================================================================
  describe("Challenge 4: Rapid QR Pairing Token Generation & Race Conditions", () => {
    it("should generate 100 rapid QR pairing tokens without collision or SQLite lock error", async () => {
      const N = 100;
      const promises: Promise<any>[] = [];

      for (let i = 0; i < N; i++) {
        promises.push(
          request(server.httpServer)
            .post("/api/pair/init")
            .send({ appId: `com.goat.app_${i}` })
            .expect(201),
        );
      }

      const responses = await Promise.all(promises);
      const tokens = new Set<string>();

      for (const res of responses) {
        expect(res.body.token).toBeDefined();
        expect(res.body.status).toBe("PENDING");
        expect(res.body.qrDataUrl).toMatch(/^data:image\/png;base64,/);
        expect(res.body.qrSvg).toContain("<svg");
        tokens.add(res.body.token);
      }

      // Ensure 100% token uniqueness
      expect(tokens.size).toBe(N);

      // Verify SQLite session count
      const sqlite = server.dbService.getRawSqlite();
      const count = sqlite
        .prepare("SELECT COUNT(*) as count FROM sessions")
        .get() as { count: number };
      expect(count.count).toBeGreaterThanOrEqual(N);
    }, 30000);

    it("should handle simultaneous handshake race conditions on the same token cleanly", async () => {
      // 1. Create a session
      const initRes = await request(server.app)
        .post("/api/pair/init")
        .send({ appId: "com.goat.race" })
        .expect(201);
      const token = initRes.body.token;

      // 2. Fire 20 simultaneous handshakes with different device info for the same token
      const handshakePromises: Promise<any>[] = [];
      for (let i = 0; i < 20; i++) {
        handshakePromises.push(
          request(server.app)
            .post("/api/pair/handshake")
            .send({
              token,
              deviceInfo: {
                platform: i % 2 === 0 ? "android" : "ios",
                osVersion: `1${i}.0`,
                deviceName: `Device_${i}`,
              },
            }),
        );
      }

      const results = await Promise.all(handshakePromises);

      // All requests should succeed with 200 (idempotent/latest-write promotion)
      for (const r of results) {
        expect(r.status).toBe(200);
        expect(r.body.status).toBe("ACTIVE");
      }

      // Check final state
      const finalStatus = await request(server.app)
        .get(`/api/pair/status/${token}`)
        .expect(200);
      expect(finalStatus.body.status).toBe("ACTIVE");
      expect(finalStatus.body.deviceName).toMatch(/^Device_\d+$/);
    });

    it("should return 404 on handshake with non-existent or SQL-injected token", async () => {
      const sqlInjectionTokens = [
        "' OR '1'='1",
        "pair_tok_123'; DROP TABLE sessions; --",
        "non_existent_token_9999",
      ];

      for (const tok of sqlInjectionTokens) {
        const res = await request(server.app)
          .post("/api/pair/handshake")
          .send({
            token: tok,
            deviceInfo: {
              platform: "android",
              osVersion: "14.0",
              deviceName: "Attacker Device",
            },
          });

        expect(res.status).toBe(404);
        expect(res.body.error).toContain("Pairing session not found");
      }

      // Ensure sessions table was not dropped
      const sqlite = server.dbService.getRawSqlite();
      const tableCheck = sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'",
        )
        .get();
      expect(tableCheck).toBeDefined();
    });

    it("should handle multiple publisher/subscriber peers exchanging messages over tunnel simultaneously", async () => {
      const initRes = await request(server.app)
        .post("/api/pair/init")
        .send({ appId: "com.goat.stress_tunnel" });
      const token = initRes.body.token;
      await request(server.app)
        .post("/api/pair/handshake")
        .send({ token, deviceInfo: { name: "stress-device", platform: "web", osVersion: "1.0" } })
        .expect(200);
      const PEER_COUNT = 8;
      const sockets: WebSocket[] = [];
      const messagesReceived: string[] = [];

      for (let i = 0; i < PEER_COUNT; i++) {
        const ws = new WebSocket(
          `ws://127.0.0.1:${serverPort}/tunnel/${token}`,
        );
        sockets.push(ws);
      }

      await Promise.all(
        sockets.map(
          (ws) =>
            new Promise<void>((resolve) => {
              ws.on("open", resolve);
            }),
        ),
      );

      // Sockets 1..7 listen for messages
      for (let i = 1; i < PEER_COUNT; i++) {
        sockets[i].on("message", (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === "HMR_UPDATE") {
            messagesReceived.push(msg.data.file);
          }
        });
      }

      // Socket 0 acts as publisher and broadcasts 10 HMR updates
      sockets[0].send(JSON.stringify({ type: "JOIN", role: "publisher" }));

      for (let m = 0; m < 10; m++) {
        sockets[0].send(
          JSON.stringify({
            type: "HMR_UPDATE",
            data: { file: `file_${m}.ts`, hash: `hash_${m}` },
          }),
        );
      }

      await new Promise((res) => setTimeout(res, 150));

      // 7 subscribers * 10 messages = 70 received messages
      expect(messagesReceived.length).toBe((PEER_COUNT - 1) * 10);

      for (const ws of sockets) {
        ws.close();
      }
    });
  });
});
