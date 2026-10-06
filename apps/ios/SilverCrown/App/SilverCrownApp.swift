import SwiftUI
import FirebaseCore

@main
struct SilverCrownApp: App {
    @AppStorage(AppearanceStore.storageKey) private var appearanceRaw = AppearanceMode.system.rawValue
    @StateObject private var appModel = AppModel()

    init() {
        FirebaseApp.configure()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appModel)
                .preferredColorScheme(AppearanceMode(rawValue: appearanceRaw)?.colorScheme)
                .tint(ThemeColor.primary)
        }
    }
}
