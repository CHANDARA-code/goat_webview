import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createGoatServer, GoatServerInstance } from '../src/server';

describe('Server Root & Health API', () => {
  let server: GoatServerInstance;

  beforeEach(async () => {
    server = createGoatServer({
      port: 0,
      cdpPort: 0,
      safariPort: 0,
      inMemoryDb: true,
      enableCors: true,
    });
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  it('should return welcome banner on GET /', async () => {
    const res = await request(server.app).get('/').expect(200);

    expect(res.body.name).toBe('@goat/server');
    expect(res.body.version).toBe('1.4.0');
    expect(res.body.status).toBe('running');
    expect(res.body.apiHealth).toContain('/api/health');
  });

  it('should return system diagnostics and memory on GET /api/health', async () => {
    const res = await request(server.app).get('/api/health').expect(200);

    expect(res.body.status).toBe('ok');
    expect(res.body.version).toBe('1.4.0');
    expect(res.body.uptimeSec).toBeGreaterThanOrEqual(0);
    expect(res.body.memory).toHaveProperty('rssBytes');
    expect(res.body.memory).toHaveProperty('heapUsedBytes');
    expect(res.body.stats).toHaveProperty('activeTargets');
    expect(res.body.stats).toHaveProperty('activeSessions');
  });
});
