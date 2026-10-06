import SwiftUI

struct MaintenanceListView: View {
    let profile: AppUser
    @StateObject private var repo = MaintenanceRepository()
    @State private var unitFilter: UnitFilter = .all
    @State private var search = ""
    @State private var selected: MaintenanceLog?
    @Environment(\.horizontalSizeClass) private var sizeClass

    enum UnitFilter: String, CaseIterable, Identifiable {
        case all, truck, trailer
        var id: String { rawValue }
        var title: String {
            switch self {
            case .all: return "All"
            case .truck: return "Trucks"
            case .trailer: return "Trailers"
            }
        }
    }

    private var filtered: [MaintenanceLog] {
        repo.logs.filter { log in
            let matchesUnit: Bool = {
                switch unitFilter {
                case .all: return true
                case .truck: return log.unitType == .truck
                case .trailer: return log.unitType == .trailer
                }
            }()
            let q = search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            let matchesSearch = q.isEmpty
                || log.unitNumber.lowercased().contains(q)
                || log.description.lowercased().contains(q)
                || log.category.title.lowercased().contains(q)
                || (log.shopName?.lowercased().contains(q) ?? false)
            return matchesUnit && matchesSearch
        }
    }

    var body: some View {
        Group {
            if sizeClass == .regular {
                NavigationSplitView {
                    listContent
                } detail: {
                    if let selected {
                        MaintenanceDetailView(log: selected, profile: profile, repo: repo)
                    } else {
                        ContentUnavailableView(
                            "Select a service record",
                            systemImage: "wrench.and.screwdriver",
                            description: Text("Track oil, tires, brakes, and shop work by unit.")
                        )
                    }
                }
            } else {
                listContent
            }
        }
        .navigationTitle("Maintenance Log")
        .searchable(text: $search, prompt: "Unit #, shop, or work")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                NavigationLink {
                    LogServiceView(profile: profile) { newLog in
                        Task { try? await repo.create(newLog) }
                    }
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .onAppear { repo.subscribe(companyId: profile.companyId) }
        .onDisappear { repo.stop() }
    }

    private var listContent: some View {
        List(selection: sizeClass == .regular ? $selected : .constant(nil)) {
            Picker("Unit", selection: $unitFilter) {
                ForEach(UnitFilter.allCases) { Text($0.title).tag($0) }
            }
            .pickerStyle(.segmented)
            .listRowBackground(Color.clear)

            if filtered.isEmpty {
                ContentUnavailableView(
                    "No service logged",
                    systemImage: "wrench.and.screwdriver",
                    description: Text("Log oil, tires, and shop work so the next driver knows what’s been done.")
                )
            } else {
                ForEach(filtered) { log in
                    if sizeClass == .regular {
                        MaintenanceRowView(log: log)
                            .tag(log)
                    } else {
                        NavigationLink {
                            MaintenanceDetailView(log: log, profile: profile, repo: repo)
                        } label: {
                            MaintenanceRowView(log: log)
                        }
                    }
                }
            }
        }
    }
}

struct MaintenanceRowView: View {
    let log: MaintenanceLog

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("\(log.unitType.title) \(log.unitNumber)")
                    .font(.headline)
                Spacer()
                Text(log.category.title)
                    .font(.caption2.bold())
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(ThemeColor.surfaceContainerHigh)
                    .clipShape(Capsule())
            }
            Text(log.description)
                .font(.subheadline)
                .foregroundStyle(ThemeColor.onSurfaceVariant)
                .lineLimit(2)
            HStack {
                Text(log.serviceDate.prefix(10))
                if let miles = log.odometerMiles {
                    Text("· \(miles) mi")
                }
                if let cost = log.cost {
                    Text("· \(cost, format: .currency(code: "USD"))")
                }
            }
            .font(.caption)
            .foregroundStyle(ThemeColor.onSurfaceVariant)
        }
        .padding(.vertical, 4)
    }
}

struct MaintenanceDetailView: View {
    let log: MaintenanceLog
    let profile: AppUser
    @ObservedObject var repo: MaintenanceRepository
    @Environment(\.dismiss) private var dismiss

