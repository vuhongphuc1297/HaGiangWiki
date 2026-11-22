import { z } from 'zod';
import { ExternalCache } from './external.cache.js';
import { fetchExternalJson } from './external.fetch.js';
import type { RoadVehicle } from './external.validation.js';

type Point = { latitude: number; longitude: number };
type Route = { distanceMeters: number; durationSeconds: number; isFallback: boolean };

const cache = new ExternalCache<Route>(24 * 60 * 60_000);
const osrmPayload = z.object({
  code: z.literal('Ok'),
  routes: z.tuple([z.object({ distance: z.number().nonnegative(), duration: z.number().nonnegative() })], z.unknown()),
});
const mountainSpeeds = { XE_MAY: 32, O_TO: 38 } satisfies Record<RoadVehicle, number>;
const EARTH_RADIUS_METERS = 6_371_000;
const WINDING_FACTOR = 1.45;
const FALLBACK_SPEED_KMH = 32;

function travelSeconds(distanceMeters: number, speedKmh: number) {
  return distanceMeters * 3.6 / speedKmh;
}

function estimateRoute(from: Point, to: Point): Route {
  const radians = Math.PI / 180;
  const lat1 = from.latitude * radians;
  const lat2 = to.latitude * radians;
  const deltaLng = (to.longitude - from.longitude) * radians;
  const haversine = Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  const centralAngle = 2 * Math.asin(Math.sqrt(Math.min(1, haversine)));
  const distanceMeters = EARTH_RADIUS_METERS * centralAngle * WINDING_FACTOR;
  return { distanceMeters, durationSeconds: travelSeconds(distanceMeters, FALLBACK_SPEED_KMH), isFallback: true };
}

export function getRoute(from: Point, to: Point, vehicle: RoadVehicle) {
  const key = `route:${from.latitude.toFixed(3)}:${from.longitude.toFixed(3)}:${to.latitude.toFixed(3)}:${to.longitude.toFixed(3)}:${vehicle}`;
  return cache.getOrLoad(key, async () => {
    const fromCoords = `${from.longitude.toFixed(6)},${from.latitude.toFixed(6)}`;
    const toCoords = `${to.longitude.toFixed(6)},${to.latitude.toFixed(6)}`;
    const url = new URL(`https://router.project-osrm.org/route/v1/driving/${fromCoords};${toCoords}?overview=false`);
    try {
      const { routes: [route] } = osrmPayload.parse(await fetchExternalJson(url));
      return {
        distanceMeters: route.distance,
        durationSeconds: Math.max(route.duration, travelSeconds(route.distance, mountainSpeeds[vehicle])),
        isFallback: false,
      };
    } catch {
      return estimateRoute(from, to);
    }
  });
}

export function distanceKm(meters: number) {
  return Math.round(meters / 10) / 100;
}

export function formatDuration(seconds: number) {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} phút`;
  return minutes === 0 ? `${hours} giờ` : `${hours} giờ ${minutes} phút`;
}
