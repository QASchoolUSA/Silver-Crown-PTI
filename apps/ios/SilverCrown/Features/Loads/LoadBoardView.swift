import SwiftUI

struct LoadBoardView: View {
    let profile: AppUser
    let companyWide: Bool
    @StateObject private var repo = LoadsRepository()
    @State private var query = ""
    @State private var equipmentFilter = "All"
    @State private var boardMode: BoardMode = .list
    @State private var selectedLoad: Load?
    @State private var mapDetailLoad: Load?
    @Environment(\.horizontalSizeClass) private var sizeClass

    private let equipmentOptions = ["All", "Dry Van", "Reefer", "Flatbed"]

    enum BoardMode: String, CaseIterable, Identifiable {
        case list, map
        var id: String { rawValue }
        var title: String { rawValue.capitalized }
    }

    private var filtered: [Load] {
        repo.loads.filter { load in
            let matchesEquipment = equipmentFilter == "All" || load.type == equipmentFilter
            let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            let matchesQuery = q.isEmpty
                || load.origin.lowercased().contains(q)
                || load.destination.lowercased().contains(q)
                || (load.loadRef?.lowercased().contains(q) ?? false)
                || (load.assignedDriverName?.lowercased().contains(q) ?? false)
            return matchesEquipment && matchesQuery
        }
    }

    var body: some View {
        Group {
            if sizeClass == .regular {
                padLayout
            } else {
                phoneLayout
            }
        }
        .background(ThemeColor.surface.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text(companyWide ? "ALL LOADS" : "LOAD BOARD")
                    .font(SCFont.sectionTitle)
                    .foregroundStyle(ThemeColor.primary)
                    .tracking(1.5)
            }
            ToolbarItem(placement: .primaryAction) {
                HStack(spacing: Spacing.sm) {
                    Picker("Mode", selection: $boardMode) {
                        ForEach(BoardMode.allCases) { mode in
                            Text(mode.title).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 140)
                    if companyWide {
                        NavigationLink {
                            NewLoadView(profile: profile)
                        } label: {
                            Image(systemName: "plus.circle.fill")
                                .foregroundStyle(ThemeColor.primary)
                        }
                    }
                }
            }
        }
        .searchable(text: $query, prompt: "Search loads")
        .onAppear {
            if companyWide {
                repo.subscribeCompany(companyId: profile.companyId)
            } else {
                repo.subscribeDriver(companyId: profile.companyId, driverId: profile.id)
            }
        }
        .onDisappear { repo.stop() }
    }

