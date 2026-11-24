import { useEffect, useState } from 'react';
import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSun, Sun } from 'lucide-react';
import { api } from '../../services/api';
import type { Stop, WeatherReading } from '../../types/api';
import { tripDate } from '../../utils/format';
import { loadExternal, readExternal } from './external-cache';
import { hasCoordinates } from './useDayRoutes';

const weatherTtlMs = 30 * 60_000;
const localDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
});
const weatherNumber = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });

function weatherIcon(code: number) {
  if (code === 0) return Sun;
  if (code === 1 || code === 2) return CloudSun;
  if (code === 45 || code === 48) return CloudFog;
  if (code >= 95) return CloudLightning;
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return CloudRain;
  return Cloud;
}

export function WeatherWidget({ tripId, startDate, stop, isDemo, compact = false }: {
  tripId: string;
  startDate: string;
  stop?: Stop;
  isDemo: boolean;
  compact?: boolean;
}) {
  const date = stop && stop.day > 0 ? tripDate(startDate, stop.day).toISOString().slice(0, 10) : undefined;
  const today = localDay.format();
  let path: string | undefined;
  if (!isDemo && stop && hasCoordinates(stop)) {
    const params = new URLSearchParams({ lat: String(stop.latitude), lng: String(stop.longitude) });
    if (date) params.set('date', date);
    path = `/trips/${tripId}/external/weather?${params}`;
  }
  const key = path ? `${today}:${path}` : undefined;
  const [result, setResult] = useState<{ key: string; weather: WeatherReading | null }>();
  const weather = key ? readExternal<WeatherReading>(key) ?? (result?.key === key ? result.weather : undefined) : null;

  useEffect(() => {
    if (!path || !key) return;
    let active = true;
    const refresh = () => {
      void loadExternal(key, weatherTtlMs, () => api<WeatherReading>(path, { timeoutMs: 8500 })).then(
        (value) => { if (active) setResult({ key, weather: value }); },
        () => { if (active) setResult({ key, weather: null }); },
      );
    };
    refresh();
    window.addEventListener('online', refresh);
    return () => {
      active = false;
      window.removeEventListener('online', refresh);
    };
  }, [key, path]);

  const Icon = weather ? weatherIcon(weather.weatherCode) : CloudSun;
  const forecastDate = date ? date.slice(5).split('-').reverse().join('/') : '';

  return <section aria-label="Thời tiết tại điểm dừng" aria-live="polite" className={compact
    ? 'rounded-btn border border-border-main/70 bg-bg-page px-2.5 py-2 text-xs'
    : 'rounded-card border border-border-main bg-surface px-3 py-2.5 text-xs'}>
    <div className="flex items-start gap-2">
      <Icon className={compact ? 'mt-0.5 size-4 shrink-0 text-accent' : 'mt-0.5 size-5 shrink-0 text-accent'} aria-hidden="true" />
      <div className="min-w-0 space-y-0.5">
        {weather ? <>
          <span className="block font-semibold text-accent">{weather.isForecast ? `Dự báo ngày ${forecastDate}` : 'Thời tiết hiện tại'}</span>
          {!compact && <span className="block break-words text-text-muted">{stop?.name}</span>}
          <span className="flex flex-wrap items-baseline gap-x-2">
            <strong className={compact ? 'text-base text-text-main' : 'font-serif text-lg leading-tight text-text-main'}>{weatherNumber.format(weather.temperature)}°C</strong>
            <span className="text-text-main">{weather.description}</span>
          </span>
          {(weather.tempMin != null && weather.tempMax != null || weather.windSpeed != null) && <span className="flex flex-wrap gap-x-2 text-text-muted">
            {weather.tempMin != null && weather.tempMax != null && <span>{weatherNumber.format(weather.tempMin)}° – {weatherNumber.format(weather.tempMax)}°C</span>}
            {weather.windSpeed != null && <span>{weather.isForecast ? 'Gió tối đa' : 'Gió'} {weatherNumber.format(weather.windSpeed)} km/h</span>}
          </span>}
          {weather.notice && date !== today && <span className="block text-text-muted">{weather.notice}</span>}
        </> : <>
          <span className="block font-semibold text-accent">Thời tiết vùng cao</span>
          <span className="block text-text-muted">{isDemo ? 'Tạo chuyến đi để xem thời tiết tại điểm dừng.' :
            weather === undefined ? 'Đang tải thời tiết…' : 'Chưa có dữ liệu thời tiết.'}</span>
        </>}
      </div>
    </div>
  </section>;
}
