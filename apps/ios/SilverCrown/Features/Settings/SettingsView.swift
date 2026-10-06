import SwiftUI

struct SettingsView: View {
    @AppStorage(AppearanceStore.storageKey) private var appearanceRaw = AppearanceMode.system.rawValue

    private var appearanceBinding: Binding<AppearanceMode> {
        Binding(
            get: { AppearanceMode(rawValue: appearanceRaw) ?? .system },
            set: { appearanceRaw = $0.rawValue }
        )
    }

    var body: some View {
        Form {
            Section {
                Picker("Appearance", selection: appearanceBinding) {
                    ForEach(AppearanceMode.allCases) { mode in
                        Text(mode.title).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                Text(appearanceBinding.wrappedValue.hint)
                    .font(.footnote)
                    .foregroundStyle(ThemeColor.onSurfaceVariant)
            } header: {
                Text("Appearance")
            } footer: {
                Text("Applies on this device only.")
            }

            Section("Preferences") {
                Text("Units, default truck numbers, and map app preference will appear here.")
                    .font(.footnote)
                    .foregroundStyle(ThemeColor.onSurfaceVariant)
            }

            Section("About") {
                LabeledContent("App", value: "Silver Crown PTI")
                LabeledContent("Version", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0")
            }
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .frame(maxWidth: LayoutMetrics.settingsMaxWidth)
        .frame(maxWidth: .infinity)
    }
}
