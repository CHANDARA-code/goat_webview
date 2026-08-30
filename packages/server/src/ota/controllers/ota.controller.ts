import { Router, Request, Response } from "express";
import { requireAdminAuth } from "../../auth/api-auth.middleware";
import { OtaService } from "../services/ota.service";
import { computeSha256 } from "../services/ota-crypto.service";
import { isValidSemver } from "../services/ota-governance.service";

export function createOtaRouter(otaService: OtaService): Router {
  const router = Router();

  // 1. Release Publishing API
  router.post(
    "/ota/apps/:appId/releases",
    requireAdminAuth,
    async (req: Request, res: Response): Promise<void> => {
      const { appId } = req.params;
      const {
        version,
        channel = "production",
        rolloutPercentage = 100,
        bundleBase64,
        releaseNotes,
        minEngineVersion,
        targetPlatforms,
        isMandatory,
      } = req.body;

      if (!version || !isValidSemver(version)) {
        res.status(400).json({ error: `Invalid SemVer version: ${version}` });
        return;
      }

      let bundleBuf: Buffer;
      if (typeof bundleBase64 === "string") {
        bundleBuf = Buffer.from(bundleBase64, "base64");
      } else if (Buffer.isBuffer(req.body)) {
        bundleBuf = req.body;
      } else {
        res
          .status(400)
          .json({ error: "Missing bundle payload (bundleBase64 required)" });
        return;
      }

      if (bundleBuf.length === 0) {
        res.status(400).json({ error: "Bundle buffer cannot be empty" });
        return;
      }

      try {
        const result = await otaService.publishRelease(appId, {
          version,
          channel,
          rolloutPercentage: Number(rolloutPercentage),
          bundleBuffer: bundleBuf,
          releaseNotes,
          minEngineVersion,
          targetPlatforms,
          isMandatory: !!isMandatory,
        });

        res.status(201).json(result);
      } catch (err: any) {
        if (err.status === 409 || err.message?.includes("already exists")) {
          res.status(409).json({ error: err.message });
          return;
        }
        res
          .status(400)
          .json({ error: err.message || "Failed to publish release" });
      }
    },
  );

  // 2. Client Update Check API
  router.get("/ota/check-update", (req: Request, res: Response): void => {
    const {
      appId,
      currentVersion,
      platform = "all",
      deviceId = "default",
      engineVersion,
      channel = "production",
    } = req.query as Record<string, string>;

    if (!appId || !currentVersion) {
      res
        .status(400)
        .json({
          error: "Query parameters appId and currentVersion are required",
        });
      return;
    }

    try {
      const updateResult = otaService.checkUpdate({
        appId,
        currentVersion,
        platform,
        deviceId,
        engineVersion,
        channel,
      });

      res.status(200).json(updateResult);
    } catch (err: any) {
      res
        .status(500)
        .json({ error: err.message || "Error checking for updates" });
    }
  });

  // 3. App Management APIs
  router.get("/ota/apps", (req: Request, res: Response): void => {
    const apps = otaService.listApps();
    res.json({ count: apps.length, apps });
  });

  router.get("/ota/apps/:appId", (req: Request, res: Response): void => {
    const { appId } = req.params;
    const app = otaService.getApp(appId);
    if (!app) {
      res.status(404).json({ error: `App ${appId} not found` });
      return;
    }
    const stats = otaService.getAppStats(appId);
    res.json({ app, stats });
  });

  // 4. Release & Patch Listing APIs
  router.get(
    "/ota/apps/:appId/releases",
    (req: Request, res: Response): void => {
      const { appId } = req.params;
      const releases = otaService.listReleases(appId);
      res.json({ appId, count: releases.length, releases });
    },
  );

  router.get(
    "/ota/apps/:appId/patches",
    (req: Request, res: Response): void => {
      const { appId } = req.params;
      const patches = otaService.listPatches(appId);
      res.json({ appId, count: patches.length, patches });
    },
  );

  // 5. Canary Rollout Adjustment API
  router.post(
    "/ota/apps/:appId/rollout",
    requireAdminAuth,
    (req: Request, res: Response): void => {
      const { appId } = req.params;
      const { rolloutPercentage, channel = "production" } = req.body;

      if (
        rolloutPercentage === undefined ||
        typeof rolloutPercentage !== "number" ||
        rolloutPercentage < 0 ||
        rolloutPercentage > 100
      ) {
        res
          .status(400)
          .json({
            error: "rolloutPercentage must be a number between 0 and 100",
          });
        return;
      }

      try {
        const result = otaService.setRolloutPercentage(
          appId,
          rolloutPercentage,
          channel,
        );
        res.json(result);
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    },
  );

  // 6. Rollback API
  router.post(
    "/ota/apps/:appId/rollback",
    requireAdminAuth,
    (req: Request, res: Response): void => {
      const { appId } = req.params;
      const { targetVersion, reason, channel = "production" } = req.body;

      if (!targetVersion) {
        res.status(400).json({ error: "targetVersion is required" });
        return;
      }

      try {
        const result = otaService.triggerRollback(
          appId,
          targetVersion,
          reason,
          channel,
        );
        res.json(result);
      } catch (err: any) {
        const status =
          err.status || (err.message.includes("does not exist") ? 404 : 400);
        res.status(status).json({ error: err.message });
      }
    },
  );

  // 7. Telemetry & Stats APIs
  router.post("/ota/telemetry", (req: Request, res: Response): void => {
    try {
      otaService.recordTelemetry(req.body);
      res.status(201).json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get("/ota/stats/:appId", (req: Request, res: Response): void => {
    const { appId } = req.params;
    const stats = otaService.getAppStats(appId);
    res.json({ success: true, stats });
  });

  // 8. Static Bundle Serving with Range 206 Support
  router.get(
    "/ota/bundles/:appId/:version/bundle.zip",
    (req: Request, res: Response): void => {
      const { appId, version } = req.params;
      const buf = otaService.getBundleBuffer(appId, version);
      if (!buf) {
        res.status(404).json({ error: "Bundle not found" });
        return;
      }

      const etag = `"${computeSha256(buf).substring(0, 16)}"`;
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Length", buf.length);
      res.setHeader("ETag", etag);
      res.setHeader("Accept-Ranges", "bytes");

      const range = req.headers.range;
      if (range) {
        const match = /^bytes=(\d+)-(\d*)$/.exec(range.trim());
        if (!match) {
          res.removeHeader("Content-Length");
          res.setHeader("Content-Range", `bytes */${buf.length}`);
          res.status(416).end();
          return;
        }
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : buf.length - 1;
        if (
          !Number.isFinite(start) ||
          !Number.isFinite(end) ||
          start < 0 ||
          start > end ||
          end >= buf.length
        ) {
          res.removeHeader("Content-Length");
          res.setHeader("Content-Range", `bytes */${buf.length}`);
          res.status(416).end();
          return;
        }
        const chunk = buf.subarray(start, end + 1);
        res.status(206);
        res.setHeader("Content-Range", `bytes ${start}-${end}/${buf.length}`);
        res.setHeader("Content-Length", chunk.length);
        res.send(chunk);
        return;
      }

      res.status(200).send(buf);
    },
  );

  // 9. Static Patch Serving
  router.get(
    "/ota/patches/:appId/:fromVersion/:toVersion/patch.bin",
    (req: Request, res: Response): void => {
      const { appId, fromVersion, toVersion } = req.params;
      const buf = otaService.getPatchBuffer(appId, fromVersion, toVersion);
      if (!buf) {
        res.status(404).json({ error: "Patch not found" });
        return;
      }

      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Length", buf.length);
      res.setHeader("ETag", `"${computeSha256(buf).substring(0, 16)}"`);
      res.setHeader("Accept-Ranges", "bytes");
      res.status(200).send(buf);
    },
  );

  // Also support filename-based patch route e.g. /ota/patches/:appId/:filename
  router.get(
    "/ota/patches/:appId/:filename",
    (req: Request, res: Response): void => {
      const { appId, filename } = req.params;
      const match = filename.match(/^(.+)_to_(.+)\.patch$/);
      if (!match) {
        res.status(404).json({ error: "Invalid patch filename format" });
        return;
      }
      const [, fromVersion, toVersion] = match;
      const buf = otaService.getPatchBuffer(appId, fromVersion, toVersion);
      if (!buf) {
        res.status(404).json({ error: "Patch not found" });
        return;
      }

      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Length", buf.length);
      res.setHeader("ETag", `"${computeSha256(buf).substring(0, 16)}"`);
      res.status(200).send(buf);
    },
  );

  return router;
}
