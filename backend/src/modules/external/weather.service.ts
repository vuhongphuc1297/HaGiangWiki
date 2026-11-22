import { z } from 'zod';
import { HttpError } from '../../utils/httpError.js';
import { ExternalCache } from './external.cache.js';
import { fetchExternalJson } from './external.fetch.js';

const TIMEZONE = 'Asia/Bangkok';
const DAY_MS = 86_400_000;
const MAX_FORECAST_DAYS_AHEAD = 14;
const localDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});

const readings = z.array(z.number().nullable());
const currentWeather = z.object({
  temperature: z.number(),
  weathercode: z.number().int(),
  windspeed: z.number().nonnegative(),
  winddirection: z.number().optional(),
});
const dailyWeather = z.object({
  time: z.array(z.iso.date()),
  weathercode: z.array(z.number().int().nullable()).optional(),
  weather_code: z.array(z.number().int().nullable()).optional(),
  temperature_2m_min: readings,
  temperature_2m_max: readings,
  wind_speed_10m_max: z.array(z.number().nonnegative().nullable()).optional(),
});
const weatherPayload = z.object({
  current_weather: z.unknown(),
  daily: z.unknown(),
});

const descriptions = new Map<number, string>([
  [0, 'Trời quang / Nắng'],
  ...[1, 2, 3].map((code): [number, string] => [code, 'Có mây / Nắng nhẹ']),
  ...[45, 48].map((code): [number, string] => [code, 'Sương mù đèo']),
  ...[51, 53, 55, 61, 63, 65, 80, 81, 82].map((code): [number, string] => [code, 'Có mưa / Mưa rào']),
  ...[95, 96, 99].map((code): [number, string] => [code, 'Dông sét / Mưa to']),
]);

interface Weather {
  temperature: number;
  tempMin: number | null;
  tempMax: number | null;
  weatherCode: number;
  description: string;
  windSpeed: number | null;
  windDirection?: number;
  isForecast: boolean;
  provider: 'Open-Meteo';
  notice?: string;
}

const cache = new ExternalCache<Weather>(30 * 60_000);

function describeWeather(code: number) {
  return descriptions.get(code) ?? 'Chưa có mô tả thời tiết.';
}

export function getWeather(lat: number, lng: number, date?: string) {
  const today = localDay.format();
  const startOfToday = Date.parse(`${today}T00:00:00+07:00`);
  const daysAhead = date ? (Date.parse(`${date}T00:00:00+07:00`) - startOfToday) / DAY_MS : 0;
  const wantsForecast = daysAhead > 0 && daysAhead <= MAX_FORECAST_DAYS_AHEAD;
  const key = `weather:${lat.toFixed(2)}:${lng.toFixed(2)}:${date ?? 'current'}`;

  // Refresh today's temperatures and the forecast flag at local midnight.
  const nextDay = startOfToday + DAY_MS;
  return cache.getOrLoad(key, async () => {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.search = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      current_weather: 'true',
      daily: 'weathercode,temperature_2m_max,temperature_2m_min,wind_speed_10m_max',
      timezone: TIMEZONE,
      forecast_days: String(wantsForecast ? daysAhead + 1 : 1),
    }).toString();

    try {
      const payload = weatherPayload.parse(await fetchExternalJson(url));
      const daily = dailyWeather.safeParse(payload.daily).data;
      const forecastIndex = wantsForecast && date && daily ? daily.time.indexOf(date) : -1;
      const tempMin = daily?.temperature_2m_min[forecastIndex];
      const tempMax = daily?.temperature_2m_max[forecastIndex];
      const forecastCode = (daily?.weathercode ?? daily?.weather_code)?.[forecastIndex];
      if (tempMin != null && tempMax != null && forecastCode != null) {
        return {
          temperature: Math.round((tempMin + tempMax) * 5) / 10,
          tempMin, tempMax, weatherCode: forecastCode, description: describeWeather(forecastCode),
          windSpeed: daily?.wind_speed_10m_max?.[forecastIndex] ?? null,
          isForecast: true, provider: 'Open-Meteo',
        };
      }

      const current = currentWeather.parse(payload.current_weather);
      const todayIndex = daily?.time.indexOf(today) ?? -1;
      return {
        temperature: current.temperature,
        tempMin: daily?.temperature_2m_min[todayIndex] ?? null,
        tempMax: daily?.temperature_2m_max[todayIndex] ?? null,
        weatherCode: current.weathercode,
        description: describeWeather(current.weathercode),
        windSpeed: current.windspeed,
        windDirection: current.winddirection,
        isForecast: false,
        provider: 'Open-Meteo',
        ...(date && { notice: date === today
          ? 'Đang hiển thị thời tiết hiện tại.'
          : 'Chưa có dự báo cho ngày đã chọn. Đang hiển thị thời tiết hiện tại.' }),
      };
    } catch {
      throw new HttpError(503, 'Tạm thời không thể tải thời tiết. Vui lòng thử lại sau.');
    }
  }, nextDay);
}
