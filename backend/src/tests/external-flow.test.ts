import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { app } from '../app.js';
import { prisma } from '../config/database.js';
import { ExternalCache } from '../modules/external/external.cache.js';
import type { getRoute } from '../modules/external/routing.service.js';
import { getWeather } from '../modules/external/weather.service.js';

type WeatherBody = Awaited<ReturnType<typeof getWeather>>;
type RouteBody = Awaited<ReturnType<typeof getRoute>> & {
  distanceKm: number;
  durationMinutes: number;
  durationFormatted: string;
};

const weatherPath = '/weather?lat=23.0567&lng=104.9876';
const quanBaRoute = '/route?fromLat=22.8233&fromLng=104.9836&toLat=23.0567&toLng=104.9876';

function localDate(daysAhead = 0) {
  return new Date(Date.now() + 7 * 3_600_000 + daysAhead * 86_400_000).toISOString().slice(0, 10);
}

function openMeteoFixture() {
  return {
    current_weather: { temperature: 18.5, weathercode: 45, windspeed: 8.2, winddirection: 90 },
    daily: {
      time: [localDate(), localDate(1), localDate(14)],
      weathercode: [45, 80, 95],
      temperature_2m_min: [14, 15, 16],
      temperature_2m_max: [22, 23, 24],
      wind_speed_10m_max: [12, 21, 30],
    },
  };
}

function osrmFixture(distance: number, duration: number) {
  return Response.json({ code: 'Ok', routes: [{ distance, duration }] });
}

test('external cache expires entries, bounds its size and shares concurrent loads', async (t) => {
  const ttl = 1000;
  let now = Date.now();
  t.mock.method(Date, 'now', () => now);
  const cache = new ExternalCache<{ value: number }>(ttl, 2);
  let loads = 0;
  const load = async () => ({ value: ++loads });

  assert.deepEqual(await Promise.all([cache.getOrLoad('a', load), cache.getOrLoad('a', load)]), [
    { value: 1, cached: false }, { value: 1, cached: false },
  ]);
  now += ttl - 1;
  assert.deepEqual(await cache.getOrLoad('a', load), { value: 1, cached: true });
  now += 1;
  assert.deepEqual(await cache.getOrLoad('a', load), { value: 2, cached: false });
  await cache.getOrLoad('b', load);
  await cache.getOrLoad('c', load);
  assert.deepEqual(await cache.getOrLoad('a', load), { value: 5, cached: false });
});

