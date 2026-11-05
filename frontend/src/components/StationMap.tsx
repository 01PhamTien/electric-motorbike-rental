import { useEffect, useRef, useState } from 'react';
import { LngLatBounds, Map, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';

setWorkerUrl(workerUrl);
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

export type StationMapPoint = { id: number; latitude: string | number; longitude: string | number; name: string; kind?: 'station' | 'vehicle' };
export type UserMapLocation = { latitude: number; longitude: number };

export function coordinatesValid(latitude: string | number, longitude: string | number): boolean {
  const lat = Number(latitude), lon = Number(longitude);
  return latitude !== '' && longitude !== '' && Number.isFinite(lat) && Number.isFinite(lon)
    && Math.abs(lat) <= 85 && Math.abs(lon) <= 180;
}
export function stationDirections(latitude: string | number, longitude: string | number): string {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(Number(latitude) + ',' + Number(longitude));
}

export function StationMap({ latitude, longitude, name, compact = false, points, userLocation, onMarkerClick }: {
  latitude?: string | number; longitude?: string | number; name?: string; compact?: boolean;
  points?: StationMapPoint[]; userLocation?: UserMapLocation | null; onMarkerClick?: (id: number) => void;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(!compact);
  const [unavailable, setUnavailable] = useState(false);
  const valid = points?.length ? points.some(p => coordinatesValid(p.latitude, p.longitude))
    : latitude !== undefined && longitude !== undefined && coordinatesValid(latitude, longitude);
  const fallbackLat = Number(latitude), fallbackLng = Number(longitude);

  useEffect(() => {
    if (!compact || !host.current) return;
    const el = host.current;
    if (!('IntersectionObserver' in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => setVisible(entries.some(entry => entry.isIntersecting)), { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [compact]);

  useEffect(() => {
    if (!valid || !visible || !host.current) return;
    const container = host.current;
    let map: Map | null = null;
    const markers: Marker[] = [];
    let failures = 0;
    let didRender = false;
    setUnavailable(false);
    const timeout = window.setTimeout(() => { if (!didRender) setUnavailable(true); }, 14000);
    try {
      map = new Map({
        container, style: STYLE_URL,
        center: [fallbackLng || 108.22, fallbackLat || 16.06],
        zoom: compact ? 14 : 12.5,
        attributionControl: { compact: true },
        interactive: !compact,
        pitchWithRotate: false, dragRotate: false, maxZoom: 18, minZoom: 9,
      });
      const bounds = new LngLatBounds();
      const validPoints = (points ?? (latitude !== undefined && longitude !== undefined ? [{ id: 0, latitude, longitude, name: name ?? 'Điểm nhận xe' }] : []))
        .filter(point => coordinatesValid(point.latitude, point.longitude));
      for (const point of validPoints) {
        const lat = Number(point.latitude), lng = Number(point.longitude);
        const isVehicle = point.kind === 'vehicle';
        const pin = document.createElement('button');
        pin.type = 'button';
        pin.className = isVehicle
          ? 'flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-white bg-sky-600 text-sm font-bold text-white shadow-xl transition hover:scale-110'
          : 'flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-white bg-emerald-700 text-lg font-bold text-white shadow-xl transition hover:scale-110';
        pin.textContent = isVehicle ? '⚡' : '⌖';
        pin.title = point.name;
        pin.setAttribute('aria-label', 'Chọn ' + point.name);
        if (!compact) pin.addEventListener('click', () => {
          onMarkerClick?.(point.id);
          map?.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 14), duration: 450 });
        });
        markers.push(new Marker({ element: pin, anchor: 'bottom' }).setLngLat([lng, lat]).addTo(map));
        bounds.extend([lng, lat]);
      }
      if (userLocation && coordinatesValid(userLocation.latitude, userLocation.longitude)) {
        const userPin = document.createElement('div');
        userPin.className = 'flex h-7 w-7 items-center justify-center rounded-full border-[4px] border-white bg-sky-500 shadow-xl';
        userPin.innerHTML = '<span class="block h-2 w-2 rounded-full bg-white"></span>';
        userPin.title = 'Vị trí hiện tại của bạn';
        markers.push(new Marker({ element: userPin, anchor: 'center' }).setLngLat([userLocation.longitude, userLocation.latitude]).addTo(map));
        bounds.extend([userLocation.longitude, userLocation.latitude]);
      }
      if (!compact) map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
      map.on('load', () => {
        if (bounds.isEmpty()) return;
        if (validPoints.length + (userLocation ? 1 : 0) > 1) map?.fitBounds(bounds, { padding: 72, maxZoom: 14, duration: 500 });
        else map?.easeTo({ center: bounds.getCenter(), zoom: 14 });
      });
      map.on('idle', () => { didRender = true; window.clearTimeout(timeout); });
      map.on('error', () => {
        failures++;
        if (failures >= 3) { window.clearTimeout(timeout); setUnavailable(true); }
      });
    } catch {
      window.clearTimeout(timeout);
      setUnavailable(true);
    }
    return () => {
      window.clearTimeout(timeout);
      markers.forEach(marker => marker.remove());
      map?.remove();
    };
  }, [valid, visible, compact, latitude, longitude, name, points, userLocation, onMarkerClick]);

  if (!valid) return <div className="flex h-full w-full items-center justify-center bg-slate-100 p-5 text-center text-sm text-slate-500">Điểm thuê chưa có tọa độ hợp lệ.</div>;

  return <div className="relative h-full w-full overflow-hidden bg-[#e1eee8]">
    <div ref={host} className="absolute inset-0" aria-label={points?.length ? 'Bản đồ trạm và xe điện' : 'Bản đồ ' + (name ?? 'điểm nhận xe')} role="region" />
    {!visible && <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-emerald-50 to-sky-100 text-center text-sm text-emerald-800"><span>📍 {name}</span></div>}
    {unavailable && <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-emerald-50 via-white to-sky-100 px-4 text-center">
      <span className="text-4xl" aria-hidden="true">📍</span>
      <strong className="text-sm font-extrabold text-emerald-900">{points?.length ? points.length + ' vị trí trạm và xe' : name}</strong>
      <p className="max-w-xs text-xs leading-5 text-slate-600">Mạng hiện không tải được bản đồ trực tuyến. Bạn vẫn có thể chọn trạm trong danh sách và mở chỉ đường.</p>
      {!points?.length && <span className="rounded-lg bg-white px-3 py-2 font-mono text-xs text-slate-700 shadow-sm">{fallbackLat.toFixed(5)}, {fallbackLng.toFixed(5)}</span>}
      {!points?.length && <a href={stationDirections(fallbackLat, fallbackLng)} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-emerald-800 px-4 py-2 text-xs font-bold text-white">Mở trên Google Maps ↗</a>}
    </div>}
  </div>;
}