    private var phoneLayout: some View {
        VStack(spacing: 0) {
            filterStrip
                .padding(.horizontal, Spacing.lg)
                .padding(.vertical, Spacing.sm)
            if boardMode == .map {
                FleetMapView(loads: filtered.filter(LoadMapGeometry.hasMapCoords)) { load in
                    mapDetailLoad = load
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                loadList
            }
        }
        .navigationDestination(item: $mapDetailLoad) { load in
            LoadDetailView(load: load)
        }
    }

    private var padLayout: some View {
        HStack(spacing: 0) {
            VStack(spacing: 0) {
                filterStrip
                    .padding(Spacing.md)
                if boardMode == .map {
                    FleetMapView(loads: filtered.filter(LoadMapGeometry.hasMapCoords)) { load in
                        selectedLoad = load
                    }
                } else {
                    loadList
                }
            }
            .frame(minWidth: LayoutMetrics.listColumnMin, idealWidth: 380, maxWidth: 420)

            Divider()

            Group {
                if let selectedLoad {
                    LoadDetailView(load: selectedLoad)
                } else if let first = filtered.first, boardMode == .list {
                    LoadDetailView(load: first)
                        .onAppear { selectedLoad = first }
                } else {
                    SCEmptyState(
                        title: "Select a load",
                        systemImage: "truck.box",
                        description: boardMode == .map
                            ? "Tap a pin to open the load."
                            : "Choose a load from the list."
                    )
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private var filterStrip: some View {
        SCFilterBar {
            Picker("Equipment", selection: $equipmentFilter) {
                ForEach(equipmentOptions, id: \.self) { Text($0).tag($0) }
            }
            .pickerStyle(.segmented)
        }
    }

    private var loadList: some View {
        ScrollView {
            LazyVStack(spacing: Spacing.md) {
                if filtered.isEmpty {
                    SCEmptyState(
                        title: "No loads",
                        systemImage: "truck.box",
                        description: companyWide ? "Create a load or adjust filters." : "No loads assigned yet."
                    )
                    .padding(.top, Spacing.xxl)
                } else {
                    ForEach(Array(filtered.enumerated()), id: \.element.id) { index, load in
                        Group {
                            if sizeClass == .regular {
                                Button {
                                    selectedLoad = load
                                } label: {
                                    LoadRowView(load: load, showDriver: companyWide, selected: selectedLoad?.id == load.id)
                                }
                                .buttonStyle(.plain)
                            } else {
                                NavigationLink {
                                    LoadDetailView(load: load)
                                } label: {
                                    LoadRowView(load: load, showDriver: companyWide)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .scAppearFade(delay: Double(min(index, 8)) * 0.04)
                    }
                }
            }
            .padding(Spacing.lg)
        }
    }
}

struct LoadRowView: View {
    let load: Load
    var showDriver: Bool = false
    var selected: Bool = false

    var body: some View {
        SCCard {
            VStack(alignment: .leading, spacing: Spacing.md) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("\(load.origin) → \(load.destination)")
                            .font(SCFont.headline)
                            .foregroundStyle(ThemeColor.onSurface)
                            .multilineTextAlignment(.leading)
                        if let ref = load.loadRef, !ref.isEmpty {
                            Text("Ref \(ref)")
                                .font(SCFont.caption)
                                .foregroundStyle(ThemeColor.onSurfaceVariant)
                        }
                    }
                    Spacer(minLength: Spacing.sm)
                    SCStatusChip(
                        text: load.status.replacingOccurrences(of: "_", with: " "),
                        color: ThemeColor.loadStatus(load.status)
                    )
                }
                HStack(spacing: Spacing.sm) {
                    SCStatusChip(text: load.type, color: ThemeColor.primary)
                    Text("$\(load.payout)")
                        .font(SCFont.captionBold)
                        .foregroundStyle(ThemeColor.onSurface)
                    Text("\(load.miles) mi")
                        .font(SCFont.caption)
                        .foregroundStyle(ThemeColor.onSurfaceVariant)
                    Spacer()
                    if LoadMapGeometry.hasMapCoords(load) {
                        Image(systemName: "map.fill")
                            .font(.caption)
                            .foregroundStyle(ThemeColor.primary.opacity(0.8))
                    }
                }
                if showDriver, let name = load.assignedDriverName {
                    Text(name)
                        .font(SCFont.caption)
                        .foregroundStyle(ThemeColor.onSurfaceVariant)
                }
            }
        }
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(selected ? ThemeColor.primary : .clear, lineWidth: 2)
        )
    }
}

struct LoadDetailView: View {
    let load: Load
    @State private var weather: RouteWeather?
    @State private var weatherError: String?
    @State private var weatherLoading = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                VStack(alignment: .leading, spacing: Spacing.sm) {
                    Text("\(load.origin) → \(load.destination)")
                        .font(SCFont.sectionTitle)
                        .foregroundStyle(ThemeColor.onSurface)
                        .tracking(1)
                    HStack(spacing: Spacing.sm) {
                        SCStatusChip(
                            text: load.status.replacingOccurrences(of: "_", with: " "),
                            color: ThemeColor.loadStatus(load.status)
                        )
                        SCStatusChip(text: load.type, color: ThemeColor.primary)
                    }
                }

                RouteMapView(load: load, interactive: true, height: LayoutMetrics.mapHeroHeight)

                if LoadMapGeometry.hasMapCoords(load),
                   let o = load.originCoords,
                   let d = load.destCoords {
                    HStack(spacing: Spacing.md) {
                        Link(destination: appleMapsURL(from: o, to: d)) {
                            Label("Apple Maps", systemImage: "map")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(SCSecondaryButtonStyle())
                        Link(destination: googleMapsURL(from: o, to: d)) {
                            Label("Google Maps", systemImage: "globe")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(SCSecondaryButtonStyle())
                    }
                }

                SCCard {
                    VStack(alignment: .leading, spacing: Spacing.md) {
                        Text("DETAILS")
                            .font(SCFont.captionBold)
                            .foregroundStyle(ThemeColor.onSurfaceVariant)
                            .tracking(1)
                        detailRow("Payout", "$\(load.payout)")
                        detailRow("Miles", load.miles)
                        if let broker = load.broker { detailRow("Broker", broker) }
                        if let ref = load.loadRef { detailRow("Ref", ref) }
                        if let driver = load.assignedDriverName { detailRow("Driver", driver) }
                        if !load.stops.isEmpty {
                            Divider().overlay(ThemeColor.outlineVariant)
                            ForEach(load.stops) { stop in
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(stop.type.capitalized)
                                        .font(SCFont.captionBold)
                                        .foregroundStyle(ThemeColor.primary)
                                    Text(stop.address)
                                        .font(SCFont.subheadline)
                                        .foregroundStyle(ThemeColor.onSurface)
                                }
                            }
                        }
                    }
                }

                SCCard {
                    VStack(alignment: .leading, spacing: Spacing.md) {
                        Text("ROUTE WEATHER")
                            .font(SCFont.captionBold)
                            .foregroundStyle(ThemeColor.onSurfaceVariant)
                            .tracking(1)
                        if weatherLoading {
                            ProgressView("Loading forecast…")
                        } else if let weather {
                            WeatherLocationRow(weather: weather.origin)
                            WeatherLocationRow(weather: weather.destination)
                        } else if let weatherError {
                            Text(weatherError)
                                .font(SCFont.caption)
                                .foregroundStyle(ThemeColor.onSurfaceVariant)
                        } else {
                            Text("Weather unavailable for this load.")
                                .font(SCFont.caption)
                                .foregroundStyle(ThemeColor.onSurfaceVariant)
                        }
                    }
                }
            }
            .padding(Spacing.lg)
            .scAppearFade()
        }
        .background(ThemeColor.surface.ignoresSafeArea())
        .navigationTitle("Load")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: load.id) {
            await loadWeather()
        }
    }

    private func detailRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label)
                .font(SCFont.caption)
                .foregroundStyle(ThemeColor.onSurfaceVariant)
            Spacer()
            Text(value)
                .font(SCFont.subheadline)
                .foregroundStyle(ThemeColor.onSurface)
        }
    }

    private func loadWeather() async {
        guard let o = load.originCoords, let d = load.destCoords else {
            weatherError = "No coordinates for weather."
            return
        }
        weatherLoading = true
        weatherError = nil
        defer { weatherLoading = false }
        do {
            weather = try await LoadsRepository.fetchRouteWeather(
                origin: o,
                destination: d,
                originLabel: load.origin,
                destLabel: load.destination
            )
        } catch {
            weatherError = error.localizedDescription
        }
    }

    private func appleMapsURL(from: Coords, to: Coords) -> URL {
        URL(string: "http://maps.apple.com/?saddr=\(from.latitude),\(from.longitude)&daddr=\(to.latitude),\(to.longitude)")!
    }

    private func googleMapsURL(from: Coords, to: Coords) -> URL {
        URL(string: "https://www.google.com/maps/dir/?api=1&origin=\(from.latitude),\(from.longitude)&destination=\(to.latitude),\(to.longitude)")!
    }
}

