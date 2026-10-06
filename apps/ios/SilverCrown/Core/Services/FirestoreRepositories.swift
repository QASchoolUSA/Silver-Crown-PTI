import Foundation
import FirebaseAuth
import FirebaseFirestore
import FirebaseFunctions
import FirebaseStorage
import UIKit

enum RepositoryError: LocalizedError {
    case notSignedIn
    case missingProfile
    case message(String)

    var errorDescription: String? {
        switch self {
        case .notSignedIn: return "Not signed in."
        case .missingProfile: return "User profile missing."
        case .message(let m): return m
        }
    }
}

enum AuthRepository {
    static func signIn(email: String, password: String) async throws {
        _ = try await Auth.auth().signIn(withEmail: email, password: password)
    }

    static func signUp(email: String, password: String, displayName: String, inviteCode: String) async throws {
        let result = try await Auth.auth().createUser(withEmail: email, password: password)
        let change = result.user.createProfileChangeRequest()
        change.displayName = displayName
        try await change.commitChanges()
        let functions = Functions.functions()
        _ = try await functions.httpsCallable("redeemInviteCode").call([
            "code": inviteCode,
            "displayName": displayName,
        ])
    }
}

@MainActor
final class LoadsRepository: ObservableObject {
    @Published private(set) var loads: [Load] = []
    private var listener: ListenerRegistration?

    func subscribeDriver(companyId: String, driverId: String) {
        listener?.remove()
        let q = Firestore.firestore().collection("loads")
            .whereField("companyId", isEqualTo: companyId)
            .whereField("assignedDriverId", isEqualTo: driverId)
            .order(by: "createdAt", descending: true)
        listener = q.addSnapshotListener { [weak self] snap, _ in
            Task { @MainActor in
                self?.loads = snap?.documents.map { Load(id: $0.documentID, data: $0.data()) } ?? []
            }
        }
    }

    func subscribeCompany(companyId: String) {
        listener?.remove()
        let q = Firestore.firestore().collection("loads")
            .whereField("companyId", isEqualTo: companyId)
            .order(by: "createdAt", descending: true)
        listener = q.addSnapshotListener { [weak self] snap, _ in
            Task { @MainActor in
                self?.loads = snap?.documents.map { Load(id: $0.documentID, data: $0.data()) } ?? []
            }
        }
    }

    func stop() {
        listener?.remove()
        listener = nil
    }

    func createLoad(
        companyId: String,
        origin: String,
        destination: String,
        payout: String,
        miles: String,
        type: String,
        assignedDriverId: String?,
        assignedDriverName: String?,
        originCoords: Coords?,
        destCoords: Coords?
    ) async throws {
        var stops: [[String: Any]] = []
        if let originCoords {
            stops.append([
                "type": "pickup",
                "address": origin,
                "coords": ["latitude": originCoords.latitude, "longitude": originCoords.longitude],
                "sequence": 0,
            ])
        }
        if let destCoords {
            stops.append([
                "type": "dropoff",
                "address": destination,
                "coords": ["latitude": destCoords.latitude, "longitude": destCoords.longitude],
                "sequence": 1,
            ])
        }
        var data: [String: Any] = [
            "companyId": companyId,
            "assignedDriverId": assignedDriverId as Any,
            "assignedDriverName": assignedDriverName as Any,
            "origin": origin,
            "destination": destination,
            "payout": payout,
            "miles": miles,
            "type": type,
            "status": "available",
            "stops": stops,
            "createdAt": ISO8601DateFormatter().string(from: Date()),
        ]
        if let originCoords {
            data["originCoords"] = ["latitude": originCoords.latitude, "longitude": originCoords.longitude]
        }
        if let destCoords {
            data["destCoords"] = ["latitude": destCoords.latitude, "longitude": destCoords.longitude]
        }
        _ = try await Firestore.firestore().collection("loads").addDocument(data: data)
    }

