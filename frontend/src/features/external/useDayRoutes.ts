import { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';
import type { DayRouteSummary, RouteLeg, Stop, Trip } from '../../types/api';
import { loadExternal, readExternal } from './external-cache';

type LocatedStop = Stop & { latitude: number; longitude: number };
const routeTtlMs = 24 * 60 * 60_000;
const maxConcurrentDays = 3;
const distanceFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });

export function hasCoordinates(stop: Stop): stop is LocatedStop {
  return stop.latitude !== null && stop.longitude !== null;
}

export function formatDistance(km: number) {
  return `${distanceFormat.format(km)} km`;
}

export function formatTravelDuration(seconds: number) {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} phút`;
  return minutes === 0 ? `${hours} giờ` : `${hours} giờ ${minutes} phút`;
}

export function estimateTravelLeg(from: LocatedStop, to: LocatedStop): RouteLeg {
  // Use the same mountain-road estimate as the proxy when the browser cannot reach it.
  const radians = Math.PI / 180;
  const lat1 = from.latitude * radians;
  const lat2 = to.latitude * radians;
  const deltaLng = (to.longitude - from.longitude) * radians;
  const haversine = Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  const distanceMeters = 6_371_000 * 2 * Math.asin(Math.sqrt(Math.min(1, haversine))) * 1.45;
  const durationSeconds = distanceMeters * 3.6 / 32;
  return {
    fromStopId: from.id, toStopId: to.id, distanceMeters, durationSeconds,
    distanceKm: Math.round(distanceMeters / 10) / 100,
    durationFormatted: formatTravelDuration(durationSeconds),
    coordinates: [[from.latitude, from.longitude], [to.latitude, to.longitude]],
    isFallback: true,
  };
}

function estimateDay(day: number, mapped: LocatedStop[], unmappedStopsCount: number): DayRouteSummary {
  const legs = mapped.slice(1).map((to, index) => estimateTravelLeg(mapped[index]!, to));
  const totalDurationSeconds = legs.reduce((total, leg) => total + leg.durationSeconds, 0);
  return {
    day, legs, totalDurationSeconds, totalDurationFormatted: formatTravelDuration(totalDurationSeconds),
    totalDistanceKm: Math.round(legs.reduce((total, leg) => total + leg.distanceMeters, 0) / 10) / 100,
    mappedStopsCount: mapped.length, unmappedStopsCount,
  };
}

export function useDayRoutes(trip: Trip, activeDay: number | null, isDemo: boolean) {
  const { id: tripId, durationDays, stops, vehicle } = trip;
  const requests = useMemo(() => {
    const days = activeDay === null ? Array.from({ length: durationDays }, (_, index) => index + 1) : [activeDay];
    return days.flatMap((day) => {
      if (day === 0) return [];
      const dayStops = stops.filter((stop) => stop.day === day);
      const mapped = dayStops.filter(hasCoordinates);
      if (mapped.length < 2) return [];
      const path = `/trips/${tripId}/external/day-route-summary?day=${day}`;
      const key = JSON.stringify([path, vehicle, mapped.map(({ id, latitude, longitude }) => [id, latitude, longitude])]);
      return [{ day, path, key, mapped, unmapped: dayStops.length - mapped.length }];
    });
  }, [activeDay, durationDays, stops, tripId, vehicle]);

  const batchKey = JSON.stringify(requests.map(({ key }) => key));
  const [loaded, setLoaded] = useState<{ key: string; summaries: DayRouteSummary[] }>();
  const { summaries, loading } = useMemo(() => {
    if (isDemo) {
      return { summaries: requests.map(({ day, mapped, unmapped }) => estimateDay(day, mapped, unmapped)), loading: false };
    }
    if (loaded?.key === batchKey) return { summaries: loaded.summaries, loading: loaded.summaries.length !== requests.length };
    const cached = requests.map(({ key }) => readExternal<DayRouteSummary>(key)).filter((value) => value !== undefined);
    return { summaries: cached, loading: cached.length !== requests.length };
  }, [batchKey, isDemo, loaded, requests]);

  useEffect(() => {
    if (isDemo || !requests.length) return;
    let active = true;
    let generation = 0;
    const requestDay = ({ key, path, day, mapped, unmapped }: typeof requests[number]) =>
      loadExternal(key, routeTtlMs, async () => {
        const data = await api<DayRouteSummary>(path, { timeoutMs: 9000 });
        if (data.legs.length !== mapped.length - 1 || data.legs.some((leg, index) =>
          leg.fromStopId !== mapped[index]?.id || leg.toStopId !== mapped[index + 1]?.id ||
          !leg.coordinates || leg.coordinates.length < 2 ||
          !Number.isFinite(leg.distanceMeters) || !Number.isFinite(leg.durationSeconds))) {
          throw new Error('Route data no longer matches the itinerary.');
        }
        return data;
      }).catch(() => estimateDay(day, mapped, unmapped));

    const refresh = async () => {
      const run = ++generation;
      const results: DayRouteSummary[] = [];
      // Leave room for other same-origin requests when a trip has many days.
      for (let i = 0; i < requests.length; i += maxConcurrentDays) {
        const batch = await Promise.all(requests.slice(i, i + maxConcurrentDays).map(requestDay));
        if (!active || run !== generation) return;
        results.push(...batch);
        setLoaded({ key: batchKey, summaries: [...results] });
      }
    };
    const onOnline = () => { void refresh(); };
    onOnline();
    window.addEventListener('online', onOnline);
    return () => {
      active = false;
      window.removeEventListener('online', onOnline);
    };
  }, [batchKey, isDemo, requests]);

  return { summaries, loading };
}
