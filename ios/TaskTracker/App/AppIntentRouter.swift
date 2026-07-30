import Foundation
import Observation

enum IntentRoute: Equatable {
  case section(AppTab)
  case addTask(TaskDraft)
}

@MainActor
@Observable
final class AppIntentRouter {
  static let shared = AppIntentRouter()
  var pendingRoute: IntentRoute?

  private init() {}
}
