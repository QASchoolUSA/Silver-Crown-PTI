import SwiftUI

struct DriverShellView: View {
    let profile: AppUser
    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        Group {
            if sizeClass == .regular {
                PadDriverShell(profile: profile)
            } else {
                PhoneDriverShell(profile: profile)
            }
        }
    }
}

struct AdminShellView: View {
    let profile: AppUser
    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        Group {
            if sizeClass == .regular {
                PadAdminShell(profile: profile)
            } else {
                PhoneAdminShell(profile: profile)
            }
        }
    }
}

struct PhoneDriverShell: View {
    let profile: AppUser

    var body: some View {
        TabView {
            NavigationStack {
                LoadBoardView(profile: profile, companyWide: false)
            }
            .tabItem { Label("Loads", systemImage: "truck.box") }

            NavigationStack {
                InspectionsListView(profile: profile, companyWide: false)
            }
            .tabItem { Label("PTI", systemImage: "checklist") }

            NavigationStack {
                MaintenanceListView(profile: profile)
            }
            .tabItem { Label("Maintenance", systemImage: "wrench.and.screwdriver") }

            NavigationStack {
                ProfileView(profile: profile)
            }
            .tabItem { Label("Profile", systemImage: "person.crop.circle") }
        }
    }
}

struct PhoneAdminShell: View {
    let profile: AppUser

    var body: some View {
        TabView {
            NavigationStack {
                LoadBoardView(profile: profile, companyWide: true)
            }
            .tabItem { Label("Loads", systemImage: "truck.box") }

            NavigationStack {
                InspectionsListView(profile: profile, companyWide: true)
            }
            .tabItem { Label("PTIs", systemImage: "checklist") }

            NavigationStack {
                MaintenanceListView(profile: profile)
            }
            .tabItem { Label("Maintenance", systemImage: "wrench.and.screwdriver") }

            NavigationStack {
                ProfileView(profile: profile)
            }
            .tabItem { Label("Profile", systemImage: "person.crop.circle") }
        }
    }
}

enum PadDestination: Hashable {
    case loads
    case inspections
    case maintenance
    case profile
}

struct PadDriverShell: View {
    let profile: AppUser
    @State private var selection: PadDestination? = .loads

    var body: some View {
        NavigationSplitView {
            List(selection: $selection) {
                Label("Loads", systemImage: "truck.box").tag(PadDestination.loads)
                Label("PTI", systemImage: "checklist").tag(PadDestination.inspections)
                Label("Maintenance", systemImage: "wrench.and.screwdriver").tag(PadDestination.maintenance)
                Label("Profile", systemImage: "person.crop.circle").tag(PadDestination.profile)
            }
            .navigationTitle("Silver Crown")
        } detail: {
            switch selection ?? .loads {
            case .loads:
                NavigationStack { LoadBoardView(profile: profile, companyWide: false) }
            case .inspections:
                NavigationStack { InspectionsListView(profile: profile, companyWide: false) }
            case .maintenance:
                NavigationStack { MaintenanceListView(profile: profile) }
            case .profile:
                NavigationStack { ProfileView(profile: profile) }
            }
        }
    }
}

struct PadAdminShell: View {
    let profile: AppUser
    @State private var selection: PadDestination? = .loads

    var body: some View {
        NavigationSplitView {
            List(selection: $selection) {
                Label("Loads", systemImage: "truck.box").tag(PadDestination.loads)
                Label("PTIs", systemImage: "checklist").tag(PadDestination.inspections)
                Label("Maintenance", systemImage: "wrench.and.screwdriver").tag(PadDestination.maintenance)
                Label("Profile", systemImage: "person.crop.circle").tag(PadDestination.profile)
            }
            .navigationTitle("Silver Crown")
        } detail: {
            switch selection ?? .loads {
            case .loads:
                NavigationStack { LoadBoardView(profile: profile, companyWide: true) }
            case .inspections:
                NavigationStack { InspectionsListView(profile: profile, companyWide: true) }
            case .maintenance:
                NavigationStack { MaintenanceListView(profile: profile) }
            case .profile:
                NavigationStack { ProfileView(profile: profile) }
            }
        }
    }
}
