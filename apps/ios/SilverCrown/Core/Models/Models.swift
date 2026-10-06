import Foundation

enum UserRole: String, Codable {
    case driver
    case admin
}

struct AppUser: Identifiable, Equatable {
    let id: String
    var email: String
    var displayName: String
    var companyId: String
    var role: UserRole
    var equipmentTypes: [String]
    var createdAt: String

    init(id: String, data: [String: Any]) {
        self.id = id
        self.email = data["email"] as? String ?? ""
        self.displayName = data["displayName"] as? String ?? ""
        self.companyId = data["companyId"] as? String ?? ""
        self.role = UserRole(rawValue: data["role"] as? String ?? "driver") ?? .driver
        self.equipmentTypes = data["equipmentTypes"] as? [String] ?? []
        self.createdAt = data["createdAt"] as? String ?? ""
    }
}

struct Coords: Codable, Equatable {
    var latitude: Double
    var longitude: Double
}

struct LoadStop: Codable, Identifiable, Equatable {
    var id: String { "\(sequence)-\(type)-\(address)" }
    var type: String
    var address: String
    var coords: Coords
    var sequence: Int
}

struct Load: Identifiable, Equatable, Hashable {
    let id: String
    var companyId: String
    var assignedDriverId: String?
    var assignedDriverName: String?
    var origin: String
    var destination: String
    var payout: String
    var miles: String
    var type: String
    var status: String
    var originCoords: Coords?
    var destCoords: Coords?
    var stops: [LoadStop]
    var deliveryDate: String?
    var createdAt: String
    var loadRef: String?
    var broker: String?

    init(id: String, data: [String: Any]) {
        self.id = id
        self.companyId = data["companyId"] as? String ?? ""
        self.assignedDriverId = data["assignedDriverId"] as? String
        self.assignedDriverName = data["assignedDriverName"] as? String
        self.origin = data["origin"] as? String ?? ""
        self.destination = data["destination"] as? String ?? ""
        self.payout = data["payout"] as? String ?? ""
        self.miles = data["miles"] as? String ?? ""
        self.type = data["type"] as? String ?? "Dry Van"
        self.status = data["status"] as? String ?? "available"
        if let oc = data["originCoords"] as? [String: Any],
           let lat = oc["latitude"] as? Double,
           let lon = oc["longitude"] as? Double {
            self.originCoords = Coords(latitude: lat, longitude: lon)
        }
        if let dc = data["destCoords"] as? [String: Any],
           let lat = dc["latitude"] as? Double,
           let lon = dc["longitude"] as? Double {
            self.destCoords = Coords(latitude: lat, longitude: lon)
        }
        self.stops = Self.parseStops(data["stops"])
        self.deliveryDate = data["deliveryDate"] as? String
        self.createdAt = data["createdAt"] as? String ?? ""
        self.loadRef = data["loadRef"] as? String
        self.broker = data["broker"] as? String
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    static func == (lhs: Load, rhs: Load) -> Bool {
        lhs.id == rhs.id
    }

    private static func parseStops(_ raw: Any?) -> [LoadStop] {
        guard let arr = raw as? [[String: Any]] else { return [] }
        return arr.compactMap { item in
            guard let type = item["type"] as? String,
                  let address = item["address"] as? String,
                  let sequence = item["sequence"] as? Int,
                  let coords = item["coords"] as? [String: Any],
                  let lat = coords["latitude"] as? Double,
                  let lon = coords["longitude"] as? Double
            else { return nil }
            return LoadStop(
                type: type,
                address: address,
                coords: Coords(latitude: lat, longitude: lon),
                sequence: sequence
            )
        }
        .sorted { $0.sequence < $1.sequence }
    }
}

struct InspectionItem: Codable, Equatable, Identifiable {
    var id: String { name }
    var name: String
    var status: String?
    var notes: String?
    var photoUrl: String?
}

struct InspectionSection: Codable, Equatable, Identifiable {
    var id: String
    var title: String
    var type: String
    var items: [InspectionItem]
}

struct Inspection: Identifiable, Equatable {
    let id: String
    var companyId: String
    var driverId: String
    var driverName: String
    var truckNumber: String
    var trailerNumber: String?
    var status: String
    var sections: [InspectionSection]
    var signatureUrl: String?
    var createdAt: String

    init(id: String, data: [String: Any]) {
        self.id = id
        self.companyId = data["companyId"] as? String ?? ""
        self.driverId = data["driverId"] as? String ?? ""
        self.driverName = data["driverName"] as? String ?? ""
        self.truckNumber = data["truckNumber"] as? String ?? ""
        self.trailerNumber = data["trailerNumber"] as? String
        self.status = data["status"] as? String ?? "PASS"
        self.signatureUrl = data["signatureUrl"] as? String
        self.createdAt = data["createdAt"] as? String ?? ""
        if let sectionsData = data["sections"] as? [[String: Any]] {
            self.sections = sectionsData.compactMap { sec in
                guard let sid = sec["id"] as? String,
                      let title = sec["title"] as? String,
                      let type = sec["type"] as? String,
                      let itemsRaw = sec["items"] as? [[String: Any]]
                else { return nil }
                let items = itemsRaw.compactMap { item -> InspectionItem? in
                    guard let name = item["name"] as? String else { return nil }
                    return InspectionItem(
                        name: name,
                        status: item["status"] as? String,
                        notes: item["notes"] as? String,
                        photoUrl: item["photoUrl"] as? String
                    )
                }
                return InspectionSection(id: sid, title: title, type: type, items: items)
            }
        } else {
            self.sections = []
        }
    }
}

enum MaintenanceUnitType: String, CaseIterable, Identifiable, Codable {
    case truck
    case trailer
    var id: String { rawValue }
    var title: String { rawValue.capitalized }
}

enum MaintenanceCategory: String, CaseIterable, Identifiable, Codable {
    case oil, tires, brakes, electrical, cooling, coupling, body, DOT, other
    var id: String { rawValue }
    var title: String {
        switch self {
        case .DOT: return "DOT"
        default: return rawValue.capitalized
        }
    }
}

struct MaintenanceLog: Identifiable, Equatable, Hashable {
    let id: String
    var companyId: String
    var unitType: MaintenanceUnitType
    var unitNumber: String
    var serviceDate: String
    var category: MaintenanceCategory
    var description: String
    var odometerMiles: Int?
    var shopName: String?
    var cost: Double?
    var performedByName: String
    var createdByUid: String
    var notes: String?
    var createdAt: String

