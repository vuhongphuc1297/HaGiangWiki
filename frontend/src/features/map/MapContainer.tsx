import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './map.css';
import type { Stop } from '../../types/api';

export type MapStop = {
  stop: Stop;
  position: L.LatLngTuple;
  number: string;
};

const defaultCenter: L.LatLngTuple = [23.15, 105.15];
const defaultZoom = 10;
const dayColors = ['#78716C', '#A94D2C', '#28523B', '#D97706'] as const;
const extraDayColors = ['#315D76', '#745B73', '#58623D', '#81564B'] as const;

function markerColor(day: number) {
  return dayColors[day] ?? extraDayColors[(day - dayColors.length) % extraDayColors.length] ?? dayColors[0];
}

function popupContent({ stop, number }: MapStop, onSelectStop: (stop: Stop) => void) {
  const content = L.DomUtil.create('div', 'trip-map-popup');
  const title = L.DomUtil.create('h2', 'trip-map-popup-title', content);
  title.setAttribute('aria-label', `${number} · ${stop.name}`);
  const badge = L.DomUtil.create('span', 'trip-map-popup-number', title);
  badge.textContent = number;
  const name = L.DomUtil.create('span', '', title);
  name.textContent = stop.name;

  const time = [stop.arriveTime, stop.leaveTime].filter(Boolean).join(' – ');
  const details = L.DomUtil.create('p', 'trip-map-popup-details', content);
  details.textContent = [stop.day === 0 ? 'Kho tạm' : `Ngày ${stop.day}`, time].filter(Boolean).join(' · ');

  if (stop.notes) {
    const notes = L.DomUtil.create('p', 'trip-map-popup-notes', content);
    notes.textContent = stop.notes;
    L.DomEvent.disableScrollPropagation(notes);
  }

  const button = L.DomUtil.create('button', 'trip-map-popup-action', content);
  button.type = 'button';
  button.textContent = 'Xem trong lịch trình';
  button.onclick = () => onSelectStop(stop);
  return content;
}

export function MapContainer({ points, activeDay, onSelectStop }: {
  points: MapStop[];
  activeDay: number | null;
  onSelectStop: (stop: Stop) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const framedPoints = useRef<string | null>(null);
  const [tilesUnavailable, setTilesUnavailable] = useState(false);

  useEffect(() => {
    const element = container.current;
    if (!element) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const instance = L.map(element, {
      zoomControl: false, center: defaultCenter, zoom: defaultZoom,
      fadeAnimation: !reduceMotion, zoomAnimation: !reduceMotion, markerZoomAnimation: !reduceMotion,
    });
    map.current = instance;
    L.control.zoom({ position: 'topright', zoomInTitle: 'Phóng to', zoomOutTitle: 'Thu nhỏ' }).addTo(instance);
    instance.attributionControl.setPrefix(false);

    const tiles = L.tileLayer('https://tile.openstreetmap.de/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · <a href="https://openstreetmap.de/germanstyle/">FOSSGIS</a>',
    });
    tiles.on('tileerror', () => {
      if (!element.querySelector('.leaflet-tile-loaded')) setTilesUnavailable(true);
    });
    tiles.on('tileload', () => setTilesUnavailable(false));
    tiles.addTo(instance);

    const observer = new ResizeObserver(() => instance.invalidateSize({ pan: false, debounceMoveend: true }));
    observer.observe(element);

    return () => {
      observer.disconnect();
      tiles.off();
      instance.remove();
      map.current = null;
      framedPoints.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;

    const markers = L.layerGroup().addTo(instance);
    for (const point of points) {
      const { stop, number, position } = point;
      const disc = L.DomUtil.create('span', 'trip-map-pin-disc');
      disc.textContent = number;
      disc.style.backgroundColor = markerColor(stop.day);
      if (stop.day === 3) disc.classList.add('trip-map-pin-disc-dark-text');
      const icon = L.divIcon({
        className: 'trip-map-pin',
        html: disc,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
        popupAnchor: [0, -16],
      });
      const marker = L.marker(position, { icon }).addTo(markers);
      marker.getElement()?.setAttribute('aria-label', `${number} · ${stop.name} · ${stop.day === 0 ? 'Kho tạm' : `Ngày ${stop.day}`}`);
      marker.bindPopup(() => popupContent(point, onSelectStop), { maxWidth: 260, autoPanPadding: [12, 20] });
    }

    const positions = points.map(({ position }) => position);
    const frame = JSON.stringify([activeDay, positions]);
    if (framedPoints.current !== frame) {
      const animate = framedPoints.current !== null && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      framedPoints.current = frame;
      instance.stop();
      if (positions.length) {
        instance.fitBounds(L.latLngBounds(positions), {
          padding: [50, 50],
          // Keep edge markers clear of the zoom buttons.
          paddingTopLeft: positions.length > 1 ? [50, Math.max(50, Math.min(120, instance.getSize().y / 3))] : undefined,
          maxZoom: 14,
          animate,
        });
      } else instance.setView(defaultCenter, defaultZoom, { animate });
    }

    return () => { markers.clearLayers(); markers.remove(); };
  }, [activeDay, points, onSelectStop]);

  return <div className="relative isolate min-h-0 flex-1">
    <div ref={container} className="trip-map absolute inset-0" aria-label="Bản đồ tương tác các điểm dừng" role="region" />
    <div className="pointer-events-none absolute left-3 right-16 top-3 z-[500] space-y-2 text-sm font-medium">
      {points.length === 0 && <p role="status" className="w-fit rounded-btn border border-border-main bg-surface px-3 py-2 shadow-sm">
        {activeDay === null ? 'Chuyến đi chưa có điểm dừng có tọa độ.' : 'Chưa có điểm dừng có tọa độ trong mục này.'}
      </p>}
      {tilesUnavailable && <p role="status" className="w-fit rounded-btn border border-border-main bg-surface px-3 py-2 shadow-sm">Chưa tải được nền bản đồ.</p>}
    </div>
  </div>;
}