struct WeatherLocationRow: View {
    let weather: LocationWeather

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(weather.label)
                    .font(SCFont.subheadline)
                    .fontWeight(.semibold)
                    .foregroundStyle(ThemeColor.onSurface)
                Spacer()
                if !weather.alerts.isEmpty {
                    SCStatusChip(text: "Alert", color: ThemeColor.error)
                } else if weather.hasAdverseConditions {
                    SCStatusChip(text: "Caution", color: ThemeColor.caution)
                }
            }
            if weather.available, let period = weather.periods.first {
                Text("\(period.temperature)°\(period.temperatureUnit) · \(period.shortForecast)")
                    .font(SCFont.caption)
                    .foregroundStyle(ThemeColor.onSurfaceVariant)
                Text(period.windSpeed)
                    .font(SCFont.caption)
                    .foregroundStyle(ThemeColor.onSurfaceVariant)
            } else {
                Text("Forecast not available.")
                    .font(SCFont.caption)
                    .foregroundStyle(ThemeColor.onSurfaceVariant)
            }
            ForEach(weather.alerts.prefix(2)) { alert in
                Text("\(alert.event): \(alert.headline)")
                    .font(SCFont.caption)
                    .foregroundStyle(ThemeColor.error)
            }
        }
        .padding(.vertical, 2)
    }
}

