/**
 * gpxParser.ts — Parses GPX XML waypoint records and provides route simulation playback.
 */

import type { GpxPoint, GpxRoute, GpxWaypoint } from '../types/index.ts';

/**
 * Parses GPX XML string into an array of GpxPoint objects.
 */
export function parseGpxXml(xmlString: string): GpxPoint[] {
  const points: GpxPoint[] = [];
  if (!xmlString || typeof xmlString !== 'string') return points;

  // Regex parser for <trkpt lat="..." lon="..."> / <wpt lat="..." lon="..."> / <rtept lat="..." lon="...">
  const trkptRegex = /<(?:trkpt|wpt|rtept)\s+[^>]*lat=["']([^"']+)["'][^>]*lon=["']([^"']+)["'][^>]*>([\s\S]*?)<\/(?:trkpt|wpt|rtept)>|<(?:trkpt|wpt|rtept)\s+[^>]*lat=["']([^"']+)["'][^>]*lon=["']([^"']+)["'][^>]*\/>/gi;
  let match: RegExpExecArray | null;

  while ((match = trkptRegex.exec(xmlString)) !== null) {
    const latStr = match[1] || match[4];
    const lonStr = match[2] || match[5];
    const innerContent = match[3] || '';

    const lat = parseFloat(latStr);
    const lng = parseFloat(lonStr);
    if (!isNaN(lat) && !isNaN(lng)) {
      const point: GpxPoint = { lat, lng };

      const eleMatch = /<ele>([^<]+)<\/ele>/i.exec(innerContent);
      if (eleMatch) {
        const ele = parseFloat(eleMatch[1]);
        if (!isNaN(ele)) point.ele = ele;
      }
      const timeMatch = /<time>([^<]+)<\/time>/i.exec(innerContent);
      if (timeMatch) {
        point.time = timeMatch[1].trim();
      }

      points.push(point);
    }
  }

  return points;
}

/**
 * Calculates distance in meters between two lat/lng points using Haversine formula
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Parses GPX XML into a structured GpxRoute object with distance and duration statistics
 */
export function parseGpxRoute(xmlString: string, defaultName: string = 'Imported GPX Track'): GpxRoute {
  const points = parseGpxXml(xmlString);

  // Extract track name if present
  const nameMatch = /<name>([^<]+)<\/name>/i.exec(xmlString);
  const name = nameMatch ? nameMatch[1].trim() : defaultName;

  let totalDistanceMeters = 0;
  for (let i = 1; i < points.length; i++) {
    totalDistanceMeters += calculateHaversineDistanceMeters(
      points[i - 1].lat,
      points[i - 1].lng,
      points[i].lat,
      points[i].lng
    );
  }

  const waypoints: GpxWaypoint[] = points.map((p) => ({
    latitude: p.lat,
    longitude: p.lng,
    elevation: p.ele,
    time: p.time ? new Date(p.time).getTime() : undefined,
  }));

  return {
    name,
    waypoints,
    totalDistanceMeters,
    durationSeconds: Math.max(60, points.length * 5),
  };
}

/**
 * State controller for managing GPX route simulation playback with variable speeds and seeking.
 */
export class GpxRoutePlayer {
  private points: GpxPoint[] = [];
  private currentIndex: number = 0;
  private isPlaying: boolean = false;
  private speedMultiplier: number = 1.0;
  private loop: boolean = true;
  private timer: any = null;
  private onPointCallback?: (point: GpxPoint, index: number) => void;

  constructor(points: GpxPoint[] = []) {
    this.points = points;
  }

  setPoints(points: GpxPoint[]): void {
    this.points = points;
    this.currentIndex = 0;
    if (this.isPlaying) {
      this.stop();
      this.play();
    }
  }

  setSpeed(speedMultiplier: number): void {
    this.speedMultiplier = Math.max(0.1, Math.min(50, speedMultiplier));
    if (this.isPlaying) {
      this.pause();
      this.play();
    }
  }

  setLoop(loop: boolean): void {
    this.loop = loop;
  }

  onPoint(callback: (point: GpxPoint, index: number) => void): void {
    this.onPointCallback = callback;
  }

  play(): void {
    if (this.points.length === 0) return;
    this.isPlaying = true;
    const intervalMs = Math.max(20, Math.floor(1000 / this.speedMultiplier));

    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (this.currentIndex >= this.points.length) {
        if (this.loop) {
          this.currentIndex = 0;
        } else {
          this.pause();
          return;
        }
      }
      const point = this.points[this.currentIndex];
      if (this.onPointCallback && point) {
        this.onPointCallback(point, this.currentIndex);
      }
      this.currentIndex++;
    }, intervalMs);
  }

  pause(): void {
    this.isPlaying = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  stop(): void {
    this.pause();
    this.currentIndex = 0;
    if (this.points.length > 0 && this.onPointCallback) {
      this.onPointCallback(this.points[0], 0);
    }
  }

  seek(index: number): void {
    this.currentIndex = Math.max(0, Math.min(this.points.length - 1, index));
    const point = this.points[this.currentIndex];
    if (this.onPointCallback && point) {
      this.onPointCallback(point, this.currentIndex);
    }
  }

  getCurrentPoint(): GpxPoint | null {
    return this.points[this.currentIndex] || null;
  }

  getStatus() {
    return {
      isPlaying: this.isPlaying,
      currentIndex: this.currentIndex,
      totalPoints: this.points.length,
      speedMultiplier: this.speedMultiplier,
      loop: this.loop,
    };
  }
}