    static func geocodeAddress(_ address: String) async throws -> Coords {
        let result = try await Functions.functions().httpsCallable("geocodeAddress").call(["query": address])
        guard let root = result.data as? [String: Any],
              let results = root["results"] as? [[String: Any]],
              let first = results.first,
              let coords = first["coords"] as? [String: Any],
              let lat = coords["latitude"] as? Double,
              let lon = coords["longitude"] as? Double
        else {
            throw RepositoryError.message("Could not geocode address.")
        }
        return Coords(latitude: lat, longitude: lon)
    }

    static func fetchRouteWeather(
        origin: Coords,
        destination: Coords,
        originLabel: String,
        destLabel: String
    ) async throws -> RouteWeather {
        let result = try await Functions.functions().httpsCallable("getRouteWeather").call([
            "originCoords": ["latitude": origin.latitude, "longitude": origin.longitude],
            "destCoords": ["latitude": destination.latitude, "longitude": destination.longitude],
            "originLabel": originLabel,
            "destLabel": destLabel,
        ])
        guard let data = result.data as? [String: Any] else {
            throw RepositoryError.message("Weather unavailable.")
        }
        return RouteWeather(data: data)
    }

    static func fetchCompanyDrivers(companyId: String) async throws -> [AppUser] {
        let snap = try await Firestore.firestore().collection("users")
            .whereField("companyId", isEqualTo: companyId)
            .whereField("role", isEqualTo: "driver")
            .getDocuments()
        return snap.documents.map { AppUser(id: $0.documentID, data: $0.data()) }
    }
}

@MainActor
final class InspectionsRepository: ObservableObject {
    @Published private(set) var inspections: [Inspection] = []
    private var listener: ListenerRegistration?

    func subscribeDriver(companyId: String, driverId: String) {
        listener?.remove()
        let q = Firestore.firestore().collection("inspections")
            .whereField("companyId", isEqualTo: companyId)
            .whereField("driverId", isEqualTo: driverId)
            .order(by: "createdAt", descending: true)
        listener = q.addSnapshotListener { [weak self] snap, _ in
            Task { @MainActor in
                self?.inspections = snap?.documents.map { Inspection(id: $0.documentID, data: $0.data()) } ?? []
            }
        }
    }

    func subscribeCompany(companyId: String) {
        listener?.remove()
        let q = Firestore.firestore().collection("inspections")
            .whereField("companyId", isEqualTo: companyId)
            .order(by: "createdAt", descending: true)
        listener = q.addSnapshotListener { [weak self] snap, _ in
            Task { @MainActor in
                self?.inspections = snap?.documents.map { Inspection(id: $0.documentID, data: $0.data()) } ?? []
            }
        }
    }

    func stop() {
        listener?.remove()
        listener = nil
    }

