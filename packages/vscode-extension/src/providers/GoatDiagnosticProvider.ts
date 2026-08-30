/**
 * GoatDiagnosticProvider — Lints and validates mini-app manifest files.
 */

import { VALID_PERMISSIONS } from "./ManifestCompletionProvider.js";

export interface Diagnostic {
  message: string;
  severity: "Error" | "Warning" | "Information";
  field?: string;
}

export class GoatDiagnosticProvider {
  public validateManifestJson(jsonContent: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    let manifest: Record<string, any>;
    try {
      manifest = JSON.parse(jsonContent);
    } catch (e) {
      diagnostics.push({
        message: `Invalid JSON syntax: ${(e as Error).message}`,
        severity: "Error",
      });
      return diagnostics;
    }

    if (typeof manifest !== "object" || manifest === null) {
      diagnostics.push({
        message: "Manifest must be a JSON object",
        severity: "Error",
      });
      return diagnostics;
    }

    // Required fields check
    const required = [
      "appId",
      "appName",
      "version",
      "versionCode",
      "entryPage",
    ];
    for (const req of required) {
      if (!manifest[req] && manifest[req] !== 0) {
        diagnostics.push({
          message: `Missing required property "${req}" in manifest`,
          severity: "Error",
          field: req,
        });
      }
    }

    // appId validation (reverse domain regex)
    if (manifest.appId && typeof manifest.appId === "string") {
      const reverseDomainRegex = /^[a-z0-9]+(\.[a-z0-9]+)+$/;
      if (!reverseDomainRegex.test(manifest.appId)) {
        diagnostics.push({
          message: `Invalid appId "${manifest.appId}". Must be reverse-domain format (e.g. "com.example.app")`,
          severity: "Error",
          field: "appId",
        });
      }
    }

    // version format check (semver)
    if (manifest.version && typeof manifest.version === "string") {
      const semverRegex = /^\d+\.\d+\.\d+(-[a-z0-9.]+)?$/;
      if (!semverRegex.test(manifest.version)) {
        diagnostics.push({
          message: `Version "${manifest.version}" does not follow semantic versioning (e.g. "1.0.0")`,
          severity: "Warning",
          field: "version",
        });
      }
    }

    // versionCode check
    if (manifest.versionCode !== undefined) {
      if (!Number.isInteger(manifest.versionCode) || manifest.versionCode < 1) {
        diagnostics.push({
          message: "versionCode must be a positive integer >= 1",
          severity: "Error",
          field: "versionCode",
        });
      }
    }

    // permissions validation & duplicates check
    if (manifest.permissions) {
      if (!Array.isArray(manifest.permissions)) {
        diagnostics.push({
          message: "permissions must be an array of strings",
          severity: "Error",
          field: "permissions",
        });
      } else {
        const seen = new Set<string>();
        for (const perm of manifest.permissions) {
          if (typeof perm !== "string") {
            diagnostics.push({
              message: `Permission item must be string, got ${typeof perm}`,
              severity: "Error",
            });
            continue;
          }
          if (!VALID_PERMISSIONS.includes(perm)) {
            diagnostics.push({
              message: `Unknown permission "${perm}". Valid options: ${VALID_PERMISSIONS.join(", ")}`,
              severity: "Error",
              field: "permissions",
            });
          }
          if (seen.has(perm)) {
            diagnostics.push({
              message: `Duplicate permission "${perm}" declared`,
              severity: "Warning",
              field: "permissions",
            });
          }
          seen.add(perm);
        }
      }
    }

    // window background color check
    if (manifest.window?.backgroundColor) {
      const hexColorRegex = /^#[0-9a-fA-F]{6}$/;
      if (!hexColorRegex.test(manifest.window.backgroundColor)) {
        diagnostics.push({
          message: `Invalid hex color "${manifest.window.backgroundColor}". Expected 6-digit hex string (e.g. "#FFFFFF")`,
          severity: "Warning",
          field: "window.backgroundColor",
        });
      }
    }

    return diagnostics;
  }
}