struct NewLoadView: View {
    let profile: AppUser
    @Environment(\.dismiss) private var dismiss
    @State private var origin = ""
    @State private var destination = ""
    @State private var payout = ""
    @State private var miles = ""
    @State private var type = "Dry Van"
    @State private var drivers: [AppUser] = []
    @State private var selectedDriverId: String?
    @State private var error: String?
    @State private var busy = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                Text("NEW LOAD")
                    .font(SCFont.sectionTitle)
                    .foregroundStyle(ThemeColor.primary)
                    .tracking(1.5)

                SCCard {
                    VStack(alignment: .leading, spacing: Spacing.md) {
                        TextField("Origin address", text: $origin)
                            .textFieldStyle(SCFieldStyle())
                        TextField("Destination address", text: $destination)
                            .textFieldStyle(SCFieldStyle())
                    }
                }

                SCCard {
                    VStack(alignment: .leading, spacing: Spacing.md) {
                        TextField("Payout", text: $payout)
                            .keyboardType(.decimalPad)
                            .textFieldStyle(SCFieldStyle())
                        TextField("Miles", text: $miles)
                            .keyboardType(.decimalPad)
                            .textFieldStyle(SCFieldStyle())
                        Picker("Equipment", selection: $type) {
                            ForEach(["Dry Van", "Reefer", "Flatbed"], id: \.self) { Text($0).tag($0) }
                        }
                        .pickerStyle(.segmented)
                    }
                }

                SCCard {
                    Picker("Driver", selection: $selectedDriverId) {
                        Text("Unassigned").tag(String?.none)
                        ForEach(drivers) { d in
                            Text(d.displayName).tag(Optional(d.id))
                        }
                    }
                }

                if let error {
                    Text(error).font(SCFont.caption).foregroundStyle(ThemeColor.error)
                }

                Button(busy ? "Creating…" : "Create Load") {
                    Task { await create() }
                }
                .buttonStyle(SCPrimaryButtonStyle())
                .disabled(busy)
            }
            .padding(Spacing.lg)
        }
        .background(ThemeColor.surface.ignoresSafeArea())
        .navigationTitle("New Load")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            drivers = (try? await LoadsRepository.fetchCompanyDrivers(companyId: profile.companyId)) ?? []
        }
    }

    private func create() async {
        busy = true
        error = nil
        defer { busy = false }
        do {
            let originCoords = try await LoadsRepository.geocodeAddress(origin)
            let destCoords = try await LoadsRepository.geocodeAddress(destination)
            let driver = drivers.first { $0.id == selectedDriverId }
            try await LoadsRepository().createLoad(
                companyId: profile.companyId,
                origin: origin,
                destination: destination,
                payout: payout,
                miles: miles,
                type: type,
                assignedDriverId: driver?.id,
                assignedDriverName: driver?.displayName,
                originCoords: originCoords,
                destCoords: destCoords
            )
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
    }
}