    private var canDelete: Bool {
        profile.role == .admin || log.createdByUid == profile.id
    }

    var body: some View {
        List {
            Section("Unit") {
                LabeledContent("Type", value: log.unitType.title)
                LabeledContent("Number", value: log.unitNumber)
            }
            Section("Service") {
                LabeledContent("Date", value: String(log.serviceDate.prefix(10)))
                LabeledContent("Category", value: log.category.title)
                LabeledContent("Description", value: log.description)
                if let miles = log.odometerMiles {
                    LabeledContent("Odometer", value: "\(miles) mi")
                }
                if let shop = log.shopName, !shop.isEmpty {
                    LabeledContent("Shop", value: shop)
                }
                if let cost = log.cost {
                    LabeledContent("Cost", value: cost.formatted(.currency(code: "USD")))
                }
                LabeledContent("Logged by", value: log.performedByName)
            }
            if let notes = log.notes, !notes.isEmpty {
                Section("Notes") { Text(notes) }
            }
            if canDelete {
                Section {
                    Button("Delete record", role: .destructive) {
                        Task {
                            try? await repo.delete(id: log.id)
                            dismiss()
                        }
                    }
                }
            }
        }
        .navigationTitle("Service Record")
        .navigationBarTitleDisplayMode(.inline)
        .frame(maxWidth: sizeClassMax)
        .frame(maxWidth: .infinity)
    }

    @Environment(\.horizontalSizeClass) private var sizeClass
    private var sizeClassMax: CGFloat? {
        sizeClass == .regular ? LayoutMetrics.settingsMaxWidth : nil
    }
}

struct LogServiceView: View {
    let profile: AppUser
    var onSave: (MaintenanceLog) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var unitType: MaintenanceUnitType = .truck
    @State private var unitNumber = ""
    @State private var serviceDate = Date()
    @State private var category: MaintenanceCategory = .oil
    @State private var description = ""
    @State private var odometer = ""
    @State private var shopName = ""
    @State private var cost = ""
    @State private var notes = ""

    var body: some View {
        Form {
            Section("Unit") {
                Picker("Type", selection: $unitType) {
                    ForEach(MaintenanceUnitType.allCases) { Text($0.title).tag($0) }
                }
                .pickerStyle(.segmented)
                TextField("Unit number", text: $unitNumber)
                    .textInputAutocapitalization(.characters)
            }
            Section("Service") {
                DatePicker("Service date", selection: $serviceDate, displayedComponents: .date)
                Picker("Category", selection: $category) {
                    ForEach(MaintenanceCategory.allCases) { Text($0.title).tag($0) }
                }
                TextField("What was serviced", text: $description, axis: .vertical)
                if unitType == .truck {
                    TextField("Odometer (miles)", text: $odometer)
                        .keyboardType(.numberPad)
                }
                TextField("Shop / vendor", text: $shopName)
                TextField("Cost", text: $cost)
                    .keyboardType(.decimalPad)
            }
            Section("Notes") {
                TextField("Optional notes", text: $notes, axis: .vertical)
            }
        }
        .navigationTitle("Log Service")
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") { save() }
                    .disabled(unitNumber.trimmingCharacters(in: .whitespaces).isEmpty
                              || description.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
    }

    private func save() {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        let log = MaintenanceLog(
            id: "",
            data: [
                "companyId": profile.companyId,
                "unitType": unitType.rawValue,
                "unitNumber": unitNumber.trimmingCharacters(in: .whitespacesAndNewlines).uppercased(),
                "serviceDate": formatter.string(from: serviceDate),
                "category": category.rawValue,
                "description": description.trimmingCharacters(in: .whitespacesAndNewlines),
                "odometerMiles": Int(odometer),
                "shopName": shopName.nilIfEmpty as Any,
                "cost": Double(cost),
                "performedByName": profile.displayName,
                "createdByUid": profile.id,
                "notes": notes.nilIfEmpty as Any,
                "createdAt": ISO8601DateFormatter().string(from: Date()),
            ]
        )
        onSave(log)
        dismiss()
    }
}

private extension String {
    var nilIfEmpty: String? {
        let t = trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
    }
}
