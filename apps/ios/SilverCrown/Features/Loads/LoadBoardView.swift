import SwiftUI

struct LoadBoardView: View {
    let profile: AppUser
    let companyWide: Bool
    @StateObject private var repo = LoadsRepository()
    @State private var query = ""
    @State private var equipmentFilter = "All"
    @Environment(\.horizontalSizeClass) private var sizeClass

    private let equipmentOptions = ["All", "Dry Van", "Reefer", "Flatbed"]

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
                NavigationSplitView {
                    loadList
                } detail: {
                    ContentUnavailableView("Select a load", systemImage: "truck.box")
                }
            } else {
                loadList
            }
        }
        .navigationTitle(companyWide ? "All Loads" : "Load Board")
        .searchable(text: $query, prompt: "Search loads")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                if companyWide {
                    NavigationLink {
                        NewLoadView(profile: profile)
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
        }
        .onAppear {
            if companyWide {
                repo.subscribeCompany(companyId: profile.companyId)
            } else {
                repo.subscribeDriver(companyId: profile.companyId, driverId: profile.id)
            }
        }
        .onDisappear { repo.stop() }
    }

    private var loadList: some View {
        List {
            Picker("Equipment", selection: $equipmentFilter) {
                ForEach(equipmentOptions, id: \.self) { Text($0).tag($0) }
            }
            .pickerStyle(.segmented)
            .listRowBackground(Color.clear)

            if filtered.isEmpty {
                ContentUnavailableView(
                    "No loads",
                    systemImage: "truck.box",
                    description: Text(companyWide ? "Create a load or adjust filters." : "No loads assigned yet.")
                )
            } else {
                ForEach(filtered) { load in
                    NavigationLink {
                        LoadDetailView(load: load)
                    } label: {
                        LoadRowView(load: load, showDriver: companyWide)
                    }
                }
            }
        }
    }
}

struct LoadRowView: View {
    let load: Load
    var showDriver: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("\(load.origin) → \(load.destination)")
                .font(.headline)
                .foregroundStyle(ThemeColor.onSurface)
            HStack(spacing: 12) {
                Text(load.type).font(.caption)
                Text("$\(load.payout)").font(.caption)
                Text("\(load.miles) mi").font(.caption)
                Text(load.status.replacingOccurrences(of: "_", with: " ").capitalized)
                    .font(.caption2)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(ThemeColor.surfaceContainerHigh)
                    .clipShape(Capsule())
            }
            .foregroundStyle(ThemeColor.onSurfaceVariant)
            if showDriver, let name = load.assignedDriverName {
                Text(name).font(.caption2).foregroundStyle(ThemeColor.onSurfaceVariant)
            }
        }
        .padding(.vertical, 4)
    }
}

struct LoadDetailView: View {
    let load: Load
    @State private var weather: RouteWeather?
    @State private var weatherError: String?
    @State private var weatherLoading = false

    var body: some View {
        List {
            Section("Route") {
                LabeledContent("Origin", value: load.origin)
                LabeledContent("Destination", value: load.destination)
                if !load.stops.isEmpty {
                    ForEach(load.stops) { stop in
                        VStack(alignment: .leading) {
                            Text(stop.type.capitalized).font(.caption).foregroundStyle(ThemeColor.primary)
                            Text(stop.address)
                        }
                    }
                }
            }
            Section("Details") {
                LabeledContent("Status", value: load.status.replacingOccurrences(of: "_", with: " ").capitalized)
                LabeledContent("Equipment", value: load.type)
                LabeledContent("Payout", value: "$\(load.payout)")
                LabeledContent("Miles", value: load.miles)
                if let broker = load.broker { LabeledContent("Broker", value: broker) }
                if let ref = load.loadRef { LabeledContent("Ref", value: ref) }
                if let driver = load.assignedDriverName { LabeledContent("Driver", value: driver) }
            }
            Section("Route weather") {
                if weatherLoading {
                    ProgressView("Loading forecast…")
                } else if let weather {
                    WeatherLocationRow(weather: weather.origin)
                    WeatherLocationRow(weather: weather.destination)
                } else if let weatherError {
                    Text(weatherError).foregroundStyle(ThemeColor.onSurfaceVariant)
                } else {
                    Text("Weather unavailable for this load.")
                        .foregroundStyle(ThemeColor.onSurfaceVariant)
                }
            }
            Section("Maps") {
                if let o = load.originCoords, let d = load.destCoords {
                    Link("Open in Apple Maps", destination: appleMapsURL(from: o, to: d))
                    Link("Open in Google Maps", destination: googleMapsURL(from: o, to: d))
                } else {
                    Text("No coordinates for map links.")
                        .foregroundStyle(ThemeColor.onSurfaceVariant)
                }
            }
        }
        .navigationTitle("Load")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: load.id) {
            await loadWeather()
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
                    .font(.subheadline.weight(.semibold))
                Spacer()
                if !weather.alerts.isEmpty {
                    Text("Alert")
                        .font(.caption2.bold())
                        .foregroundStyle(ThemeColor.error)
                } else if weather.hasAdverseConditions {
                    Text("Caution")
                        .font(.caption2.bold())
                        .foregroundStyle(.orange)
                }
            }
            if weather.available, let period = weather.periods.first {
                Text("\(period.temperature)°\(period.temperatureUnit) · \(period.shortForecast)")
                    .font(.caption)
                    .foregroundStyle(ThemeColor.onSurfaceVariant)
                Text(period.windSpeed)
                    .font(.caption2)
                    .foregroundStyle(ThemeColor.onSurfaceVariant)
            } else {
                Text("Forecast not available.")
                    .font(.caption)
                    .foregroundStyle(ThemeColor.onSurfaceVariant)
            }
            ForEach(weather.alerts.prefix(2)) { alert in
                Text("\(alert.event): \(alert.headline)")
                    .font(.caption2)
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
        Form {
            Section("Route") {
                TextField("Origin address", text: $origin)
                TextField("Destination address", text: $destination)
            }
            Section("Rate") {
                TextField("Payout", text: $payout).keyboardType(.decimalPad)
                TextField("Miles", text: $miles).keyboardType(.decimalPad)
                Picker("Equipment", selection: $type) {
                    ForEach(["Dry Van", "Reefer", "Flatbed"], id: \.self) { Text($0).tag($0) }
                }
            }
            Section("Assign driver") {
                Picker("Driver", selection: $selectedDriverId) {
                    Text("Unassigned").tag(String?.none)
                    ForEach(drivers) { d in
                        Text(d.displayName).tag(Optional(d.id))
                    }
                }
            }
            if let error {
                Section { Text(error).foregroundStyle(ThemeColor.error) }
            }
        }
        .navigationTitle("New Load")
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Create") { Task { await create() } }
                    .disabled(busy)
            }
        }
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
