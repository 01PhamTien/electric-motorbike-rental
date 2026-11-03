import { useEffect, useRef, useState } from 'react';
import { Map, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';

setWorkerUrl(workerUrl);

/** Maps are loaded from OpenFreeMap vector tiles instead of the blocked OSM raster domain. */
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

export function coordinatesValid(latitude: string | number, longitude: string | number): boolean {
  const lat = Number(latitude), lon = Number(longitude);
  return latitude !== '' && longitude !== '' && Number.isFinite(lat) && Number.isFinite(lon)
    && Math.abs(lat) <= 85 && Math.abs(lon) <= 180;
}
export function stationDirections(latitude: string | number, longitude: string | number): string {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(Number(latitude) + ',' + Number(longitude));
}

export function StationMap({ latitude, longitude, name, compact = false }: {
  latitude: string | number; longitude: string | number; name: string; compact?: boolean;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(!compact);
  const [unavailable, setUnavailable] = useState(false);
  const lat = Number(latitude), lng = Number(longitude);
  const valid = coordinatesValid(latitude, longitude);

  // Only instantiate preview maps when near the viewport: avoid dozens of WebGL
  // contexts and unnecessary tile downloads on long station lists.
  useEffect(() => {
    if (!compact || !host.current) return;
    const el = host.current;
    if (!('IntersectionObserver' in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => {
      setVisible(entries.some(entry => entry.isIntersecting));
    }, { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [compact]);

  useEffect(() => {
    if (!valid || !visible || !host.current) return;
    const container = host.current;
    let map: Map | null = null;
    let marker: Marker | null = null;
    let failures = 0;
    let didRender = false;
    setUnavailable(false);
    const timeout = window.setTimeout(() => { if (!didRender) setUnavailable(true); }, 14000);
    try {
      map = new Map({
        container,
        style: STYLE_URL,
        center: [lng, lat],
        zoom: compact ? 14 : 14.5,
        attributionControl: true,
        interactive: !compact,
        pitchWithRotate: false,
        dragRotate: false,
        maxZoom: 18,
        minZoom: 9,
      });
      const pin = document.createElement('div');
      pin.className = 'flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-white bg-emerald-700 text-xl text-white shadow-xl';
      pin.textContent = '⌖';
      pin.title = name;
      marker = new Marker({ element: pin, anchor: 'bottom' }).setLngLat([lng, lat]).addTo(map);
      if (!compact) map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
      map.on('idle', () => { didRender = true; window.clearTimeout(timeout); });
      map.on('error', () => {
        failures++;
        if (failures >= 3) {
          window.clearTimeout(timeout);
          setUnavailable(true);
        }
      });
    } catch {
      window.clearTimeout(timeout);
      setUnavailable(true);
    }
    return () => {
      window.clearTimeout(timeout);
      marker?.remove();
      map?.remove();
    };
  }, [valid, visible, compact, lat, lng, name]);

  if (!valid) {
    return <div className="flex h-full w-full items-center justify-center bg-slate-100 p-5 text-center text-sm text-slate-500">Điểm thuê chưa có tọa độ hợp lệ.</div>;
  }

  return <div className="relative h-full w-full overflow-hidden bg-[#e1eee8]">
    <div ref={host} className="absolute inset-0" aria-label={'Bản đồ ' + name} role="region" />
    {!visible && <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-emerald-50 to-sky-100 text-center text-sm text-emerald-800">
      <span>📍 {name}</span>
    </div>}
    {unavailable && <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-emerald-50 via-white to-sky-100 px-4 text-center">
      <span className="text-4xl" aria-hidden="true">📍</span>
      <strong className="text-sm font-extrabold text-emerald-900">{name}</strong>
      <p className="max-w-xs text-xs leading-5 text-slate-600">Mạng hiện không tải được bản đồ trực tuyến. Vị trí trạm vẫn được lưu chính xác theo tọa độ bên dưới.</p>
      <span className="rounded-lg bg-white px-3 py-2 font-mono text-xs text-slate-700 shadow-sm">{lat.toFixed(5)}, {lng.toFixed(5)}</span>
      <a href={stationDirections(lat, lng)} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-emerald-800 px-4 py-2 text-xs font-bold text-white">Mở trên Google Maps ↗</a>
    </div>}
  </div>;
}