test('external APIs over HTTP and PostgreSQL', { timeout: 120_000 }, async (t) => {
  const prefix = `ext-${randomUUID()}`;
  const userIds: string[] = [];
  const tripIds: string[] = [];
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  t.after(async () => {
    const closed = new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    server.closeAllConnections();
    try {
      await closed;
      if (tripIds.length) await prisma.trip.deleteMany({ where: { id: { in: tripIds } } });
      if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
      await prisma.$disconnect();
    }
  });

  async function api<T = Record<string, unknown>>(path: string, cookie?: string, body?: object) {
    const headers = new Headers();
    if (cookie) headers.set('Cookie', cookie);
    if (body) headers.set('Content-Type', 'application/json');
    const response = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers,
      body: body && JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    return { response, body: await response.json() as T };
  }

  async function register(suffix: string) {
    const result = await api<{ id: string }>('/api/auth/register-anonymous', undefined, { displayName: `${prefix}-${suffix}` });
    assert.equal(result.response.status, 201, JSON.stringify(result.body));
    userIds.push(result.body.id);
    const cookie = result.response.headers.getSetCookie().find((value) => value.startsWith('session_token='))?.split(';')[0];
    assert.ok(cookie);
    return { id: result.body.id, cookie };
  }

  const owner = await register('owner');
  const member = await register('member');
  const outsider = await register('outsider');
  async function createTrip(vehicle: string) {
    const result = await api<{ id: string }>('/api/trips', owner.cookie, {
      title: `${prefix}-${vehicle}`, vehicle, startDate: '2026-11-20',
    });
    assert.equal(result.response.status, 201, JSON.stringify(result.body));
    const { id } = result.body;
    tripIds.push(id);
    return id;
  }

  const tripId = await createTrip('O_TO');
  const memberRow = await prisma.tripMember.create({ data: { tripId, userId: member.id, nickname: 'Tester' } });
  const tripPath = `/api/trips/${tripId}`;
  const external = `${tripPath}/external`;
  const weatherCalls: URL[] = [];
  const routeCalls: URL[] = [];
  let respondWeather = (_url: URL): Response => Response.json(openMeteoFixture());
  let respondRoute = (url: URL, _signal?: AbortSignal | null): Response => url.pathname.endsWith('105.200000,23.100000')
    ? osrmFixture(39_300, 4500) : osrmFixture(46_200, 5400);

  const realFetch = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', async (input: string | URL, init?: RequestInit) => {
    const url = new URL(input);
    if (url.origin === base) return realFetch(input, init);
    if (url.hostname === 'api.open-meteo.com') {
      weatherCalls.push(url);
      return respondWeather(url);
    }
    if (url.hostname === 'router.project-osrm.org') {
      routeCalls.push(url);
      return respondRoute(url, init?.signal);
    }
    throw new Error(`Unexpected upstream host: ${url.hostname}`);
  });

  await t.test('Quản Bạ returns current weather and reuses the rounded-coordinate cache', async (caseTest) => {
    const first = await api(external + weatherPath, member.cookie);
    assert.equal(first.response.status, 200);
    assert.equal(first.response.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(first.body, {
      temperature: 18.5, tempMin: 14, tempMax: 22, weatherCode: 45, description: 'Sương mù đèo',
      windSpeed: 8.2, windDirection: 90, isForecast: false, provider: 'Open-Meteo', cached: false,
    });
    assert.equal(weatherCalls[0]?.pathname, '/v1/forecast');
    assert.equal(weatherCalls[0]?.searchParams.get('timezone'), 'Asia/Bangkok');
    assert.equal(weatherCalls[0]?.searchParams.get('current_weather'), 'true');
    assert.equal(weatherCalls[0]?.searchParams.get('latitude'), '23.0567');
    assert.equal(weatherCalls[0]?.searchParams.get('longitude'), '104.9876');

    const started = performance.now();
    const cachedWeather = await getWeather(23.0567, 104.9876);
    const cacheMs = performance.now() - started;
    assert.equal(cachedWeather.cached, true);
    assert.ok(cacheMs < 5, `Weather cache took ${cacheMs.toFixed(2)} ms`);

    const requestStarted = performance.now();
    const second = await api(external + weatherPath, owner.cookie);
    caseTest.diagnostic(`Weather cache: ${cacheMs.toFixed(2)} ms in process, ${(performance.now() - requestStarted).toFixed(2)} ms over HTTP`);
    assert.equal(second.response.status, 200);
    assert.deepEqual(second.body, { ...first.body, cached: true });
    const rounded = await api(external + '/weather?lat=23.0568&lng=104.9875', owner.cookie);
    assert.equal(rounded.response.status, 200);
    assert.deepEqual(rounded.body, second.body);
    assert.equal(weatherCalls.length, 1);
  });

  await t.test('returns daily values through day 14 and a current-weather notice for unavailable dates', async () => {
    const tomorrow = await api(`${external}${weatherPath}&date=${localDate(1)}`, owner.cookie);
    assert.equal(tomorrow.response.status, 200);
    assert.deepEqual(tomorrow.body, {
      temperature: 19, tempMin: 15, tempMax: 23, weatherCode: 80, description: 'Có mưa / Mưa rào',
      windSpeed: 21, isForecast: true, provider: 'Open-Meteo', cached: false,
    });
    const lastDay = await api(`${external}${weatherPath}&date=${localDate(14)}`, owner.cookie);
    assert.equal(lastDay.response.status, 200);
    assert.equal(lastDay.body.isForecast, true);
    assert.equal(lastDay.body.description, 'Dông sét / Mưa to');
    assert.equal(weatherCalls.at(-1)?.searchParams.get('forecast_days'), '15');

    for (const offset of [-1, 0, 2, 15]) {
      const result = await api<WeatherBody>(`${external}${weatherPath}&date=${localDate(offset)}`, owner.cookie);
      assert.equal(result.response.status, 200);
      assert.equal(result.body.isForecast, false);
      assert.equal(result.body.temperature, 18.5);
      assert.match(result.body.notice ?? '', /thời tiết hiện tại/);
    }
  });

  await t.test('an Open-Meteo outage returns a friendly 503 and can be retried', async () => {
    const original = respondWeather;
    respondWeather = () => new Response(null, { status: 502 });
    const path = external + '/weather?lat=22.9&lng=104.9';
    try {
      const unavailable = await api<{ error: string }>(path, owner.cookie);
      assert.equal(unavailable.response.status, 503);
      assert.match(unavailable.body.error, /Tạm thời không thể tải thời tiết/);
    } finally {
      respondWeather = original;
    }
    const recovered = await api(path, owner.cookie);
    assert.equal(recovered.response.status, 200);
    assert.equal(recovered.body.cached, false);
  });

  await t.test('OSRM returns a 46.2 km road route with cache keys per direction and vehicle', async () => {
    const path = external + quanBaRoute;
    const first = await api(path, owner.cookie);
    assert.equal(first.response.status, 200);
    assert.deepEqual(first.body, {
      distanceMeters: 46_200, distanceKm: 46.2, durationSeconds: 5400, durationMinutes: 90,
      durationFormatted: '1 giờ 30 phút', isFallback: false, cached: false,
    });
    assert.equal(routeCalls[0]?.pathname, '/route/v1/driving/104.983600,22.823300;104.987600,23.056700');
    assert.equal(routeCalls[0]?.searchParams.get('overview'), 'false');
    assert.deepEqual((await api(path + '&vehicle=O_TO', owner.cookie)).body, { ...first.body, cached: true });
    assert.equal((await api(path + '&vehicle=XE_MAY', owner.cookie)).body.cached, false);
    const reversed = await api(external + '/route?fromLat=23.0567&fromLng=104.9876&toLat=22.8233&toLng=104.9836', owner.cookie);
    assert.equal(reversed.response.status, 200);
    assert.equal(reversed.body.cached, false);
    assert.equal(routeCalls.length, 3);
  });

  await t.test('a trip with air travel defaults to motorcycle speeds for local routes', async () => {
    const airTrip = await createTrip('MAY_BAY');
    const query = '/route?fromLat=22.8&fromLng=104.98&toLat=22.9&toLng=104.99';
    const original = respondRoute;
    respondRoute = () => osrmFixture(32_000, 1800);
    try {
      const path = `/api/trips/${airTrip}/external${query}`;
      const defaultRoute = await api<RouteBody>(path, owner.cookie);
      assert.equal(defaultRoute.response.status, 200);
      assert.equal(defaultRoute.body.durationSeconds, 3600);
      assert.equal(defaultRoute.body.durationFormatted, '1 giờ');
      const carRoute = await api<RouteBody>(path + '&vehicle=O_TO', owner.cookie);
      assert.equal(carRoute.response.status, 200);
      assert.ok(carRoute.body.durationSeconds < defaultRoute.body.durationSeconds);
    } finally {
      respondRoute = original;
    }
  });

  await t.test('OSRM connection errors and unusable responses fall back to Haversine', async () => {
    const original = respondRoute;
    const basePath = external + '/route?fromLat=0&fromLng=0&toLat=0&toLng=1';
    try {
      respondRoute = () => { throw new TypeError('simulated connection failure'); };
      const first = await api<RouteBody>(basePath, owner.cookie);
      assert.equal(first.response.status, 200);
      assert.equal(first.body.isFallback, true);
      assert.equal(first.body.cached, false);
      const expectedMeters = 6_371_000 * Math.PI / 180 * 1.45;
      assert.ok(Math.abs(first.body.distanceMeters - expectedMeters) < 1);
      assert.ok(Math.abs(first.body.durationSeconds - expectedMeters * 3.6 / 32) < 1);

      respondRoute = () => Response.json({ code: 'Ok', routes: [] });
      const second = await api(basePath + '&vehicle=XE_MAY', owner.cookie);
      assert.equal(second.response.status, 200);
      assert.deepEqual(second.body, first.body);
      assert.deepEqual((await api(basePath, owner.cookie)).body, { ...first.body, cached: true });
    } finally {
      respondRoute = original;
    }
  });

  await t.test('the 5-second OSRM deadline covers the response body and leaves itinerary and expenses available', async () => {
    let onStart: (signal: AbortSignal) => void;
    const started = new Promise<AbortSignal>((resolve) => { onStart = resolve; });
    const original = respondRoute;
    respondRoute = (_url, signal) => {
      assert.ok(signal);
      onStart(signal);
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"code":"Ok",'));
          signal.addEventListener('abort', () => controller.error(signal.reason), { once: true });
        },
      }));
    };
    try {
      const pending = api(external + '/route?fromLat=0&fromLng=0&toLat=0&toLng=2', owner.cookie);
      const signal = await started;
      const core = await Promise.all([api(tripPath, owner.cookie), api(tripPath + '/expenses', owner.cookie)]);
      assert.deepEqual(core.map(({ response }) => response.status), [200, 200]);
      assert.equal(signal.aborted, false);

      const timedOut = await pending;
      assert.equal(signal.aborted, true);
      assert.equal(signal.reason.name, 'TimeoutError');
      assert.equal(timedOut.response.status, 200);
      assert.equal(timedOut.body.isFallback, true);
    } finally {
      respondRoute = original;
    }
  });

  await t.test('day summary preserves stop order, skips unmapped or deleted stops, and handles empty legs', async () => {
    const [city, pass, end] = ['city', 'pass', 'end'].map((suffix) => `${prefix}-${suffix}`);
    await prisma.stop.createMany({ data: [
      { tripId, id: end, name: 'Điểm cuối', day: 1, orderIndex: 5, latitude: 23.1, longitude: 105.2 },
      { tripId, id: pass, name: 'Cổng trời', day: 1, orderIndex: 3, latitude: 23.0567, longitude: 104.9876 },
      { tripId, id: city, name: 'TP. Hà Giang', day: 1, orderIndex: 1, latitude: 22.8233, longitude: 104.9836 },
      { tripId, name: 'Không GPS', day: 1, orderIndex: 2 },
      { tripId, name: 'Chưa có tọa độ', day: 1, orderIndex: 4, latitude: null, longitude: null },
      { tripId, name: 'Đã xóa', day: 1, orderIndex: 6, latitude: 23, longitude: 105, deletedAt: new Date() },
      { tripId, name: 'Điểm ngày hai', day: 2, orderIndex: 1, latitude: 0, longitude: 0 },
    ] });
    const callsBefore = routeCalls.length;
    const result = await api(external + '/day-route-summary?day=1', owner.cookie);
    assert.equal(result.response.status, 200);
    assert.deepEqual(result.body, {
      day: 1, totalDistanceKm: 85.5, totalDurationFormatted: '2 giờ 45 phút',
      mappedStopsCount: 3, unmappedStopsCount: 2,
      legs: [
        { fromStopId: city, toStopId: pass, distanceKm: 46.2, durationFormatted: '1 giờ 30 phút' },
        { fromStopId: pass, toStopId: end, distanceKm: 39.3, durationFormatted: '1 giờ 15 phút' },
      ],
    });
    assert.equal(routeCalls.length, callsBefore + 1);
    const second = await api(external + '/day-route-summary?day=2', owner.cookie);
    assert.equal(second.response.status, 200);
    assert.deepEqual(second.body, {
      day: 2, totalDistanceKm: 0, totalDurationFormatted: '0 phút',
      mappedStopsCount: 1, unmappedStopsCount: 0, legs: [],
    });
    assert.equal(routeCalls.length, callsBefore + 1);
  });

  await t.test('every endpoint requires a valid session and membership even for cache hits', async () => {
    await prisma.tripMember.update({ where: { id: memberRow.id }, data: { status: 'REVOKED', revokedAt: new Date() } });
    const callsBefore = weatherCalls.length + routeCalls.length;
    for (const path of [weatherPath, quanBaRoute, '/day-route-summary?day=1']) {
      assert.equal((await api(external + path)).response.status, 401);
      assert.equal((await api(external + path, `session_token=${'a'.repeat(64)}`)).response.status, 401);
      assert.equal((await api(external + path, outsider.cookie)).response.status, 403);
      assert.equal((await api(external + path, member.cookie)).response.status, 403);
    }
    assert.equal(weatherCalls.length + routeCalls.length, callsBefore);
  });

  await t.test('invalid coordinates, dates, days and vehicles are rejected before reaching providers', async () => {
    const callsBefore = weatherCalls.length + routeCalls.length;
    for (const path of [
      '/weather?lat=90.1&lng=105', '/weather?lat=23&lng=-181', '/weather?lat=%20&lng=105',
      '/weather?lat=23&lat=24&lng=105', '/weather?lat=0x17&lng=105',
      weatherPath + '&date=2026-02-30', weatherPath + '&date=2026-1-2',
      '/route?fromLat=23&fromLng=105&toLat=-90.1&toLng=104', quanBaRoute + '&vehicle=MAY_BAY',
      '/day-route-summary?day=1.5', '/day-route-summary?day=-1', '/day-route-summary',
    ]) {
      assert.equal((await api(external + path, owner.cookie)).response.status, 400, path);
    }
    assert.equal(weatherCalls.length + routeCalls.length, callsBefore);
  });
});
