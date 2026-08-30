import { Router, Request, Response } from "express";
import { renderOtaDashboardHtml } from "../views/ota-dashboard.html";

export function createOtaDashboardRouter(): Router {
  const router = Router();

  const handleDashboard = (req: Request, res: Response): void => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(renderOtaDashboardHtml());
  };

  router.get("/admin/ota", handleDashboard);
  router.get("/dashboard/ota", handleDashboard);

  return router;
}
