import L from 'leaflet';
import type { Coords, Load, LoadStop } from '@silver-crown/shared';
import { getOrderedStops, getRoutePolyline } from '@silver-crown/shared';

export const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

export const MAP_ATTRIBUTION =
  '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export function toLatLng(coords: Coords): [number, number] {
  return [coords.latitude, coords.longitude];
}

export function makeDotIcon(color: string, borderColor: string, size = 14) {
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid ${borderColor};box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export const pickupIcon = makeDotIcon('#bdc8d2', '#e4e1e7');
export const dropoffIcon = makeDotIcon('#89ceff', '#00344d');
export const originIcon = pickupIcon;
export const destIcon = dropoffIcon;

export const ROUTE_COLORS = {
  available: '#89ceff',
  in_transit: '#fbbf24',
} as const;

export function stopsToLatLngs(stops: LoadStop[]): [number, number][] {
  return getOrderedStops({ stops }).map((s) => toLatLng(s.coords));
}

export function collectRoutePoints(loads: Load[]): [number, number][] {
  const points: [number, number][] = [];
  for (const load of loads) {
    const polyline = getRoutePolyline(load);
    for (const coord of polyline) {
      points.push(toLatLng(coord));
    }
  }
  return points;
}

export function hasMapCoords(load: Load): boolean {
  return getRoutePolyline(load).length >= 2;
}

export function getStopIcon(stop: LoadStop) {
  return stop.type === 'pickup' ? pickupIcon : dropoffIcon;
}
