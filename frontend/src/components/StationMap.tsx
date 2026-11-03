import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';

/**
 * OpenStreetMap raster tiles, rendered directly in React.
 * The OSM website blocks iframe embedding in some browsers (frame headers).
 * Map tiles are image resources, so they do not require iframe permission.
 */
export function coordinatesValid(latitude: string | number, longitude: string | number): boolean {
  const lat = Number(latitude), lon = Number(longitude);
  return latitude !== '' && longitude !== '' && Number.isFinite(lat) && Number.isFinite(lon)
    && Math.abs(lat) <= 85 && Math.abs(lon) <= 180;
}
export function stationDirections(latitude: string | number, longitude: string | number): string {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(Number(latitude) + ',' + Number(longitude));
}
const TILE = 256;
const clampLat = (lat: number) => Math.max(-85.0511, Math.min(85.0511, lat));
function toWorld(lat: number, lng: number, zoom: number) {
  const world = TILE * 2 ** zoom;
  const rad = clampLat(lat) * Math.PI / 180;
  return {
    x: (lng + 180) / 360 * world,
    y: (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * world,
  };
}
function fromWorld(x: number, y: number, zoom: number) {
  const world = TILE * 2 ** zoom;
  const lng = ((x % world + world) % world) / world * 360 - 180;
  const n = Math.PI * (1 - 2 * Math.max(0, Math.min(world, y)) / world);
  const lat = 180 / Math.PI * Math.atan(Math.sinh(n));
  return { lat, lng };
}
export function StationMap({ latitude, longitude, name, compact = false }: {
  latitude: string | number; longitude: string | number; name: string; compact?: boolean;
}) {
  const lat = Number(latitude), lng = Number(longitude);
  const [zoom, setZoom] = useState(compact ? 15 : 14);
  const [center, setCenter] = useState({ lat, lng });
  const pointer = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => { setCenter({ lat, lng }); }, [lat, lng]);
  const tiles = useMemo(() => {
    const p = toWorld(center.lat, center.lng, zoom);
    const x0 = Math.floor(p.x / TILE), y0 = Math.floor(p.y / TILE);
    const n = 2 ** zoom;
    const radius = compact ? 1 : 2;
    const output: { x: number; y: number; left: number; top: number; key: string }[] = [];
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = x0 + dx, y = y0 + dy;
        if (y < 0 || y >= n) continue;
        output.push({
          x: (x % n + n) % n, y,
          left: x * TILE - p.x, top: y * TILE - p.y,
          key: x + ':' + y,
        });
      }
    }
    return output;
  }, [center, zoom, compact]);
  if (!coordinatesValid(latitude, longitude)) {
    return <div className="flex h-full w-full items-center justify-center bg-slate-100 p-5 text-center text-sm text-slate-500">Điểm thuê chưa có tọa độ hợp lệ.</div>;
  }
  const anchor = toWorld(lat, lng, zoom), mapCenter = toWorld(center.lat, center.lng, zoom);
  function endDrag(e: PointerEvent<HTMLDivElement>) {
    if (!pointer.current || compact) return;
    const dx = e.clientX - pointer.current.x, dy = e.clientY - pointer.current.y;
    pointer.current = null;
    if (Math.abs(dx) + Math.abs(dy) > 3) setCenter(fromWorld(mapCenter.x - dx, mapCenter.y - dy, zoom));
  }
  return <div
    role="region"
    aria-label={'Bản đồ ' + name}
    className={'relative h-full w-full overflow-hidden bg-[#e3eee9] ' + (compact ? '' : 'cursor-grab touch-none active:cursor-grabbing')}
    onPointerDown={compact ? undefined : e => { if (e.button !== 0) return; pointer.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); }}
    onPointerUp={endDrag}
    onPointerCancel={() => { pointer.current = null; }}
  >
    {tiles.map(tile => <img
      key={zoom + ':' + tile.key}
      src={'https://tile.openstreetmap.org/' + zoom + '/' + tile.x + '/' + tile.y + '.png'}
      alt=""
      draggable={false}
      loading="lazy"
      decoding="async"
      className="pointer-events-none absolute h-64 w-64 max-w-none select-none"
      style={{ left: 'calc(50% + ' + tile.left + 'px)', top: 'calc(50% + ' + tile.top + 'px)' }}
    />)}
    <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full drop-shadow-lg" style={{ left: 'calc(50% + ' + (anchor.x - mapCenter.x) + 'px)', top: 'calc(50% + ' + (anchor.y - mapCenter.y) + 'px)' }}>
      <div className="flex h-11 w-9 items-center justify-center rounded-t-full rounded-bl-full rounded-br-md bg-emerald-700 text-2xl text-white ring-2 ring-white">⌖</div>
      <div className="mx-auto h-2 w-2 rounded-full bg-emerald-800/50" />
    </div>
    {!compact && <div className="absolute right-4 top-4 z-20 flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
      <button type="button" aria-label="Phóng to bản đồ" className="px-4 py-2.5 text-xl font-bold text-slate-800 hover:bg-slate-50" onPointerDown={e=>e.stopPropagation()} onClick={() => setZoom(z => Math.min(18, z+1))}>+</button>
      <button type="button" aria-label="Thu nhỏ bản đồ" className="border-t px-4 py-2.5 text-xl font-bold text-slate-800 hover:bg-slate-50" onPointerDown={e=>e.stopPropagation()} onClick={() => setZoom(z => Math.max(11, z-1))}>−</button>
      <button type="button" aria-label="Về vị trí trạm" className="border-t px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-slate-50" onPointerDown={e=>e.stopPropagation()} onClick={() => setCenter({lat,lng})}>⌖</button>
    </div>}
    <div className="absolute bottom-1 right-1 z-20 rounded bg-white/90 px-2 py-0.5 text-[10px] text-slate-700">
      © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">OpenStreetMap</a> contributors
    </div>
  </div>;
}
