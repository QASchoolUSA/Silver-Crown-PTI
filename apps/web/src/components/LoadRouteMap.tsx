import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Coords, LoadStop } from '@silver-crown/shared';
import { getOrderedStops, getRoutePolyline } from '@silver-crown/shared';
import {
  DARK_TILES,
  MAP_ATTRIBUTION,
  toLatLng,
  getStopIcon,
  pickupIcon,
  dropoffIcon,
} from '../lib/mapUtils';
import 'leaflet/dist/leaflet.css';

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 10);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom: 10 });
  }, [map, points]);

  return null;
}

interface LoadRouteMapProps {
  stops?: LoadStop[];
  originCoords?: Coords;
  destCoords?: Coords;
  height?: string;
  interactive?: boolean;
  className?: string;
  routeColor?: string;
}

export default function LoadRouteMap({
  stops,
  originCoords,
  destCoords,
  height = '200px',
  interactive = true,
  className = '',
  routeColor = '#89ceff',
}: LoadRouteMapProps) {
  const polyline = stops?.length
    ? getOrderedStops({ stops }).map((s) => s.coords)
    : getRoutePolyline({ stops, originCoords, destCoords });

  if (polyline.length < 2) {
    return (
      <div
        className={`flex items-center justify-center bg-surface-container-high text-on-surface-variant text-xs uppercase tracking-wider ${className}`}
        style={{ height }}
      >
        Map unavailable
      </div>
    );
  }

  const latLngs = polyline.map(toLatLng);
  const orderedStops = stops?.length
    ? getOrderedStops({ stops })
    : [
        { type: 'pickup' as const, address: 'Origin', coords: polyline[0], sequence: 0 },
        { type: 'dropoff' as const, address: 'Destination', coords: polyline[polyline.length - 1], sequence: 0 },
      ];

  const center: [number, number] = [
    (latLngs[0][0] + latLngs[latLngs.length - 1][0]) / 2,
    (latLngs[0][1] + latLngs[latLngs.length - 1][1]) / 2,
  ];

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
        <TileLayer url={DARK_TILES} attribution={MAP_ATTRIBUTION} />
        <FitBounds points={latLngs} />
        {orderedStops.map((stop, index) => (
          <Marker
            key={`${stop.type}-${stop.sequence}-${index}`}
            position={toLatLng(stop.coords)}
            icon={stops?.length ? getStopIcon(stop) : stop.type === 'pickup' ? pickupIcon : dropoffIcon}
          />
        ))}
        <Polyline positions={latLngs} pathOptions={{ color: routeColor, weight: 3, opacity: 0.9 }} />
      </MapContainer>
    </div>
  );
}
