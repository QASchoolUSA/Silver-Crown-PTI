import SwiftUI

struct AuthStackView: View {
    var body: some View {
        NavigationStack {
            LoginView()
        }
    }
}

struct LoginView: View {
    @State private var email = ""
    @State private var password = ""
    @State private var error: String?
    @State private var busy = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.xl) {
                VStack(alignment: .leading, spacing: Spacing.sm) {
                    Text("SILVER CROWN")
                        .font(SCFont.display(44))
                        .foregroundStyle(ThemeColor.primary)
                        .tracking(4)
                    Text("Sign in to run PTIs, check loads, and log unit service.")
                        .font(SCFont.subheadline)
                        .foregroundStyle(ThemeColor.onSurfaceVariant)
                }
                .scAppearFade()

                VStack(spacing: Spacing.md) {
                    TextField("Email", text: $email)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                        .textFieldStyle(SCFieldStyle())
                    SecureField("Password", text: $password)
                        .textFieldStyle(SCFieldStyle())
                }

                if let error {
                    Text(error)
                        .font(SCFont.caption)
                        .foregroundStyle(ThemeColor.error)
                }

                Button {
                    Task { await signIn() }
                } label: {
                    if busy {
                        ProgressView().tint(ThemeColor.onPrimary)
                    } else {
                        Text("Sign In")
                    }
                }
                .buttonStyle(SCPrimaryButtonStyle())
                .disabled(busy)

                NavigationLink {
                    SignUpView()
                } label: {
                    Text("Create account with invite code")
                        .font(SCFont.subheadline)
                        .fontWeight(.semibold)
                        .foregroundStyle(ThemeColor.primary)
                }
            }
            .padding(Spacing.xl)
            .frame(maxWidth: LayoutMetrics.settingsMaxWidth)
            .frame(maxWidth: .infinity)
        }
        .background(
            LinearGradient(
                colors: [ThemeColor.surface, ThemeColor.surfaceContainerLow],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
        )
        .navigationBarHidden(true)
    }

    private func signIn() async {
        busy = true
        error = nil
        defer { busy = false }
        do {
            try await AuthRepository.signIn(email: email.trimmingCharacters(in: .whitespaces), password: password)
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct SignUpView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var invite = ""
    @State private var error: String?
    @State private var busy = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                Text("JOIN FLEET")
                    .font(SCFont.sectionTitle)
                    .foregroundStyle(ThemeColor.primary)
                    .tracking(1.5)

                Text("Use your company invite code to create a driver or admin account.")
                    .font(SCFont.subheadline)
                    .foregroundStyle(ThemeColor.onSurfaceVariant)

                SCCard {
                    VStack(spacing: Spacing.md) {
                        TextField("Full name", text: $name)
                            .textFieldStyle(SCFieldStyle())
                        TextField("Email", text: $email)
                            .textInputAutocapitalization(.never)
                            .keyboardType(.emailAddress)
                            .textFieldStyle(SCFieldStyle())
                        SecureField("Password", text: $password)
                            .textFieldStyle(SCFieldStyle())
                        TextField("Invite code", text: $invite)
                            .textInputAutocapitalization(.characters)
                            .textFieldStyle(SCFieldStyle())
                    }
                }

                if let error {
                    Text(error).font(SCFont.caption).foregroundStyle(ThemeColor.error)
                }

                Button(busy ? "Creating…" : "Create Account") {
                    Task { await signUp() }
                }
                .buttonStyle(SCPrimaryButtonStyle())
                .disabled(busy)
            }
            .padding(Spacing.xl)
            .frame(maxWidth: LayoutMetrics.settingsMaxWidth)
            .frame(maxWidth: .infinity)
        }
        .background(ThemeColor.surface.ignoresSafeArea())
        .navigationTitle("Sign Up")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func signUp() async {
        busy = true
        error = nil
        defer { busy = false }
        do {
            try await AuthRepository.signUp(
                email: email.trimmingCharacters(in: .whitespaces),
                password: password,
                displayName: name.trimmingCharacters(in: .whitespaces),
                inviteCode: invite.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
            )
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
    }
}
