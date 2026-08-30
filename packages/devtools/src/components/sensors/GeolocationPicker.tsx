/**
 * @goat/devtools - GeolocationPicker Component
 * GPS coordinate pin picker (Lat, Lng, Alt, Speed, Heading, Accuracy),
 * global city presets, and interactive GPX route playback player (1x-10x speed, scrub, play/pause).
 */

import React, { useState, useEffect, useRef } from 'react';
import { useDevToolsStore } from '../../store/index.ts';
import { MapPin, Navigation, Play, Pause, RotateCcw, FastForward, Upload, Globe, Repeat } from 'lucide-react';
import { parseGpxXml } from '../../services/gpxParser.ts';

export const GeolocationPicker: React.FC = () => {
  const {
    location = { latitude: 37.7749, longitude: -122.4194, altitude: 10, accuracy: 5, speed: 0, heading: 0 },
    gpxRoute = { points: [], isPlaying: false, speedMultiplier: 1.0, currentIndex: 0, loop: false },
    gpxPlayback,
    setLocation,
    setGpxRoute,
    setGpxPlaying,
    setGpxSpeedMultiplier,
    setGpxIndex,
    setGpxCurrentIndex,
    setGpxPlayback,
  } = useDevToolsStore();

  const [customLat, setCustomLat] = useState(location.latitude.toString());
  const [customLng, setCustomLng] = useState(location.longitude.toString());
  const [customAlt, setCustomAlt] = useState(String(location.altitude || 10));
  const [customSpeed, setCustomSpeed] = useState(String(location.speed || 0));
  const [customHeading, setCustomHeading] = useState(String(location.heading || 0));
  const [customAccuracy, setCustomAccuracy] = useState(String(location.accuracy || 5));
  const [isLooping, setIsLooping] = useState(gpxRoute.loop ?? gpxPlayback?.loop ?? true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const playbackTimerRef = useRef<any>(null);

  // Synchronize input fields when store location updates externally
  useEffect(() => {
    setCustomLat(location.latitude.toString());
    setCustomLng(location.longitude.toString());
    setCustomAlt((location.altitude ?? 10).toString());
    setCustomSpeed((location.speed ?? 0).toString());
    setCustomHeading((location.heading ?? 0).toString());
    setCustomAccuracy((location.accuracy ?? 5).toString());
  }, [location.latitude, location.longitude, location.altitude, location.speed, location.heading, location.accuracy]);

  const cityPresets = [
    { name: 'San Francisco', lat: 37.7749, lng: -122.4194, alt: 16 },
    { name: 'New York', lat: 40.7128, lng: -74.0060, alt: 10 },
    { name: 'Tokyo', lat: 35.6762, lng: 139.6503, alt: 40 },
    { name: 'London', lat: 51.5074, lng: -0.1278, alt: 11 },
    { name: 'Paris', lat: 48.8566, lng: 2.3522, alt: 35 },
    { name: 'Sydney', lat: -33.8688, lng: 151.2093, alt: 19 },
  ];

  const handleApplyCoordinates = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const lat = parseFloat(customLat);
    const lng = parseFloat(customLng);
    const alt = parseFloat(customAlt);
    const spd = parseFloat(customSpeed);
    const hdg = parseFloat(customHeading);
    const acc = parseFloat(customAccuracy);

    if (!isNaN(lat) && !isNaN(lng)) {
      setLocation({
        latitude: lat,
        longitude: lng,
        altitude: isNaN(alt) ? 10 : alt,
        speed: isNaN(spd) ? 0 : spd,
        heading: isNaN(hdg) ? 0 : hdg,
        accuracy: isNaN(acc) ? 5 : acc,
      });
    }
  };

  const handleCitySelect = (city: typeof cityPresets[0]) => {
    setCustomLat(city.lat.toString());
    setCustomLng(city.lng.toString());
    setCustomAlt(city.alt.toString());
    setLocation({
      latitude: city.lat,
      longitude: city.lng,
      altitude: city.alt,
      accuracy: 5,
      speed: 0,
      heading: 0,
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        try {
          const points = parseGpxXml(text);
          if (points && points.length > 0) {
            setGpxRoute(points);
            setLocation({
              latitude: points[0].lat,
              longitude: points[0].lng,
              altitude: points[0].ele || 10,
            });
          }
        } catch (err) {
          console.error('Failed to parse GPX XML:', err);
        }
      };
      reader.readAsText(file);
    }
  };

  const points = gpxRoute.points || [];
  const currentIndex = gpxRoute.currentIndex || gpxPlayback?.currentIndex || 0;
  const isPlaying = gpxRoute.isPlaying || gpxPlayback?.isPlaying || false;
  const speedMultiplier = gpxRoute.speedMultiplier || gpxPlayback?.speedMultiplier || 1.0;

  // Active Playback Timer Loop
  useEffect(() => {
    if (isPlaying && points.length > 0) {
      const intervalMs = Math.max(50, Math.floor(1000 / speedMultiplier));
      playbackTimerRef.current = setInterval(() => {
        const currentIdx = useDevToolsStore.getState().gpxRoute?.currentIndex ?? 0;
        let nextIdx = currentIdx + 1;

        if (nextIdx >= points.length) {
          if (isLooping) {
            nextIdx = 0;
          } else {
            setGpxPlaying(false);
            return;
          }
        }

        if (typeof setGpxIndex === 'function') {
          setGpxIndex(nextIdx);
        } else if (typeof setGpxCurrentIndex === 'function') {
          setGpxCurrentIndex(nextIdx);
        }
      }, intervalMs);
    }

    return () => {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    };
  }, [isPlaying, points, speedMultiplier, isLooping, setGpxIndex, setGpxCurrentIndex, setGpxPlaying]);

  return (
    <div className="p-4 space-y-4 text-xs select-none" data-testid="geolocation-picker">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-emerald-400" />
          <h3 className="font-bold text-neutral-200 uppercase tracking-wider text-[11px]">
            Geolocation & GPS Routing
          </h3>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
          <Globe className="w-3 h-3" />
          <span>Active GPS</span>
        </div>
      </div>

      {/* GPS Coordinate Input Form */}
      <form onSubmit={handleApplyCoordinates} className="space-y-2 bg-neutral-900/60 p-3 rounded-lg border border-neutral-800">
        <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
          Coordinate Pin Picker
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-neutral-500 font-mono">Latitude (°)</label>
            <input
              type="text"
              value={customLat}
              onChange={(e) => setCustomLat(e.target.value)}
              className="w-full bg-neutral-800 text-neutral-200 px-2 py-1 rounded border border-neutral-700 font-mono text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="text-[10px] text-neutral-500 font-mono">Longitude (°)</label>
            <input
              type="text"
              value={customLng}
              onChange={(e) => setCustomLng(e.target.value)}
              className="w-full bg-neutral-800 text-neutral-200 px-2 py-1 rounded border border-neutral-700 font-mono text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1">
          <div>
            <label className="text-[10px] text-neutral-500 font-mono">Altitude (m)</label>
            <input
              type="text"
              value={customAlt}
              onChange={(e) => setCustomAlt(e.target.value)}
              className="w-full bg-neutral-800 text-neutral-200 px-2 py-1 rounded border border-neutral-700 font-mono text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="text-[10px] text-neutral-500 font-mono">Speed (m/s)</label>
            <input
              type="text"
              value={customSpeed}
              onChange={(e) => setCustomSpeed(e.target.value)}
              className="w-full bg-neutral-800 text-neutral-200 px-2 py-1 rounded border border-neutral-700 font-mono text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="text-[10px] text-neutral-500 font-mono">Heading (°)</label>
            <input
              type="text"
              value={customHeading}
              onChange={(e) => setCustomHeading(e.target.value)}
              className="w-full bg-neutral-800 text-neutral-200 px-2 py-1 rounded border border-neutral-700 font-mono text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded text-xs transition-colors flex items-center justify-center gap-1 mt-1"
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>Inject GPS Location</span>
        </button>
      </form>

      {/* Global City Presets */}
      <div>
        <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
          Global City Presets
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {cityPresets.map((city) => (
            <button
              key={city.name}
              onClick={() => handleCitySelect(city)}
              className={`py-1 px-2 rounded font-medium border text-[11px] truncate transition-colors ${
                Math.abs(location.latitude - city.lat) < 0.01 && Math.abs(location.longitude - city.lng) < 0.01
                  ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              {city.name}
            </button>
          ))}
        </div>
      </div>

      {/* GPX Route Player */}
      <div className="space-y-3 bg-neutral-900/60 p-3 rounded-lg border border-neutral-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
              GPX Route Playback
            </span>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Upload className="w-3 h-3" />
            <span>Load GPX</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".gpx,.xml"
            className="hidden"
          />
        </div>

        {/* Route Stats & Timeline Scrub Slider */}
        <div className="space-y-1.5 font-mono text-[10px]">
          <div className="flex justify-between text-neutral-400">
            <span>Waypoints: {points.length}</span>
            <span>Current: #{currentIndex + 1}</span>
          </div>

          <input
            type="range"
            min="0"
            max={Math.max(0, points.length - 1)}
            value={currentIndex}
            onChange={(e) => {
              const idx = Number(e.target.value);
              setGpxIndex?.(idx);
              setGpxCurrentIndex?.(idx);
            }}
            disabled={points.length === 0}
            className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-40"
          />
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setGpxPlaying(!isPlaying)}
              disabled={points.length === 0}
              className={`p-2 rounded-lg font-bold text-white transition-colors ${
                isPlaying ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'
              } disabled:opacity-40`}
              title={isPlaying ? 'Pause Route' : 'Play Route'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={() => {
                setGpxIndex?.(0);
                setGpxCurrentIndex?.(0);
              }}
              disabled={points.length === 0}
              className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors disabled:opacity-40"
              title="Reset to start"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setIsLooping(!isLooping)}
              className={`p-2 rounded-lg transition-colors ${
                isLooping ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:text-white'
              }`}
              title={isLooping ? 'Loop Enabled' : 'Loop Disabled'}
            >
              <Repeat className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Speed Multipliers */}
          <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800 text-[10px] font-mono">
            {[1.0, 2.0, 5.0, 10.0].map((spd) => (
              <button
                key={spd}
                onClick={() => setGpxSpeedMultiplier(spd)}
                className={`px-1.5 py-0.5 rounded transition-colors ${
                  speedMultiplier === spd
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
