import { Router, Request, Response } from 'express';
import { TracesService } from './traces.service';
import { TraceItem, MockRuleItem } from './traces.types';

export function createTracesRouter(tracesService: TracesService): Router {
  const router = Router();

  // GET /api/traces/stats (must be before /:callId)
  router.get('/traces/stats', (req: Request, res: Response) => {
    try {
      const stats = tracesService.getStats({
        appId: req.query.appId as string,
        sessionId: req.query.sessionId as string,
        timeWindowSec: req.query.timeWindowSec ? Number(req.query.timeWindowSec) : undefined,
        startTime: req.query.startTime ? Number(req.query.startTime) : undefined,
        endTime: req.query.endTime ? Number(req.query.endTime) : undefined,
      });
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/traces
  router.get('/traces', (req: Request, res: Response) => {
    try {
      const result = tracesService.getTraces({
        appId: req.query.appId as string,
        sessionId: req.query.sessionId as string,
        action: req.query.action as string,
        status: req.query.status as any,
        hasError: req.query.hasError !== undefined ? req.query.hasError === 'true' : undefined,
        minDuration: req.query.minDuration ? Number(req.query.minDuration) : undefined,
        startTime: req.query.startTime ? Number(req.query.startTime) : undefined,
        endTime: req.query.endTime ? Number(req.query.endTime) : undefined,
        threadLane: req.query.threadLane as string,
        batchId: req.query.batchId as string,
        seqId: req.query.seqId ? Number(req.query.seqId) : undefined,
        search: req.query.search as string,
        limit: req.query.limit ? Number(req.query.limit) : 50,
        offset: req.query.offset ? Number(req.query.offset) : 0,
        sortBy: req.query.sortBy as any,
        sortOrder: req.query.sortOrder as any,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/traces/:callId
  router.get('/traces/:callId', (req: Request, res: Response) => {
    try {
      const trace = tracesService.getTraceById(req.params.callId);
      if (!trace) {
        res.status(404).json({ error: `Trace not found with callId/id: ${req.params.callId}` });
        return;
      }
      res.json(trace);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/traces (single or batch)
  router.post('/traces', (req: Request, res: Response) => {
    try {
      const body = req.body;
      if (Array.isArray(body)) {
        const ingested = tracesService.ingestTraces(body);
        res.status(201).json({ ingested: ingested.length, traces: ingested });
        return;
      }

      if (body && Array.isArray(body.traces)) {
        const ingested = tracesService.ingestTraces(body.traces);
        res.status(201).json({ ingested: ingested.length, traces: ingested });
        return;
      }

      if (body && typeof body === 'object') {
        const ingested = tracesService.ingestTrace(body as TraceItem);
        res.status(201).json({ ingested: 1, trace: ingested });
        return;
      }

      res.status(400).json({ error: 'Invalid trace payload' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/traces
  router.delete('/traces', (req: Request, res: Response) => {
    try {
      const count = tracesService.deleteTraces({
        appId: req.query.appId as string,
        sessionId: req.query.sessionId as string,
        olderThanMs: req.query.olderThanMs ? Number(req.query.olderThanMs) : undefined,
      });
      res.json({ deleted: count });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/mocks
  router.get('/mocks', (req: Request, res: Response) => {
    try {
      const appId = req.query.appId as string;
      const mocks = tracesService.getMocks(appId);
      res.json(mocks);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/mocks
  router.post('/mocks', (req: Request, res: Response) => {
    try {
      const body = req.body as MockRuleItem;
      if (!body || !body.action) {
        res.status(400).json({ error: 'action is required for mock rule' });
        return;
      }
      const saved = tracesService.setMock(body);
      res.status(201).json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/mocks/:action
  router.delete('/mocks/:action', (req: Request, res: Response) => {
    try {
      const action = req.params.action;
      const appId = req.query.appId as string;
      const success = tracesService.deleteMock(action, appId);
      res.json({ success });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
