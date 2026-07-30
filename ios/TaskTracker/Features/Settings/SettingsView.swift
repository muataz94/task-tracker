import SwiftUI

struct SettingsView: View {
  @Environment(SessionStore.self) private var session

  var body: some View {
    Form {
      Section("Account") {
        LabeledContent("Name", value: session.displayName.isEmpty ? "Not available" : session.displayName)
        LabeledContent("Email", value: session.email.isEmpty ? "Not available" : session.email)
      }

      Section {
        Button(role: .destructive) {
          session.signOut()
        } label: {
          Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
        }
      }
    }
    .navigationTitle("Settings")
  }
}
