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
        List {
            if companyWide {
                TextField("Filter truck / driver", text: $truckFilter)
            }
            if filtered.isEmpty {
                ContentUnavailableView("No inspections", systemImage: "checklist")
            } else {
                ForEach(filtered) { inspection in
                    NavigationLink {
                        InspectionDetailView(inspection: inspection)
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text("Truck \(inspection.truckNumber)").font(.headline)
                                Spacer()
                                Text(inspection.status)
                                    .font(.caption2.bold())
                                    .foregroundStyle(inspection.status == "PASS" ? ThemeColor.primary : ThemeColor.error)
                            }
                            Text(companyWide ? inspection.driverName : formatDate(inspection.createdAt))
                                .font(.caption)
                                .foregroundStyle(ThemeColor.onSurfaceVariant)
                            if let trailer = inspection.trailerNumber, !trailer.isEmpty {
                                Text("Trailer \(trailer)").font(.caption2).foregroundStyle(ThemeColor.onSurfaceVariant)
                            }
                        }
                        .padding(.vertical, 2)
                    }
                }
            }
        }
        .navigationTitle(companyWide ? "All PTIs" : "Inspections")
        .toolbar {
            if !companyWide {
                ToolbarItem(placement: .primaryAction) {
                    NavigationLink {
                        NewPTIView(profile: profile)
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

    private func formatDate(_ iso: String) -> String {
        guard let date = ISO8601DateFormatter().date(from: iso) else { return iso }
        return date.formatted(date: .abbreviated, time: .shortened)
    }
}

struct InspectionDetailView: View {
    let inspection: Inspection

    var body: some View {
        List {
            Section("Unit") {
                LabeledContent("Truck", value: inspection.truckNumber)
                if let trailer = inspection.trailerNumber { LabeledContent("Trailer", value: trailer) }
                LabeledContent("Driver", value: inspection.driverName)
                LabeledContent("Status", value: inspection.status)
                LabeledContent("Date", value: inspection.createdAt)
            }
            ForEach(inspection.sections) { section in
                Section("\(section.type): \(section.title)") {
                    ForEach(section.items) { item in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(item.name)
                                Spacer()
                                Text((item.status ?? "—").uppercased())
                                    .font(.caption2.bold())
                                    .foregroundStyle(item.status == "fail" ? ThemeColor.error : ThemeColor.primary)
                            }
                            if let notes = item.notes, !notes.isEmpty {
                                Text(notes).font(.caption).foregroundStyle(ThemeColor.onSurfaceVariant)
                            }
                            if let photoUrl = item.photoUrl, !photoUrl.isEmpty {
                                RemotePhotoView(urlString: photoUrl)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("PTI Detail")
        .navigationBarTitleDisplayMode(.inline)
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

    private var totalSteps: Int { 1 + PTIStepDefinition.steps.count + 1 } // vehicle + 10 + signature

    var body: some View {
        VStack(spacing: 0) {
            ProgressView(value: Double(step + 1), total: Double(totalSteps))
                .tint(ThemeColor.primary)
                .padding()

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
                    .disabled(step == 0 || busy)
                Spacer()
                if step < totalSteps - 1 {
                    Button("Next") { step += 1 }
                        .disabled(!canAdvance)
                        .buttonStyle(SCPrimaryButtonStyle())
                        .frame(width: 120)
                } else {
                    Button(busy ? "Submitting…" : "Submit PTI") {
                        Task { await submit() }
                    }
                    .disabled(busy || canvas.drawing.bounds.isEmpty)
                    .buttonStyle(SCPrimaryButtonStyle())
                    .frame(width: 160)
                }
            }
            .padding()
        }
        .background(ThemeColor.surface.ignoresSafeArea())
        .navigationTitle("New PTI")
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
        Form {
            Section("Vehicle IDs") {
                TextField("Truck number *", text: $truckNumber)
                TextField("Trailer number (optional)", text: $trailerNumber)
            }
            Text("Walk the truck and trailer. Fail anything unsafe and note it before you roll.")
                .font(.footnote)
                .foregroundStyle(ThemeColor.onSurfaceVariant)
        }
    }

    private func checklistStep(_ def: (id: String, title: String, type: String, items: [String])) -> some View {
        Group {
            if sizeClass == .regular {
                HStack(alignment: .top, spacing: 0) {
                    Form {
                        Section("\(def.type) · \(def.title)") {
                            ForEach(def.items, id: \.self) { item in
                                itemRow(defId: def.id, item: item)
                            }
                        }
                    }
                    Form {
                        Section("Defect details") {
                            ForEach(def.items, id: \.self) { item in
                                if itemStatus[key(def.id, item)] == "fail" {
                                    TextField("Notes for \(item)", text: noteBinding(def.id, item), axis: .vertical)
                                    DefectPhotoButton(title: item, image: photoBinding(def.id, item))
                                }
                            }
                        }
                    }
                }
            } else {
                Form {
                    Section("\(def.type) · \(def.title)") {
                        ForEach(def.items, id: \.self) { item in
                            itemRow(defId: def.id, item: item)
                            if itemStatus[key(def.id, item)] == "fail" {
                                TextField("Notes", text: noteBinding(def.id, item), axis: .vertical)
                                DefectPhotoButton(title: item, image: photoBinding(def.id, item))
                            }
                        }
                    }
                }
            }
        }
    }

    private func itemRow(defId: String, item: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(item).font(.subheadline.weight(.semibold))
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
        VStack(alignment: .leading, spacing: 12) {
            Text("Driver signature")
                .font(.headline)
                .padding(.horizontal)
            SignatureCanvas(canvasView: $canvas)
                .frame(maxWidth: .infinity)
                .frame(height: sizeClass == .regular ? 320 : 220)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .padding(.horizontal)
            Button("Clear") { canvas.drawing = PKDrawing() }
                .padding(.horizontal)
            if let error {
                Text(error).foregroundStyle(ThemeColor.error).padding(.horizontal)
            }
            Spacer()
        }
        .padding(.top)
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
