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
            VStack(alignment: .leading, spacing: 20) {
                Text("SILVER CROWN")
                    .font(.system(size: 40, weight: .bold, design: .default))
                    .foregroundStyle(ThemeColor.primary)
                    .tracking(4)
                Text("Sign in to run PTIs, check loads, and log unit service.")
                    .foregroundStyle(ThemeColor.onSurfaceVariant)
                    .font(.subheadline)

                TextField("Email", text: $email)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                    .textFieldStyle(SCFieldStyle())
                SecureField("Password", text: $password)
                    .textFieldStyle(SCFieldStyle())

                if let error {
                    Text(error).foregroundStyle(ThemeColor.error).font(.footnote)
                }

                Button {
                    Task { await signIn() }
                } label: {
                    if busy {
                        ProgressView().tint(ThemeColor.onPrimary)
                    } else {
                        Text("Sign In").fontWeight(.semibold)
                    }
                }
                .buttonStyle(SCPrimaryButtonStyle())
                .disabled(busy)

                NavigationLink("Create account with invite code") {
                    SignUpView()
                }
                .foregroundStyle(ThemeColor.primary)
                .font(.subheadline)
            }
            .padding(24)
            .frame(maxWidth: LayoutMetrics.settingsMaxWidth)
            .frame(maxWidth: .infinity)
        }
        .background(ThemeColor.surface.ignoresSafeArea())
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
        Form {
            Section("Account") {
                TextField("Full name", text: $name)
                TextField("Email", text: $email)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                SecureField("Password", text: $password)
                TextField("Invite code", text: $invite)
                    .textInputAutocapitalization(.characters)
            }
            if let error {
                Section { Text(error).foregroundStyle(ThemeColor.error) }
            }
            Section {
                Button(busy ? "Creating…" : "Create Account") {
                    Task { await signUp() }
                }
                .disabled(busy)
            }
        }
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

struct SCFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .padding(14)
            .background(ThemeColor.surfaceContainerHigh)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .foregroundStyle(ThemeColor.onSurface)
    }
}

struct SCPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(ThemeColor.primary.opacity(configuration.isPressed ? 0.85 : 1))
            .foregroundStyle(ThemeColor.onPrimary)
            .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}
