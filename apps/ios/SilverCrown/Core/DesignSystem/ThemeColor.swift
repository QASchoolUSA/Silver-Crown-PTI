import SwiftUI

enum ThemeColor {
    static let surface = Color("Surface")
    static let surfaceContainerLow = Color("SurfaceContainerLow")
    static let surfaceContainer = Color("SurfaceContainer")
    static let surfaceContainerHigh = Color("SurfaceContainerHigh")
    static let onSurface = Color("OnSurface")
    static let onSurfaceVariant = Color("OnSurfaceVariant")
    static let outlineVariant = Color("OutlineVariant")
    static let primary = Color("Primary")
    static let onPrimary = Color("OnPrimary")
    static let error = Color("Error")
    static let success = Color("Success")
    static let caution = Color("Caution")
    static let statusAvailable = Color("StatusAvailable")
    static let statusInTransit = Color("StatusInTransit")
    static let statusDelivered = Color("StatusDelivered")

    static func loadStatus(_ status: String) -> Color {
        switch status {
        case "in_transit": return statusInTransit
        case "delivered": return statusDelivered
        default: return statusAvailable
        }
    }

    static func inspectionStatus(_ status: String) -> Color {
        status == "PASS" ? success : error
    }
}

enum AppearanceMode: String, CaseIterable, Identifiable {
    case system
    case light
    case dark

    var id: String { rawValue }

    var title: String {
        switch self {
        case .system: return "System"
        case .light: return "Light"
        case .dark: return "Dark"
        }
    }

    var hint: String {
        switch self {
        case .system: return "Match device setting"
        case .light: return "Daylight surfaces"
        case .dark: return "Low-glare night UI"
        }
    }

    var colorScheme: ColorScheme? {
        switch self {
        case .system: return nil
        case .light: return .light
        case .dark: return .dark
        }
    }

    static let storageKey = "silvercrown.appearance"
}

enum AppearanceStore {
    static let storageKey = AppearanceMode.storageKey
}

enum LayoutMetrics {
    static let settingsMaxWidth: CGFloat = 600
    static let listColumnMin: CGFloat = 320
    static let mapHeroHeight: CGFloat = 220
    static let mapBoardMinHeight: CGFloat = 360
}

enum Spacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 24
    static let xxl: CGFloat = 32
}

enum Radius {
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
}
