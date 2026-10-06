import SwiftUI

struct RootView: View {
    @EnvironmentObject private var appModel: AppModel

    var body: some View {
        Group {
            switch appModel.authState {
            case .loading:
                VStack(spacing: Spacing.lg) {
                    Text("SILVER CROWN")
                        .font(SCFont.display(36))
                        .foregroundStyle(ThemeColor.primary)
                        .tracking(3)
                    ProgressView()
                        .tint(ThemeColor.primary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(ThemeColor.surface.ignoresSafeArea())
            case .signedOut:
                AuthStackView()
            case .signedIn:
                if let profile = appModel.profile {
                    if profile.role == .admin {
                        AdminShellView(profile: profile)
                    } else {
                        DriverShellView(profile: profile)
                    }
                } else {
                    ProgressView()
                }
            }
        }
        .animation(.easeInOut(duration: 0.2), value: appModel.authState == .signedIn)
    }
}
