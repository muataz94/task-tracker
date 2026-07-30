import Foundation
import Observation

enum AppTab: String, CaseIterable, Identifiable {
  case dashboard
  case tasks
  case kanban
  case settings

  var id: String { rawValue }

  var title: String {
    switch self {
    case .dashboard: "Dashboard"
    case .tasks: "Tasks"
    case .kanban: "Kanban"
    case .settings: "Settings"
    }
  }

  var systemImage: String {
    switch self {
    case .dashboard: "chart.pie"
    case .tasks: "checklist"
    case .kanban: "rectangle.3.group"
    case .settings: "gearshape"
    }
  }
}

enum SheetDestination: Identifiable {
  case addTask(TaskDraft)

  var id: String {
    switch self {
    case .addTask: "addTask"
    }
  }
}

@MainActor
@Observable
final class AppRouter {
  var selectedTab: AppTab = .dashboard
  var presentedSheet: SheetDestination?

  func apply(_ route: IntentRoute) {
    switch route {
    case .section(let tab):
      selectedTab = tab
    case .addTask(let draft):
      selectedTab = .tasks
      presentedSheet = .addTask(draft)
    }
  }
}
