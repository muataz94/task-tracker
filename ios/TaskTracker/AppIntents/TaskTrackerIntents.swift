import AppIntents
import Foundation

enum TaskTrackerSectionIntentValue: String, AppEnum {
  case dashboard
  case tasks
  case kanban
  case settings

  static var typeDisplayName: LocalizedStringResource { "Section" }
  static let typeDisplayRepresentation: TypeDisplayRepresentation = "Section"

  static var caseDisplayRepresentations: [Self: DisplayRepresentation] {
    [
      .dashboard: "Dashboard",
      .tasks: "Tasks",
      .kanban: "Kanban",
      .settings: "Settings"
    ]
  }

  var tab: AppTab {
    switch self {
    case .dashboard: .dashboard
    case .tasks: .tasks
    case .kanban: .kanban
    case .settings: .settings
    }
  }
}

struct OpenTaskTrackerSectionIntent: AppIntent {
  static let title: LocalizedStringResource = "Open Task Tracker Section"
  static let description = IntentDescription("Open Task Tracker to a selected section.")
  static let openAppWhenRun = true

  @Parameter(title: "Section")
  var section: TaskTrackerSectionIntentValue

  func perform() async throws -> some IntentResult {
    await MainActor.run {
      AppIntentRouter.shared.pendingRoute = .section(section.tab)
    }
    return .result()
  }
}

struct OpenAddTaskIntent: AppIntent {
  static let title: LocalizedStringResource = "Open Add Task"
  static let description = IntentDescription("Open Task Tracker with a new task draft.")
  static let openAppWhenRun = true

  @Parameter(title: "Title")
  var title: String?

  @Parameter(title: "Project")
  var project: String?

  @Parameter(title: "Assignee")
  var assignee: String?

  @Parameter(title: "Due Date")
  var dueDate: String?

  func perform() async throws -> some IntentResult {
    let draft = TaskDraft(
      title: title ?? "",
      project: project ?? "",
      assignee: assignee ?? "",
      dueDate: dueDate ?? "",
      priority: .medium,
      status: .open,
      description: ""
    )

    await MainActor.run {
      AppIntentRouter.shared.pendingRoute = .addTask(draft)
    }

    return .result()
  }
}

struct QuickCreateTaskIntent: AppIntent {
  static let title: LocalizedStringResource = "Quick Create Task"
  static let description = IntentDescription("Create a Task Tracker task without opening the app.")
  static let openAppWhenRun = false

  @Parameter(title: "Title")
  var title: String

  @Parameter(title: "Project")
  var project: String

  @Parameter(title: "Due Date")
  var dueDate: String?

  func perform() async throws -> some IntentResult & ProvidesDialog {
    guard let token = KeychainTokenStore.read() else {
      return .result(dialog: "Open Task Tracker and sign in first.")
    }

    let draft = TaskDraft(
      title: title,
      project: project,
      assignee: "",
      dueDate: dueDate ?? "",
      priority: .medium,
      status: .open,
      description: ""
    )

    do {
      _ = try await TaskTrackerAPI.shared.createTask(draft, token: token)
      return .result(dialog: "Created \(title).")
    } catch {
      return .result(dialog: "Could not create the task. Open Task Tracker and sign in again.")
    }
  }
}

struct TaskTrackerShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: OpenTaskTrackerSectionIntent(),
      phrases: [
        "Open \(.applicationName)",
        "Open tasks in \(.applicationName)"
      ],
      shortTitle: "Open Section",
      systemImageName: "rectangle.3.group"
    )

    AppShortcut(
      intent: OpenAddTaskIntent(),
      phrases: [
        "Add a task in \(.applicationName)",
        "Create a task draft in \(.applicationName)"
      ],
      shortTitle: "Add Task",
      systemImageName: "plus.circle"
    )

    AppShortcut(
      intent: QuickCreateTaskIntent(),
      phrases: [
        "Quick create task with \(.applicationName)",
        "Create task with \(.applicationName)"
      ],
      shortTitle: "Quick Create",
      systemImageName: "checkmark.circle"
    )
  }
}
