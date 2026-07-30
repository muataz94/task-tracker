import SwiftUI
import GoogleSignIn

@main
struct TaskTrackerApp: App {
  @State private var session = SessionStore()
  @State private var router = AppRouter()
  @State private var intentRouter = AppIntentRouter.shared

  var body: some Scene {
    WindowGroup {
      RootView()
        .environment(session)
        .environment(router)
        .environment(intentRouter)
        .environment(TaskTrackerAPI.shared)
        .onOpenURL { url in
          GIDSignIn.sharedInstance.handle(url)
        }
        .onChange(of: intentRouter.pendingRoute) { _, route in
          guard let route else { return }
          router.apply(route)
          intentRouter.pendingRoute = nil
        }
    }
  }
}

struct RootView: View {
  @Environment(SessionStore.self) private var session

  var body: some View {
    Group {
      if session.isSignedIn {
        AppShellView()
      } else {
        SignInView()
      }
    }
    .task {
      await session.restorePreviousSignIn()
    }
  }
}
