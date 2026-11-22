import type { RequestHandler } from 'express';
import { prisma } from '../../config/database.js';
import { stringParam } from '../../middlewares/validate.middleware.js';
import { HttpError, TRIP_ACCESS_DENIED } from '../../utils/httpError.js';
import { dayRouteQuery, routeQuery, weatherQuery } from './external.validation.js';
import { distanceKm, formatDuration, getRoute } from './routing.service.js';
import { getWeather } from './weather.service.js';

// Trips can include air travel. Use the local road default for their stops.
function roadVehicleForTrip(vehicle: string) {
  return vehicle === 'O_TO' ? 'O_TO' : 'XE_MAY';
}

async function getTripVehicle(tripId: string) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { vehicle: true } });
  if (!trip) throw new HttpError(403, TRIP_ACCESS_DENIED);
  return roadVehicleForTrip(trip.vehicle);
}

export const weather: RequestHandler = async (req, res) => {
  const { lat, lng, date } = weatherQuery.parse(req.query);
  res.json(await getWeather(lat, lng, date));
};

export const route: RequestHandler = async (req, res) => {
  const input = routeQuery.parse(req.query);
  const vehicle = input.vehicle ?? await getTripVehicle(stringParam(req, 'tripId'));
  const result = await getRoute(
    { latitude: input.fromLat, longitude: input.fromLng },
    { latitude: input.toLat, longitude: input.toLng },
    vehicle,
  );
  res.json({
    ...result,
    distanceKm: distanceKm(result.distanceMeters),
    durationMinutes: Math.round(result.durationSeconds / 60),
    durationFormatted: formatDuration(result.durationSeconds),
  });
};

export const dayRouteSummary: RequestHandler = async (req, res) => {
  const { day } = dayRouteQuery.parse(req.query);
  const trip = await prisma.trip.findUnique({
    where: { id: stringParam(req, 'tripId') },
    select: {
      vehicle: true,
      stops: {
        where: { day, deletedAt: null },
        orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
        select: { id: true, latitude: true, longitude: true },
      },
    },
  });
  if (!trip) throw new HttpError(403, TRIP_ACCESS_DENIED);

  const vehicle = roadVehicleForTrip(trip.vehicle);
  const mapped = trip.stops.filter((stop): stop is { id: string; latitude: number; longitude: number } =>
    stop.latitude !== null && stop.longitude !== null);
  const routes = await Promise.all(mapped.slice(1).map(async (to, index) => {
    const from = mapped[index]!;
    const result = await getRoute(from, to, vehicle);
    return { ...result, fromStopId: from.id, toStopId: to.id };
  }));
  res.json({
    day,
    totalDistanceKm: distanceKm(routes.reduce((total, leg) => total + leg.distanceMeters, 0)),
    totalDurationFormatted: formatDuration(routes.reduce((total, leg) => total + leg.durationSeconds, 0)),
    mappedStopsCount: mapped.length,
    unmappedStopsCount: trip.stops.length - mapped.length,
    legs: routes.map(({ fromStopId, toStopId, distanceMeters, durationSeconds }) => ({
      fromStopId, toStopId, distanceKm: distanceKm(distanceMeters), durationFormatted: formatDuration(durationSeconds),
    })),
  });
};
