import L from 'leaflet';
import type { Coords } from '@silver-crown/shared';

export const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

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

export const originIcon = makeDotIcon('#bdc8d2', '#e4e1e7');
export const destIcon = makeDotIcon('#89ceff', '#00344d');

export const ROUTE_COLORS = {
  available: '#89ceff',
  in_transit: '#fbbf24',
} as const;

export function collectRoutePoints(
  loads: { originCoords?: Coords; destCoords?: Coords }[]
): [number, number][] {
  const points: [number, number][] = [];
  for (const load of loads) {
    if (load.originCoords) points.push(toLatLng(load.originCoords));
    if (load.destCoords) points.push(toLatLng(load.destCoords));
  }
  return points;
}

export function hasMapCoords(load: { originCoords?: Coords; destCoords?: Coords }) {
  return Boolean(load.originCoords && load.destCoords);
}
