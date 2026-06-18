import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Coords } from '@silver-crown/shared';
import 'leaflet/dist/leaflet.css';

const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

function toLatLng(coords: Coords): [number, number] {
  return [coords.latitude, coords.longitude];
}

function makeDotIcon(color: string, borderColor: string) {
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid ${borderColor};box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

const originIcon = makeDotIcon('#bdc8d2', '#e4e1e7');
const destIcon = makeDotIcon('#89ceff', '#00344d');

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length < 2) return;
    map.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom: 10 });
  }, [map, points]);

  return null;
}

interface LoadRouteMapProps {
  originCoords?: Coords;
  destCoords?: Coords;
  height?: string;
  interactive?: boolean;
  className?: string;
}

export default function LoadRouteMap({
  originCoords,
  destCoords,
  height = '200px',
  interactive = true,
  className = '',
}: LoadRouteMapProps) {
  if (!originCoords || !destCoords) {
    return (
      <div
        className={`flex items-center justify-center bg-surface-container-high text-on-surface-variant text-xs uppercase tracking-wider ${className}`}
        style={{ height }}
      >
        Map unavailable
      </div>
    );
  }

  const origin = toLatLng(originCoords);
  const dest = toLatLng(destCoords);
  const center: [number, number] = [(origin[0] + dest[0]) / 2, (origin[1] + dest[1]) / 2];

  return (
    <div className={`overflow-hidden ${className}`} style={{ height }}>
      <MapContainer
        center={center}
        zoom={5}
        style={{ height: '100%', width: '100%' }}
        zoomControl={interactive}
        dragging={interactive}
        scrollWheelZoom={interactive}
        doubleClickZoom={interactive}
        touchZoom={interactive}
        attributionControl={interactive}
      >
        <TileLayer url={DARK_TILES} attribution='&copy; <a href="https://carto.com/">CARTO</a>' />
        <FitBounds points={[origin, dest]} />
        <Marker position={origin} icon={originIcon} />
        <Marker position={dest} icon={destIcon} />
        <Polyline positions={[origin, dest]} pathOptions={{ color: '#89ceff', weight: 3, opacity: 0.9 }} />
      </MapContainer>
    </div>
  );
}
