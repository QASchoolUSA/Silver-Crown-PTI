import Foundation
import Combine
import FirebaseAuth
import FirebaseFirestore

@MainActor
final class AppModel: ObservableObject {
    @Published private(set) var authState: AuthState = .loading
    @Published private(set) var profile: AppUser?
    @Published var errorMessage: String?

    private var authHandle: AuthStateDidChangeListenerHandle?
    private var profileListener: ListenerRegistration?

    enum AuthState: Equatable {
        case loading
        case signedOut
        case signedIn
    }

    init() {
        startAuthListener()
    }

    deinit {
        if let authHandle {
            Auth.auth().removeStateDidChangeListener(authHandle)
        }
        profileListener?.remove()
    }

    private func startAuthListener() {
        authHandle = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            Task { @MainActor in
                guard let self else { return }
                self.profileListener?.remove()
                self.profileListener = nil
                guard let user else {
                    self.profile = nil
                    self.authState = .signedOut
                    return
                }
                self.authState = .loading
                self.listenToProfile(uid: user.uid)
            }
        }
    }

    private func listenToProfile(uid: String) {
        profileListener = Firestore.firestore().collection("users").document(uid)
            .addSnapshotListener { [weak self] snap, error in
                Task { @MainActor in
                    guard let self else { return }
                    if let error {
                        self.errorMessage = error.localizedDescription
                        self.profile = nil
                        self.authState = .signedOut
                        return
                    }
                    guard let data = snap?.data() else {
                        self.profile = nil
                        self.authState = .signedOut
                        return
                    }
                    self.profile = AppUser(id: uid, data: data)
                    self.authState = .signedIn
                }
            }
    }

    func signOut() {
        do {
            try Auth.auth().signOut()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
