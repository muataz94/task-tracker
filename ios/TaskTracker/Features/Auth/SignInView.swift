import SwiftUI
import GoogleSignInSwift

struct SignInView: View {
  @Environment(SessionStore.self) private var session

  var body: some View {
    VStack(spacing: 24) {
      Image(systemName: "checklist")
        .font(.system(size: 52, weight: .semibold))
        .foregroundStyle(.tint)

      VStack(spacing: 8) {
        Text("Task Tracker")
          .font(.largeTitle.weight(.bold))
        Text("Sign in to continue to your workspace.")
          .font(.body)
          .foregroundStyle(.secondary)
          .multilineTextAlignment(.center)
      }

      GoogleSignInButton {
        Task { await session.signIn() }
      }
      .frame(width: 240, height: 48)

      if let message = session.errorMessage {
        Text(message)
          .font(.footnote)
          .foregroundStyle(.red)
          .multilineTextAlignment(.center)
      }
    }
    .padding(28)
  }
}
