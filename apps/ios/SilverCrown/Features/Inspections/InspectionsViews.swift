import SwiftUI
import PencilKit
import PhotosUI

struct InspectionsListView: View {
    let profile: AppUser
    let companyWide: Bool
    @StateObject private var repo = InspectionsRepository()
    @State private var truckFilter = ""

    private var filtered: [Inspection] {
        let q = truckFilter.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return repo.inspections }
        return repo.inspections.filter {
            $0.truckNumber.lowercased().contains(q)
                || ($0.trailerNumber?.lowercased().contains(q) ?? false)
                || $0.driverName.lowercased().contains(q)
        }
    }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: Spacing.md) {
                if companyWide {
                    SCFilterBar {
                        TextField("Filter truck / driver", text: $truckFilter)
                            .textFieldStyle(SCFieldStyle())
                    }
                }

                if filtered.isEmpty {
                    SCEmptyState(
                        title: "No inspections",
                        systemImage: "checklist",
                        description: companyWide
                            ? "No PTIs match this filter."
                            : "Start a pre-trip before you roll."
                    )
                    .padding(.top, Spacing.xxl)
                } else {
                    ForEach(Array(filtered.enumerated()), id: \.element.id) { index, inspection in
                        NavigationLink {
                            InspectionDetailView(inspection: inspection)
                        } label: {
                            InspectionRowCard(inspection: inspection, showDriver: companyWide)
                        }
                        .buttonStyle(.plain)
                        .scAppearFade(delay: Double(min(index, 8)) * 0.04)
                    }
                }
            }
            .padding(Spacing.lg)
        }
        .background(ThemeColor.surface.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text(companyWide ? "ALL PTIS" : "INSPECTIONS")
                    .font(SCFont.sectionTitle)
                    .foregroundStyle(ThemeColor.primary)
                    .tracking(1.5)
            }
            if !companyWide {
                ToolbarItem(placement: .primaryAction) {
                    NavigationLink {
                        NewPTIView(profile: profile)
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .foregroundStyle(ThemeColor.primary)
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
}

struct InspectionRowCard: View {
    let inspection: Inspection
    var showDriver: Bool

    var body: some View {
        SCCard {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                HStack {
                    Text("Truck \(inspection.truckNumber)")
                        .font(SCFont.headline)
                        .foregroundStyle(ThemeColor.onSurface)
                    Spacer()
                    SCStatusChip(
                        text: inspection.status,
                        color: ThemeColor.inspectionStatus(inspection.status)
                    )
                }
                Text(showDriver ? inspection.driverName : formatDate(inspection.createdAt))
                    .font(SCFont.caption)
                    .foregroundStyle(ThemeColor.onSurfaceVariant)
                if let trailer = inspection.trailerNumber, !trailer.isEmpty {
                    Label("Trailer \(trailer)", systemImage: "shippingbox")
                        .font(SCFont.caption)
                        .foregroundStyle(ThemeColor.onSurfaceVariant)
                }
            }
        }
    }

    private func formatDate(_ iso: String) -> String {
        guard let date = ISO8601DateFormatter().date(from: iso) else { return iso }
        return date.formatted(date: .abbreviated, time: .shortened)
    }
}

struct InspectionDetailView: View {
    let inspection: Inspection

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                SCCard {
                    VStack(alignment: .leading, spacing: Spacing.md) {
                        HStack {
                            Text("UNIT")
                                .font(SCFont.captionBold)
                                .foregroundStyle(ThemeColor.onSurfaceVariant)
                                .tracking(1)
                            Spacer()
                            SCStatusChip(
                                text: inspection.status,
                                color: ThemeColor.inspectionStatus(inspection.status)
                            )
                        }
                        labeled("Truck", inspection.truckNumber)
                        if let trailer = inspection.trailerNumber {
                            labeled("Trailer", trailer)
                        }
                        labeled("Driver", inspection.driverName)
                        labeled("Date", inspection.createdAt)
                    }
                }

                ForEach(inspection.sections) { section in
                    SCCard {
                        VStack(alignment: .leading, spacing: Spacing.md) {
                            Text("\(section.type.uppercased()) · \(section.title.uppercased())")
                                .font(SCFont.captionBold)
                                .foregroundStyle(ThemeColor.primary)
                                .tracking(0.8)
                            ForEach(section.items) { item in
                                VStack(alignment: .leading, spacing: 6) {
                                    HStack {
                                        Text(item.name)
                                            .font(SCFont.subheadline)
                                            .foregroundStyle(ThemeColor.onSurface)
                                        Spacer()
                                        Text((item.status ?? "—").uppercased())
                                            .font(SCFont.captionBold)
                                            .foregroundStyle(item.status == "fail" ? ThemeColor.error : ThemeColor.success)
                                    }
                                    if let notes = item.notes, !notes.isEmpty {
                                        Text(notes)
                                            .font(SCFont.caption)
                                            .foregroundStyle(ThemeColor.onSurfaceVariant)
                                    }
                                    if let photoUrl = item.photoUrl, !photoUrl.isEmpty {
                                        RemotePhotoView(urlString: photoUrl)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .padding(Spacing.lg)
            .scAppearFade()
        }
        .background(ThemeColor.surface.ignoresSafeArea())
        .navigationTitle("PTI Detail")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func labeled(_ title: String, _ value: String) -> some View {
        HStack {
            Text(title).font(SCFont.caption).foregroundStyle(ThemeColor.onSurfaceVariant)
            Spacer()
            Text(value).font(SCFont.subheadline).foregroundStyle(ThemeColor.onSurface)
        }
    }
}

struct NewPTIView: View {
    let profile: AppUser
    @Environment(\.dismiss) private var dismiss
    @State private var step = 0
    @State private var truckNumber = ""
    @State private var trailerNumber = ""
    @State private var itemStatus: [String: String] = [:]
    @State private var itemNotes: [String: String] = [:]
    @State private var itemPhotos: [String: UIImage] = [:]
    @State private var canvas = PKCanvasView()
    @State private var busy = false
    @State private var error: String?
    @Environment(\.horizontalSizeClass) private var sizeClass

    private var totalSteps: Int { 1 + PTIStepDefinition.steps.count + 1 }

    var body: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                Text("NEW PTI")
                    .font(SCFont.sectionTitle)
                    .foregroundStyle(ThemeColor.primary)
                    .tracking(1.5)
                ProgressView(value: Double(step + 1), total: Double(totalSteps))
                    .tint(ThemeColor.primary)
                Text("Step \(step + 1) of \(totalSteps)")
                    .font(SCFont.caption)
                    .foregroundStyle(ThemeColor.onSurfaceVariant)
            }
            .padding(Spacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(ThemeColor.surfaceContainerLow)

            Group {
                if step == 0 {
                    vehicleStep
                } else if step <= PTIStepDefinition.steps.count {
                    checklistStep(PTIStepDefinition.steps[step - 1])
                } else {
                    signatureStep
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            HStack {
                Button("Back") { step = max(0, step - 1) }
                    .font(SCFont.button)
                    .foregroundStyle(ThemeColor.primary)
                    .disabled(step == 0 || busy)
                Spacer()
                if step < totalSteps - 1 {
                    Button("Next") { step += 1 }
                        .disabled(!canAdvance)
                        .buttonStyle(SCPrimaryButtonStyle())
                        .frame(width: 140)
                } else {
                    Button(busy ? "Submitting…" : "Submit PTI") {
                        Task { await submit() }
                    }
                    .disabled(busy || canvas.drawing.bounds.isEmpty)
                    .buttonStyle(SCPrimaryButtonStyle())
                    .frame(width: 160)
                }
            }
            .padding(Spacing.lg)
            .background(ThemeColor.surfaceContainer.ignoresSafeArea(edges: .bottom))
        }
        .background(ThemeColor.surface.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
    }

    private var canAdvance: Bool {
        if step == 0 { return !truckNumber.trimmingCharacters(in: .whitespaces).isEmpty }
        if step <= PTIStepDefinition.steps.count {
            let def = PTIStepDefinition.steps[step - 1]
            return def.items.allSatisfy { itemStatus[key(def.id, $0)] != nil }
        }
        return true
    }

    private var vehicleStep: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                Text("Walk the truck and trailer. Fail anything unsafe before you roll.")
                    .font(SCFont.subheadline)
                    .foregroundStyle(ThemeColor.onSurfaceVariant)
                SCCard {
                    VStack(spacing: Spacing.md) {
                        TextField("Truck number *", text: $truckNumber)
                            .textFieldStyle(SCFieldStyle())
                        TextField("Trailer number (optional)", text: $trailerNumber)
                            .textFieldStyle(SCFieldStyle())
                    }
                }
            }
            .padding(Spacing.lg)
        }
    }

    private func checklistStep(_ def: (id: String, title: String, type: String, items: [String])) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                Text("\(def.type.uppercased()) · \(def.title.uppercased())")
                    .font(SCFont.captionBold)
                    .foregroundStyle(ThemeColor.primary)
                    .tracking(1)
                    .padding(.horizontal, Spacing.lg)

                if sizeClass == .regular {
                    HStack(alignment: .top, spacing: Spacing.lg) {
                        checklistCard(def)
                        defectCard(def)
                    }
                    .padding(.horizontal, Spacing.lg)
                } else {
                    checklistCard(def)
                        .padding(.horizontal, Spacing.lg)
                    defectCard(def)
                        .padding(.horizontal, Spacing.lg)
                }
            }
            .padding(.vertical, Spacing.lg)
        }
    }

    private func checklistCard(_ def: (id: String, title: String, type: String, items: [String])) -> some View {
        SCCard {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                ForEach(def.items, id: \.self) { item in
                    itemRow(defId: def.id, item: item)
                }
            }
        }
    }

    private func defectCard(_ def: (id: String, title: String, type: String, items: [String])) -> some View {
        let fails = def.items.filter { itemStatus[key(def.id, $0)] == "fail" }
        return Group {
            if !fails.isEmpty {
                SCCard {
                    VStack(alignment: .leading, spacing: Spacing.lg) {
                        Text("DEFECT DETAILS")
                            .font(SCFont.captionBold)
                            .foregroundStyle(ThemeColor.error)
                            .tracking(1)
                        ForEach(fails, id: \.self) { item in
                            VStack(alignment: .leading, spacing: Spacing.sm) {
                                Text(item).font(SCFont.headline).foregroundStyle(ThemeColor.onSurface)
                                TextField("Notes", text: noteBinding(def.id, item), axis: .vertical)
                                    .textFieldStyle(SCFieldStyle())
                                DefectPhotoButton(title: item, image: photoBinding(def.id, item))
                            }
                        }
                    }
                }
            }
        }
    }

    private func itemRow(defId: String, item: String) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text(item).font(SCFont.subheadline).fontWeight(.semibold).foregroundStyle(ThemeColor.onSurface)
            Picker("Status", selection: statusBinding(defId, item)) {
                Text("Pass").tag(Optional("pass"))
                Text("Fail").tag(Optional("fail"))
            }
            .pickerStyle(.segmented)
            .onChange(of: itemStatus[key(defId, item)]) { _, value in
                if value != "fail" {
                    itemPhotos[key(defId, item)] = nil
                }
            }
        }
    }

    private var signatureStep: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                Text("Driver signature confirms this PTI.")
                    .font(SCFont.subheadline)
                    .foregroundStyle(ThemeColor.onSurfaceVariant)
                SCCard(padding: Spacing.md) {
                    VStack(alignment: .leading, spacing: Spacing.md) {
                        SignatureCanvas(canvasView: $canvas)
                            .frame(maxWidth: .infinity)
                            .frame(height: sizeClass == .regular ? 320 : 220)
                            .background(Color.white)
                            .clipShape(RoundedRectangle(cornerRadius: Radius.sm, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: Radius.sm, style: .continuous)
                                    .stroke(ThemeColor.outlineVariant, lineWidth: 1)
                            )
                        Button("Clear signature") { canvas.drawing = PKDrawing() }
                            .font(SCFont.captionBold)
                            .foregroundStyle(ThemeColor.primary)
                        if let error {
                            Text(error).font(SCFont.caption).foregroundStyle(ThemeColor.error)
                        }
                    }
                }
            }
            .padding(Spacing.lg)
        }
    }

    private func key(_ sectionId: String, _ item: String) -> String { "\(sectionId)::\(item)" }

    private func statusBinding(_ sectionId: String, _ item: String) -> Binding<String?> {
        Binding(
            get: { itemStatus[key(sectionId, item)] },
            set: { itemStatus[key(sectionId, item)] = $0 }
        )
    }

    private func noteBinding(_ sectionId: String, _ item: String) -> Binding<String> {
        Binding(
            get: { itemNotes[key(sectionId, item)] ?? "" },
            set: { itemNotes[key(sectionId, item)] = $0 }
        )
    }

    private func photoBinding(_ sectionId: String, _ item: String) -> Binding<UIImage?> {
        Binding(
            get: { itemPhotos[key(sectionId, item)] },
            set: { itemPhotos[key(sectionId, item)] = $0 }
        )
    }

    private func submit() async {
        busy = true
        error = nil
        defer { busy = false }
        let sections: [InspectionSection] = PTIStepDefinition.steps.map { def in
            InspectionSection(
                id: def.id,
                title: def.title,
                type: def.type,
                items: def.items.map { name in
                    InspectionItem(
                        name: name,
                        status: itemStatus[key(def.id, name)],
                        notes: itemNotes[key(def.id, name)],
                        photoUrl: nil
                    )
                }
            )
        }
        let image = canvas.drawing.image(from: canvas.bounds, scale: UIScreen.main.scale)
        let photos = itemPhotos.compactMapValues { $0 }
        do {
            try await InspectionsRepository().createInspection(
                profile: profile,
                truckNumber: truckNumber.trimmingCharacters(in: .whitespaces),
                trailerNumber: trailerNumber.trimmingCharacters(in: .whitespaces).nilIfEmpty,
                sections: sections,
                photos: photos,
                signatureImage: image
            )
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct SignatureCanvas: UIViewRepresentable {
    @Binding var canvasView: PKCanvasView

    func makeUIView(context: Context) -> PKCanvasView {
        canvasView.drawingPolicy = .anyInput
        canvasView.backgroundColor = .white
        canvasView.tool = PKInkingTool(.pen, color: .black, width: 2)
        return canvasView
    }

    func updateUIView(_ uiView: PKCanvasView, context: Context) {}
}

private extension String {
    var nilIfEmpty: String? {
        let t = trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
    }
}
