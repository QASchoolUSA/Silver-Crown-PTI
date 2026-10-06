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
                HStack(spacing: 0) {
                    listContent
                        .frame(minWidth: LayoutMetrics.listColumnMin, idealWidth: 380, maxWidth: 420)
                    Divider()
                    Group {
                        if let selected {
                            MaintenanceDetailView(log: selected, profile: profile, repo: repo)
                        } else {
                            SCEmptyState(
                                title: "Select a service record",
                                systemImage: "wrench.and.screwdriver",
                                description: "Track oil, tires, brakes, and shop work by unit."
                            )
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            } else {
                listContent
            }
        }
        .background(ThemeColor.surface.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text("MAINTENANCE")
                    .font(SCFont.sectionTitle)
                    .foregroundStyle(ThemeColor.primary)
                    .tracking(1.5)
            }
            ToolbarItem(placement: .primaryAction) {
                NavigationLink {
                    LogServiceView(profile: profile) { newLog in
                        Task { try? await repo.create(newLog) }
                    }
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .foregroundStyle(ThemeColor.primary)
                }
            }
        }
        .searchable(text: $search, prompt: "Unit #, shop, or work")
        .onAppear { repo.subscribe(companyId: profile.companyId) }
        .onDisappear { repo.stop() }
    }

    private var listContent: some View {
        ScrollView {
            LazyVStack(spacing: Spacing.md) {
                SCFilterBar {
                    Picker("Unit", selection: $unitFilter) {
                        ForEach(UnitFilter.allCases) { Text($0.title).tag($0) }
                    }
                    .pickerStyle(.segmented)
                }

                if filtered.isEmpty {
                    SCEmptyState(
                        title: "No service logged",
                        systemImage: "wrench.and.screwdriver",
                        description: "Log oil, tires, and shop work so the next driver knows what’s been done."
                    )
                    .padding(.top, Spacing.xl)
                } else {
                    ForEach(Array(filtered.enumerated()), id: \.element.id) { index, log in
                        Group {
                            if sizeClass == .regular {
                                Button { selected = log } label: {
                                    MaintenanceRowView(log: log, selected: selected?.id == log.id)
                                }
                                .buttonStyle(.plain)
                            } else {
                                NavigationLink {
                                    MaintenanceDetailView(log: log, profile: profile, repo: repo)
                                } label: {
                                    MaintenanceRowView(log: log)
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

struct MaintenanceRowView: View {
    let log: MaintenanceLog
    var selected: Bool = false

    var body: some View {
        SCCard {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                HStack {
                    Label(
                        "\(log.unitType.title) \(log.unitNumber)",
                        systemImage: log.unitType == .truck ? "truck.box.fill" : "shippingbox.fill"
                    )
                    .font(SCFont.headline)
                    .foregroundStyle(ThemeColor.onSurface)
                    Spacer()
                    SCStatusChip(text: log.category.title, color: ThemeColor.primary)
                }
                Text(log.description)
                    .font(SCFont.subheadline)
                    .foregroundStyle(ThemeColor.onSurfaceVariant)
                    .lineLimit(2)
                HStack(spacing: Spacing.sm) {
                    Text(String(log.serviceDate.prefix(10)))
                    if let miles = log.odometerMiles {
                        Text("· \(miles) mi")
                    }
                    if let cost = log.cost {
                        Text("· \(cost, format: .currency(code: "USD"))")
                            .fontWeight(.semibold)
                            .foregroundStyle(ThemeColor.onSurface)
                    }
                }
                .font(SCFont.caption)
                .foregroundStyle(ThemeColor.onSurfaceVariant)
            }
        }
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(selected ? ThemeColor.primary : .clear, lineWidth: 2)
        )
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
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                SCCard {
                    VStack(alignment: .leading, spacing: Spacing.md) {
                        Label(
                            "\(log.unitType.title) \(log.unitNumber)",
                            systemImage: log.unitType == .truck ? "truck.box.fill" : "shippingbox.fill"
                        )
                        .font(SCFont.sectionTitle)
                        .foregroundStyle(ThemeColor.onSurface)
                        SCStatusChip(text: log.category.title, color: ThemeColor.primary)
                        labeled("Date", String(log.serviceDate.prefix(10)))
                        labeled("Description", log.description)
                        if let miles = log.odometerMiles {
                            labeled("Odometer", "\(miles) mi")
                        }
                        if let shop = log.shopName, !shop.isEmpty {
                            labeled("Shop", shop)
                        }
                        if let cost = log.cost {
                            labeled("Cost", cost.formatted(.currency(code: "USD")))
                        }
                        labeled("Logged by", log.performedByName)
                        if let notes = log.notes, !notes.isEmpty {
                            Divider().overlay(ThemeColor.outlineVariant)
                            Text(notes)
                                .font(SCFont.subheadline)
                                .foregroundStyle(ThemeColor.onSurfaceVariant)
                        }
                    }
                }

                if canDelete {
                    Button("Delete record", role: .destructive) {
                        Task {
                            try? await repo.delete(id: log.id)
                            dismiss()
                        }
                    }
                    .font(SCFont.button)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(ThemeColor.error.opacity(0.12))
                    .foregroundStyle(ThemeColor.error)
                    .clipShape(RoundedRectangle(cornerRadius: Radius.sm, style: .continuous))
                }
            }
            .padding(Spacing.lg)
            .frame(maxWidth: LayoutMetrics.settingsMaxWidth)
            .frame(maxWidth: .infinity)
            .scAppearFade()
        }
        .background(ThemeColor.surface.ignoresSafeArea())
        .navigationTitle("Service Record")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func labeled(_ title: String, _ value: String) -> some View {
        HStack(alignment: .top) {
            Text(title).font(SCFont.caption).foregroundStyle(ThemeColor.onSurfaceVariant)
            Spacer()
            Text(value)
                .font(SCFont.subheadline)
                .foregroundStyle(ThemeColor.onSurface)
                .multilineTextAlignment(.trailing)
        }
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
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                Text("LOG SERVICE")
                    .font(SCFont.sectionTitle)
                    .foregroundStyle(ThemeColor.primary)
                    .tracking(1.5)

                SCCard {
                    VStack(alignment: .leading, spacing: Spacing.md) {
                        Picker("Type", selection: $unitType) {
                            ForEach(MaintenanceUnitType.allCases) { Text($0.title).tag($0) }
                        }
                        .pickerStyle(.segmented)
                        TextField("Unit number", text: $unitNumber)
                            .textInputAutocapitalization(.characters)
                            .textFieldStyle(SCFieldStyle())
                    }
                }

                SCCard {
                    VStack(alignment: .leading, spacing: Spacing.md) {
                        DatePicker("Service date", selection: $serviceDate, displayedComponents: .date)
                        Picker("Category", selection: $category) {
                            ForEach(MaintenanceCategory.allCases) { Text($0.title).tag($0) }
                        }
                        TextField("What was serviced", text: $description, axis: .vertical)
                            .textFieldStyle(SCFieldStyle())
                        if unitType == .truck {
                            TextField("Odometer (miles)", text: $odometer)
                                .keyboardType(.numberPad)
                                .textFieldStyle(SCFieldStyle())
                        }
                        TextField("Shop / vendor", text: $shopName)
                            .textFieldStyle(SCFieldStyle())
                        TextField("Cost", text: $cost)
                            .keyboardType(.decimalPad)
                            .textFieldStyle(SCFieldStyle())
                        TextField("Optional notes", text: $notes, axis: .vertical)
                            .textFieldStyle(SCFieldStyle())
                    }
                }

                Button("Save") { save() }
                    .buttonStyle(SCPrimaryButtonStyle())
                    .disabled(unitNumber.trimmingCharacters(in: .whitespaces).isEmpty
                              || description.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(Spacing.lg)
        }
        .background(ThemeColor.surface.ignoresSafeArea())
        .navigationTitle("Log Service")
        .navigationBarTitleDisplayMode(.inline)
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
