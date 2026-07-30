import Foundation
import GoogleSignIn
import Observation
import SwiftUI
import UIKit

@MainActor
@Observable
final class SessionStore {
  var isSignedIn = false
  var displayName = ""
  var email = ""
  var errorMessage: String?

  var idToken: String? {
    get { KeychainTokenStore.read() }
    set {
      if let newValue {
        KeychainTokenStore.save(newValue)
      } else {
        KeychainTokenStore.clear()
      }
    }
  }

  func restorePreviousSignIn() async {
    configureGoogleSignIn()
    guard GIDSignIn.sharedInstance.hasPreviousSignIn() else { return }

    do {
      let result = try await GIDSignIn.sharedInstance.restorePreviousSignIn()
      apply(result.user)
    } catch {
      errorMessage = error.localizedDescription
    }
  }

  func signIn() async {
    configureGoogleSignIn()
    guard let presentingViewController = UIApplication.shared.firstKeyWindow?.rootViewController else {
      errorMessage = "Could not open Google Sign-In."
      return
    }

    do {
      let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: presentingViewController)
      apply(result.user)
    } catch {
      errorMessage = error.localizedDescription
    }
  }

  func signOut() {
    GIDSignIn.sharedInstance.signOut()
    idToken = nil
    displayName = ""
    email = ""
    isSignedIn = false
  }

  private func apply(_ user: GIDGoogleUser) {
    idToken = user.idToken?.tokenString
    displayName = user.profile?.name ?? ""
    email = user.profile?.email ?? ""
    isSignedIn = idToken != nil
  }

  private func configureGoogleSignIn() {
    GIDSignIn.sharedInstance.configuration = GIDConfiguration(
      clientID: TaskTrackerConfig.googleIOSClientID,
      serverClientID: TaskTrackerConfig.googleServerClientID
    )
  }
}

private extension UIApplication {
  var firstKeyWindow: UIWindow? {
    connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap(\.windows)
      .first { $0.isKeyWindow }
  }
}
