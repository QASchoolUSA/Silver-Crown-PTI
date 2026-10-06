import SwiftUI

struct ProfileView: View {
    let profile: AppUser
    @EnvironmentObject private var appModel: AppModel
    @State private var companyName: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                SCCard {
                    HStack(spacing: Spacing.lg) {
                        ZStack {
                            Circle()
                                .fill(ThemeColor.primary.opacity(0.18))
                                .frame(width: 64, height: 64)
                            Text(initials)
                                .font(SCFont.headline)
                                .foregroundStyle(ThemeColor.primary)
                        }
                        VStack(alignment: .leading, spacing: 4) {
                            Text(profile.displayName)
                                .font(SCFont.sectionTitle)
                                .foregroundStyle(ThemeColor.onSurface)
                            Text(profile.role.rawValue.uppercased())
                                .font(SCFont.captionBold)
                                .foregroundStyle(ThemeColor.primary)
                                .tracking(1)
                            if let companyName {
                                Text(companyName)
                                    .font(SCFont.caption)
                                    .foregroundStyle(ThemeColor.onSurfaceVariant)
                            }
                        }
                        Spacer()
                    }
                }
                .scAppearFade()

                SCCard {
                    VStack(alignment: .leading, spacing: Spacing.md) {
                        Text("ACCOUNT")
                            .font(SCFont.captionBold)
                            .foregroundStyle(ThemeColor.onSurfaceVariant)
                            .tracking(1)
                        labeled("Email", profile.email)
                        labeled("Role", profile.role.rawValue.capitalized)
                        if let companyName {
                            labeled("Company", companyName)
                        }
                    }
                }

                if profile.role == .driver, !profile.equipmentTypes.isEmpty {
                    SCCard {
                        VStack(alignment: .leading, spacing: Spacing.md) {
                            Text("AUTHORIZED EQUIPMENT")
                                .font(SCFont.captionBold)
                                .foregroundStyle(ThemeColor.onSurfaceVariant)
                                .tracking(1)
                            FlowChips(items: profile.equipmentTypes)
                        }
                    }
                }

                NavigationLink {
                    SettingsView()
                } label: {
                    Label("Settings", systemImage: "gearshape.fill")
                        .font(SCFont.button)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(Spacing.lg)
                        .background(ThemeColor.surfaceContainer)
                        .foregroundStyle(ThemeColor.onSurface)
                        .clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                                .stroke(ThemeColor.outlineVariant.opacity(0.55), lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)

                Button("Sign Out", role: .destructive) {
                    appModel.signOut()
                }
                .font(SCFont.button)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(ThemeColor.error.opacity(0.12))
                .foregroundStyle(ThemeColor.error)
                .clipShape(RoundedRectangle(cornerRadius: Radius.sm, style: .continuous))
            }
            .padding(Spacing.lg)
        }
        .background(ThemeColor.surface.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text("PROFILE")
                    .font(SCFont.sectionTitle)
                    .foregroundStyle(ThemeColor.primary)
                    .tracking(1.5)
            }
        }
        .task {
            companyName = await CompanyRepository.getCompanyName(companyId: profile.companyId)
        }
    }

    private var initials: String {
        let parts = profile.displayName.split(separator: " ")
        let letters = parts.prefix(2).compactMap { $0.first.map(String.init) }
        return letters.joined().uppercased()
    }

    private func labeled(_ title: String, _ value: String) -> some View {
        HStack {
            Text(title).font(SCFont.caption).foregroundStyle(ThemeColor.onSurfaceVariant)
            Spacer()
            Text(value).font(SCFont.subheadline).foregroundStyle(ThemeColor.onSurface)
        }
    }
}

struct FlowChips: View {
    let items: [String]

    var body: some View {
        FlexibleChipWrap(items: items)
    }
}

private struct FlexibleChipWrap: View {
    let items: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            ForEach(items, id: \.self) { item in
                SCStatusChip(text: item, color: ThemeColor.primary)
            }
        }
    }
}
