/**
 * Embeds OpenStreetMap without an API key or extra frontend dependencies.
 * Markers use existing stored station coordinates, never geocoded guesses.
 */
export function coordinatesValid(latitude: string | number, longitude: string | number): boolean {
  const lat = Number(latitude), lon = Number(longitude);
  return latitude !== '' && longitude !== '' && Number.isFinite(lat) && Number.isFinite(lon)
    && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}
export function stationMapEmbed(latitude: string | number, longitude: string | number, spread = 0.006): string {
  const lat = Number(latitude), lon = Number(longitude);
  const bbox = [lon - spread, lat - spread, lon + spread, lat + spread].map(x => x.toFixed(6)).join(',');
  const params = new URLSearchParams({ bbox, layer: 'mapnik', marker: lat.toFixed(7) + ',' + lon.toFixed(7) });
  return 'https://www.openstreetmap.org/export/embed.html?' + params.toString();
}
export function stationDirections(latitude: string | number, longitude: string | number): string {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(Number(latitude) + ',' + Number(longitude));
}
export function StationMap({ latitude, longitude, name, compact = false }: {
  latitude: string | number; longitude: string | number; name: string; compact?: boolean;
}) {
  if (!coordinatesValid(latitude, longitude)) {
    return <div className="flex h-full w-full items-center justify-center bg-slate-100 p-5 text-center text-sm text-slate-500">Điểm thuê chưa có tọa độ bản đồ hợp lệ.</div>;
  }
  return <iframe
    title={'Bản đồ ' + name}
    src={stationMapEmbed(latitude, longitude, compact ? 0.0025 : 0.012)}
    loading="lazy"
    referrerPolicy="no-referrer"
    className="h-full w-full border-0"
    allowFullScreen
  />;
}
