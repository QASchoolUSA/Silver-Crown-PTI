import SwiftUI
import MapKit

enum LoadMapGeometry {
    static func routeCoordinates(for load: Load) -> [CLLocationCoordinate2D] {
        if !load.stops.isEmpty {
            return load.stops
                .sorted { $0.sequence < $1.sequence }
                .map { CLLocationCoordinate2D(latitude: $0.coords.latitude, longitude: $0.coords.longitude) }
        }
        var points: [CLLocationCoordinate2D] = []
        if let o = load.originCoords {
            points.append(CLLocationCoordinate2D(latitude: o.latitude, longitude: o.longitude))
        }
        if let d = load.destCoords {
            points.append(CLLocationCoordinate2D(latitude: d.latitude, longitude: d.longitude))
        }
        return points
    }

    static func hasMapCoords(_ load: Load) -> Bool {
        routeCoordinates(for: load).count >= 2
    }

    static func region(fitting coordinates: [CLLocationCoordinate2D], paddingFactor: Double = 1.4) -> MKCoordinateRegion {
        guard let first = coordinates.first else {
            return MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: 39.8283, longitude: -98.5795),
                span: MKCoordinateSpan(latitudeDelta: 30, longitudeDelta: 30)
            )
        }
        guard coordinates.count > 1 else {
            return MKCoordinateRegion(center: first, span: MKCoordinateSpan(latitudeDelta: 0.5, longitudeDelta: 0.5))
        }
        var minLat = first.latitude
        var maxLat = first.latitude
        var minLon = first.longitude
        var maxLon = first.longitude
        for c in coordinates.dropFirst() {
            minLat = min(minLat, c.latitude)
            maxLat = max(maxLat, c.latitude)
            minLon = min(minLon, c.longitude)
            maxLon = max(maxLon, c.longitude)
        }
        let center = CLLocationCoordinate2D(
            latitude: (minLat + maxLat) / 2,
            longitude: (minLon + maxLon) / 2
        )
        let latDelta = max((maxLat - minLat) * paddingFactor, 0.35)
        let lonDelta = max((maxLon - minLon) * paddingFactor, 0.35)
        return MKCoordinateRegion(center: center, span: MKCoordinateSpan(latitudeDelta: latDelta, longitudeDelta: lonDelta))
    }
}

struct RouteMapView: View {
    let load: Load
    var interactive: Bool = true
    var height: CGFloat = LayoutMetrics.mapHeroHeight

    @State private var position: MapCameraPosition = .automatic
    @State private var appeared = false

    private var coordinates: [CLLocationCoordinate2D] {
        LoadMapGeometry.routeCoordinates(for: load)
    }

    var body: some View {
        Group {
            if coordinates.count < 2 {
                ZStack {
                    ThemeColor.surfaceContainerHigh
                    VStack(spacing: Spacing.sm) {
                        Image(systemName: "map")
                            .font(.title2)
                            .foregroundStyle(ThemeColor.onSurfaceVariant)
                        Text("Map unavailable")
                            .font(SCFont.caption)
                            .foregroundStyle(ThemeColor.onSurfaceVariant)
                    }
                }
            } else {
                Map(position: $position, interactionModes: interactive ? .all : []) {
                    ForEach(Array(coordinates.enumerated()), id: \.offset) { index, coord in
                        Annotation(index == 0 ? "Pickup" : (index == coordinates.count - 1 ? "Dropoff" : "Stop"), coordinate: coord) {
                            Circle()
                                .fill(index == 0 ? ThemeColor.onSurfaceVariant : ThemeColor.primary)
                                .frame(width: 12, height: 12)
                                .overlay(Circle().stroke(ThemeColor.onSurface, lineWidth: 2))
                        }
                    }
                    MapPolyline(coordinates: coordinates)
                        .stroke(ThemeColor.loadStatus(load.status), lineWidth: 3)
                }
                .mapStyle(.standard(elevation: .flat))
                .disabled(!interactive)
                .opacity(appeared ? 1 : 0)
                .onAppear {
                    position = .region(LoadMapGeometry.region(fitting: coordinates))
                    withAnimation(.easeOut(duration: 0.45)) { appeared = true }
                }
            }
        }
        .frame(height: height)
        .clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(ThemeColor.outlineVariant.opacity(0.5), lineWidth: 1)
        )
    }
}

struct FleetMapPin: Identifiable {
    let id: String
    let load: Load
    let coordinate: CLLocationCoordinate2D
}

struct FleetMapView: View {
    let loads: [Load]
    var onSelect: ((Load) -> Void)?

    @State private var position: MapCameraPosition = .automatic
    @State private var selectedId: String?
    @State private var appeared = false

    private var pins: [FleetMapPin] {
        loads.compactMap { load in
            let coords = LoadMapGeometry.routeCoordinates(for: load)
            guard let first = coords.first else { return nil }
            return FleetMapPin(id: load.id, load: load, coordinate: first)
        }
    }

    var body: some View {
        Group {
            if pins.isEmpty {
                SCEmptyState(
                    title: "No mappable loads",
                    systemImage: "map",
                    description: "Loads need origin and destination coordinates to appear on the map."
                )
                .frame(maxHeight: .infinity)
                .background(ThemeColor.surfaceContainerLow)
            } else {
                Map(position: $position) {
                    ForEach(pins) { pin in
                        Annotation(
                            "\(pin.load.origin) → \(pin.load.destination)",
                            coordinate: pin.coordinate
                        ) {
                            Button {
                                selectedId = pin.id
                                onSelect?(pin.load)
                            } label: {
                                Image(systemName: "truck.box.fill")
                                    .font(.caption.bold())
                                    .foregroundStyle(ThemeColor.onPrimary)
                                    .padding(8)
                                    .background(ThemeColor.loadStatus(pin.load.status))
                                    .clipShape(Circle())
                                    .overlay {
                                        Circle()
                                            .stroke(selectedId == pin.id ? ThemeColor.onSurface : .clear, lineWidth: 2)
                                    }
                                    .shadow(radius: 2, y: 1)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .mapStyle(.standard(elevation: .realistic))
                .opacity(appeared ? 1 : 0)
                .onAppear {
                    let all = pins.map(\.coordinate)
                    position = .region(LoadMapGeometry.region(fitting: all, paddingFactor: 1.6))
                    withAnimation(.easeOut(duration: 0.45)) { appeared = true }
                }
                .safeAreaInset(edge: .bottom) {
                    if let selectedId, let pin = pins.first(where: { $0.id == selectedId }) {
                        Button {
                            onSelect?(pin.load)
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("\(pin.load.origin) → \(pin.load.destination)")
                                    .font(SCFont.headline)
                                    .foregroundStyle(ThemeColor.onSurface)
                                HStack(spacing: Spacing.sm) {
                                    SCStatusChip(
                                        text: pin.load.status.replacingOccurrences(of: "_", with: " "),
                                        color: ThemeColor.loadStatus(pin.load.status)
                                    )
                                    Text("$\(pin.load.payout)")
                                        .font(SCFont.caption)
                                        .foregroundStyle(ThemeColor.onSurfaceVariant)
                                    Text("\(pin.load.miles) mi")
                                        .font(SCFont.caption)
                                        .foregroundStyle(ThemeColor.onSurfaceVariant)
                                }
                            }
                            .padding(Spacing.lg)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(.ultraThinMaterial)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }
}
