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
}
