import SwiftUI

struct ProfileView: View {
    let profile: AppUser
    @EnvironmentObject private var appModel: AppModel
    @State private var companyName: String?

    var body: some View {
        List {
            Section("Account") {
                LabeledContent("Name", value: profile.displayName)
                LabeledContent("Email", value: profile.email)
                LabeledContent("Role", value: profile.role.rawValue.capitalized)
                if let companyName {
                    LabeledContent("Company", value: companyName)
                }
            }

            if profile.role == .driver, !profile.equipmentTypes.isEmpty {
                Section("Authorized Equipment") {
                    ForEach(profile.equipmentTypes, id: \.self) { type in
                        Text(type)
                    }
                }
            }

            Section {
                NavigationLink {
                    SettingsView()
                } label: {
                    Label("Settings", systemImage: "gearshape")
                }
            }

            Section {
                Button("Sign Out", role: .destructive) {
                    appModel.signOut()
                }
            }
        }
        .navigationTitle("Profile")
        .task {
            companyName = await CompanyRepository.getCompanyName(companyId: profile.companyId)
        }
    }
}