    func createInspection(
        profile: AppUser,
        truckNumber: String,
        trailerNumber: String?,
        sections: [InspectionSection],
        photos: [String: UIImage],
        signatureImage: UIImage?
    ) async throws {
        let status = sections.flatMap(\.items).contains(where: { $0.status == "fail" }) ? "DEFECTS FOUND" : "PASS"
        let ref = try await Firestore.firestore().collection("inspections").addDocument(data: [
            "companyId": profile.companyId,
            "driverId": profile.id,
            "driverName": profile.displayName,
            "truckNumber": truckNumber,
            "trailerNumber": trailerNumber as Any,
            "status": status,
            "sections": [],
            "createdAt": ISO8601DateFormatter().string(from: Date()),
        ])

        var updatedSections = sections
        let storage = Storage.storage()
        let base = "companies/\(profile.companyId)/drivers/\(profile.id)/inspections/\(ref.documentID)"

        do {
            for (itemKey, image) in photos {
                guard let jpeg = image.jpegData(compressionQuality: 0.72) else { continue }
                let fileName = itemKey
                    .replacingOccurrences(of: "::", with: "_")
                    .replacingOccurrences(of: #"[^\w.-]+"#, with: "_", options: .regularExpression)
                let photoRef = storage.reference().child("\(base)/photos/\(fileName).jpg")
                let meta = StorageMetadata()
                meta.contentType = "image/jpeg"
                try await StorageUpload.put(data: jpeg, to: photoRef, metadata: meta)
                let url = try await photoRef.downloadURL().absoluteString
                // Keys are "sectionId::itemName"
                guard let range = itemKey.range(of: "::") else { continue }
                let sectionId = String(itemKey[..<range.lowerBound])
                let itemName = String(itemKey[range.upperBound...])
                if let sIdx = updatedSections.firstIndex(where: { $0.id == sectionId }),
                   let iIdx = updatedSections[sIdx].items.firstIndex(where: { $0.name == itemName }) {
                    updatedSections[sIdx].items[iIdx].photoUrl = url
                }
            }

            var signatureUrl: String?
            if let signatureImage, let data = signatureImage.pngData() {
                let sigRef = storage.reference().child("\(base)/signature.png")
                let meta = StorageMetadata()
                meta.contentType = "image/png"
                try await StorageUpload.put(data: data, to: sigRef, metadata: meta)
                signatureUrl = try await sigRef.downloadURL().absoluteString
            }

            let sectionsPayload: [[String: Any]] = updatedSections.map { sec in
                [
                    "id": sec.id,
                    "title": sec.title,
                    "type": sec.type,
                    "items": sec.items.map { item -> [String: Any] in
                        var dict: [String: Any] = [
                            "name": item.name,
                            "status": item.status as Any,
                        ]
                        if let notes = item.notes { dict["notes"] = notes }
                        if let photoUrl = item.photoUrl { dict["photoUrl"] = photoUrl }
                        return dict
                    },
                ]
            }

            var patch: [String: Any] = ["sections": sectionsPayload]
            if let signatureUrl {
                patch["signatureUrl"] = signatureUrl
            }
            try await ref.updateData(patch)
        } catch {
            try? await ref.delete()
            throw error
        }
    }
}

enum StorageUpload {
    static func put(data: Data, to ref: StorageReference, metadata: StorageMetadata) async throws {
        _ = try await withCheckedThrowingContinuation { (cont: CheckedContinuation<StorageMetadata, Error>) in
            ref.putData(data, metadata: metadata) { metadata, error in
                if let error {
                    cont.resume(throwing: error)
                } else if let metadata {
                    cont.resume(returning: metadata)
                } else {
                    cont.resume(throwing: RepositoryError.message("Upload failed."))
                }
            }
        }
    }
}

@MainActor
final class MaintenanceRepository: ObservableObject {
    @Published private(set) var logs: [MaintenanceLog] = []
    private var listener: ListenerRegistration?

    func subscribe(companyId: String) {
        listener?.remove()
        let q = Firestore.firestore().collection("maintenanceLogs")
            .whereField("companyId", isEqualTo: companyId)
            .order(by: "serviceDate", descending: true)
        listener = q.addSnapshotListener { [weak self] snap, _ in
            Task { @MainActor in
                self?.logs = snap?.documents.map { MaintenanceLog(id: $0.documentID, data: $0.data()) } ?? []
            }
        }
    }

    func stop() {
        listener?.remove()
        listener = nil
    }

    func create(_ log: MaintenanceLog) async throws {
        var data = log.toFirestore()
        data["createdAt"] = ISO8601DateFormatter().string(from: Date())
        _ = try await Firestore.firestore().collection("maintenanceLogs").addDocument(data: data)
    }

    func delete(id: String) async throws {
        try await Firestore.firestore().collection("maintenanceLogs").document(id).delete()
    }
}

enum CompanyRepository {
    static func getCompanyName(companyId: String) async -> String? {
        let snap = try? await Firestore.firestore().collection("companies").document(companyId).getDocument()
        return snap?.data()?["name"] as? String
    }
}
