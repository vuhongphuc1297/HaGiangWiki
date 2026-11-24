import { z } from 'zod';

function coordinate(limit: number) {
  return z.string().trim().regex(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/)
    .transform(Number).pipe(z.number().min(-limit).max(limit));
}

const latitude = coordinate(90);
const longitude = coordinate(180);

export const roadVehicle = z.enum(['XE_MAY', 'O_TO']);
export type RoadVehicle = z.infer<typeof roadVehicle>;

export const weatherQuery = z.object({
  lat: latitude,
  lng: longitude,
  date: z.iso.date().optional(),
});

export const routeQuery = z.object({
  fromLat: latitude,
  fromLng: longitude,
  toLat: latitude,
  toLng: longitude,
  vehicle: roadVehicle.optional(),
});

export const dayRouteQuery = z.object({
  day: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0).max(30)),
});
