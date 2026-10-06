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
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                Text("SETTINGS")
                    .font(SCFont.sectionTitle)
                    .foregroundStyle(ThemeColor.primary)
                    .tracking(1.5)

                SCCard {
                    VStack(alignment: .leading, spacing: Spacing.md) {
                        Text("APPEARANCE")
                            .font(SCFont.captionBold)
                            .foregroundStyle(ThemeColor.onSurfaceVariant)
                            .tracking(1)
                        Picker("Appearance", selection: appearanceBinding) {
                            ForEach(AppearanceMode.allCases) { mode in
                                Text(mode.title).tag(mode)
                            }
                        }
                        .pickerStyle(.segmented)
                        Text(appearanceBinding.wrappedValue.hint)
                            .font(SCFont.caption)
                            .foregroundStyle(ThemeColor.onSurfaceVariant)
                        Text("Applies on this device only.")
                            .font(SCFont.caption)
                            .foregroundStyle(ThemeColor.onSurfaceVariant.opacity(0.8))
                    }
                }

                SCCard {
                    VStack(alignment: .leading, spacing: Spacing.sm) {
                        Text("PREFERENCES")
                            .font(SCFont.captionBold)
                            .foregroundStyle(ThemeColor.onSurfaceVariant)
                            .tracking(1)
                        Text("Units, default truck numbers, and map app preference will appear here.")
                            .font(SCFont.subheadline)
                            .foregroundStyle(ThemeColor.onSurfaceVariant)
                    }
                }

                SCCard {
                    VStack(alignment: .leading, spacing: Spacing.md) {
                        Text("ABOUT")
                            .font(SCFont.captionBold)
                            .foregroundStyle(ThemeColor.onSurfaceVariant)
                            .tracking(1)
                        labeled("App", "Silver Crown PTI")
                        labeled(
                            "Version",
                            Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
                        )
                    }
                }
            }
            .padding(Spacing.lg)
            .frame(maxWidth: LayoutMetrics.settingsMaxWidth)
            .frame(maxWidth: .infinity)
            .scAppearFade()
        }
        .background(ThemeColor.surface.ignoresSafeArea())
        .navigationTitle("Settings")
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
