import { useEffect, Fragment } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import { Link } from 'react-router';
import L from 'leaflet';
import type { Load } from '@silver-crown/shared';
import {
  DARK_TILES,
  toLatLng,
  originIcon,
  destIcon,
  ROUTE_COLORS,
  collectRoutePoints,
  hasMapCoords,
} from '../lib/mapUtils';
import 'leaflet/dist/leaflet.css';

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) {
      map.setView([39.8283, -98.5795], 4);
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], 8);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 6 });
  }, [map, points]);

  return null;
}

function statusLabel(status: Load['status']) {
  if (status === 'in_transit') return 'In Transit';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

interface ActiveLoadsMapProps {
  loads: Load[];
  height?: string;
}

export default function ActiveLoadsMap({ loads, height = '420px' }: ActiveLoadsMapProps) {
  const mappableLoads = loads.filter(hasMapCoords);
  const points = collectRoutePoints(mappableLoads);

  if (loads.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-surface-container-high border border-outline-variant rounded-lg text-on-surface-variant text-sm"
        style={{ height }}
      >
        No active loads to display
      </div>
    );
  }

  if (mappableLoads.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-surface-container-high border border-outline-variant rounded-lg text-on-surface-variant text-sm"
        style={{ height }}
      >
        Active loads have no map coordinates
      </div>
    );
  }

  const defaultCenter: [number, number] = points[0] ?? [39.8283, -98.5795];

  return (
    <div className="rounded-lg overflow-hidden border border-outline-variant">
      <div style={{ height }}>
        <MapContainer
          center={defaultCenter}
          zoom={4}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer url={DARK_TILES} attribution='&copy; <a href="https://carto.com/">CARTO</a>' />
          <FitBounds points={points} />

          {mappableLoads.map((load) => {
            const origin = toLatLng(load.originCoords!);
            const dest = toLatLng(load.destCoords!);
            const routeColor = ROUTE_COLORS[load.status as keyof typeof ROUTE_COLORS] ?? ROUTE_COLORS.available;

            const popup = (
              <Popup>
                <div className="text-sm min-w-[160px]">
                  <p className="font-bold uppercase tracking-wide">
                    {load.origin} → {load.destination}
                  </p>
                  <p className="text-xs mt-1 opacity-70">
                    {statusLabel(load.status)} · {load.type}
                  </p>
                  <p className="text-xs opacity-70">
                    {load.assignedDriverName || 'Unassigned'} · ${load.payout}
                  </p>
                  <Link
                    to={`/loads/${load.id}`}
                    className="inline-block mt-2 text-[#00344d] text-xs font-bold uppercase tracking-wider hover:underline"
                  >
                    View load →
                  </Link>
                </div>
              </Popup>
            );

            return (
              <Fragment key={load.id}>
                <Polyline
                  positions={[origin, dest]}
                  pathOptions={{ color: routeColor, weight: 3, opacity: 0.85 }}
                />
                <Marker position={origin} icon={originIcon}>
                  {popup}
                </Marker>
                <Marker position={dest} icon={destIcon}>
                  {popup}
                </Marker>
              </Fragment>
            );
          })}
        </MapContainer>
      </div>

      <div className="flex flex-wrap items-center gap-4 px-4 py-2 bg-surface-container-high text-xs text-on-surface-variant">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-on-surface-variant" />
          Origin
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-primary" />
          Destination
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-primary rounded" />
          Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-amber-400 rounded" />
          In Transit
        </span>
        <span className="ml-auto">{mappableLoads.length} load{mappableLoads.length !== 1 ? 's' : ''} on map</span>
      </div>
    </div>
  );
}