    init(id: String, data: [String: Any]) {
        self.id = id
        self.companyId = data["companyId"] as? String ?? ""
        self.unitType = MaintenanceUnitType(rawValue: data["unitType"] as? String ?? "truck") ?? .truck
        self.unitNumber = data["unitNumber"] as? String ?? ""
        self.serviceDate = data["serviceDate"] as? String ?? ""
        self.category = MaintenanceCategory(rawValue: data["category"] as? String ?? "other") ?? .other
        self.description = data["description"] as? String ?? ""
        self.odometerMiles = data["odometerMiles"] as? Int
        self.shopName = data["shopName"] as? String
        if let c = data["cost"] as? Double {
            self.cost = c
        } else if let n = data["cost"] as? NSNumber {
            self.cost = n.doubleValue
        } else {
            self.cost = nil
        }
        self.performedByName = data["performedByName"] as? String ?? ""
        self.createdByUid = data["createdByUid"] as? String ?? ""
        self.notes = data["notes"] as? String
        self.createdAt = data["createdAt"] as? String ?? ""
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    static func == (lhs: MaintenanceLog, rhs: MaintenanceLog) -> Bool {
        lhs.id == rhs.id
    }

    func toFirestore() -> [String: Any] {
        var data: [String: Any] = [
            "companyId": companyId,
            "unitType": unitType.rawValue,
            "unitNumber": unitNumber,
            "serviceDate": serviceDate,
            "category": category.rawValue,
            "description": description,
            "performedByName": performedByName,
            "createdByUid": createdByUid,
            "createdAt": createdAt,
        ]
        data["odometerMiles"] = odometerMiles as Any
        data["shopName"] = shopName as Any
        data["cost"] = cost as Any
        data["notes"] = notes as Any
        return data
    }
}

struct WeatherPeriod: Equatable {
    var name: String
    var temperature: Int
    var temperatureUnit: String
    var windSpeed: String
    var shortForecast: String
}

struct WeatherAlert: Equatable, Identifiable {
    var id: String
    var event: String
    var severity: String
    var headline: String
}

struct LocationWeather: Equatable {
    var label: String
    var periods: [WeatherPeriod]
    var alerts: [WeatherAlert]
    var hasAdverseConditions: Bool
    var available: Bool

    init(data: [String: Any]) {
        self.label = data["label"] as? String ?? ""
        self.hasAdverseConditions = data["hasAdverseConditions"] as? Bool ?? false
        self.available = data["available"] as? Bool ?? false
        self.periods = (data["periods"] as? [[String: Any]] ?? []).map { p in
            WeatherPeriod(
                name: p["name"] as? String ?? "",
                temperature: p["temperature"] as? Int ?? 0,
                temperatureUnit: p["temperatureUnit"] as? String ?? "F",
                windSpeed: p["windSpeed"] as? String ?? "",
                shortForecast: p["shortForecast"] as? String ?? ""
            )
        }
        self.alerts = (data["alerts"] as? [[String: Any]] ?? []).map { a in
            WeatherAlert(
                id: a["id"] as? String ?? UUID().uuidString,
                event: a["event"] as? String ?? "",
                severity: a["severity"] as? String ?? "",
                headline: a["headline"] as? String ?? ""
            )
        }
    }
}

struct RouteWeather: Equatable {
    var origin: LocationWeather
    var destination: LocationWeather

    init(data: [String: Any]) {
        self.origin = LocationWeather(data: data["origin"] as? [String: Any] ?? [:])
        self.destination = LocationWeather(data: data["destination"] as? [String: Any] ?? [:])
    }
}

enum PTIStepDefinition {
    static let steps: [(id: String, title: String, type: String, items: [String])] = [
        ("engine", "Engine Compartment", "Truck", ["Oil Level", "Coolant Level", "Belts & Hoses"]),
        ("cab", "Cab/Start", "Truck", ["Oil Pressure Gauge", "Wipers", "Horn", "Mirrors"]),
        ("lights", "Lights/Reflectors", "Truck", ["Headlights", "Turn Signals", "Reflectors"]),
        ("brakes", "Brakes", "Truck", ["Air Leaks", "Brake Shoes/Drums"]),
        ("tires", "Tires/Wheels", "Truck", ["Tire Tread", "Lug Nuts"]),
        ("coupling", "Coupling System", "Trailer", ["Fifth Wheel", "Kingpin"]),
        ("air", "Air Lines", "Trailer", ["Glad Hands", "Air Hoses"]),
        ("gear", "Landing Gear", "Trailer", ["Crank Handle", "Legs"]),
        ("tires_trl", "Tires", "Trailer", ["Tire Tread", "Lug Nuts"]),
        ("lights_trl", "Tail/Brake Lights", "Trailer", ["Brake Lights", "Turn Signals"]),
    ]
}
