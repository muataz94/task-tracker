import SwiftUI

struct TasksView: View {
  @Environment(SessionStore.self) private var session
  @Environment(TaskTrackerAPI.self) private var api
  @Environment(AppRouter.self) private var router
  @State private var tasks: [TaskItem] = []
  @State private var isLoading = false
  @State private var errorMessage: String?
  @State private var searchText = ""

  private var filteredTasks: [TaskItem] {
    guard !searchText.isEmpty else { return tasks }
    return tasks.filter {
      $0.title.localizedCaseInsensitiveContains(searchText) ||
      ($0.project ?? "").localizedCaseInsensitiveContains(searchText) ||
      ($0.assignee ?? "").localizedCaseInsensitiveContains(searchText)
    }
  }

  var body: some View {
    List {
      if let errorMessage {
        Text(errorMessage)
          .foregroundStyle(.red)
      }

      ForEach(filteredTasks) { task in
        TaskRow(task: task)
      }
    }
    .overlay {
      if isLoading {
        ProgressView()
      } else if filteredTasks.isEmpty && errorMessage == nil {
        ContentUnavailableView("No tasks", systemImage: "checklist", description: Text("Create your first task from the plus button."))
      }
    }
    .navigationTitle("Tasks")
    .searchable(text: $searchText)
    .toolbar {
      Button {
        router.presentedSheet = .addTask(TaskDraft())
      } label: {
        Image(systemName: "plus")
      }
    }
    .refreshable {
      await load()
    }
    .task {
      await load()
    }
  }

  private func load() async {
    guard !isLoading else { return }
    guard let token = session.idToken else {
      errorMessage = "Please sign in again."
      return
    }

    isLoading = true
    defer { isLoading = false }

    do {
      tasks = try await api.tasks(token: token)
      errorMessage = nil
    } catch {
      errorMessage = error.localizedDescription
    }
  }
}

struct TaskRow: View {
  var task: TaskItem

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack {
        Text(task.title)
          .font(.headline)
        Spacer()
        Text(task.priority.title)
          .font(.caption.weight(.semibold))
          .padding(.horizontal, 8)
          .padding(.vertical, 4)
          .background(.tint.opacity(0.12), in: Capsule())
      }

      HStack(spacing: 8) {
        Label(task.status.title, systemImage: "circle.fill")
        if let dueDate = task.dueDate, !dueDate.isEmpty {
          Label(dueDate, systemImage: "calendar")
        }
      }
      .font(.caption)
      .foregroundStyle(.secondary)

      if let project = task.project, !project.isEmpty {
        Text(project)
          .font(.caption)
          .foregroundStyle(.secondary)
      }
    }
    .padding(.vertical, 6)
  }
}
