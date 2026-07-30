import SwiftUI

struct KanbanView: View {
  @Environment(SessionStore.self) private var session
  @Environment(TaskTrackerAPI.self) private var api
  @State private var tasks: [TaskItem] = []
  @State private var errorMessage: String?

  var body: some View {
    ScrollView(.horizontal) {
      HStack(alignment: .top, spacing: 12) {
        ForEach(TaskStatus.allCases) { status in
          KanbanColumn(
            status: status,
            tasks: tasks.filter { $0.status == status },
            move: { task, targetStatus in
              await move(task, to: targetStatus)
            }
          )
        }
      }
      .padding()
    }
    .navigationTitle("Kanban")
    .task { await load() }
    .refreshable { await load() }
    .overlay(alignment: .bottom) {
      if let errorMessage {
        Text(errorMessage)
          .font(.footnote)
          .padding(10)
          .background(.thinMaterial, in: Capsule())
          .padding()
      }
    }
  }

  private func load() async {
    guard let token = session.idToken else {
      errorMessage = "Please sign in again."
      return
    }

    do {
      tasks = try await api.tasks(token: token)
      errorMessage = nil
    } catch {
      errorMessage = error.localizedDescription
    }
  }

  private func move(_ task: TaskItem, to status: TaskStatus) async {
    guard task.status != status, let token = session.idToken else { return }

    do {
      try await api.updateTask(id: task.id, fields: ["status": status.rawValue], token: token)
      if let index = tasks.firstIndex(where: { $0.id == task.id }) {
        tasks[index].status = status
      }
    } catch {
      errorMessage = error.localizedDescription
    }
  }
}

struct KanbanColumn: View {
  var status: TaskStatus
  var tasks: [TaskItem]
  var move: (TaskItem, TaskStatus) async -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack {
        Text(status.title)
          .font(.headline)
        Spacer()
        Text("\(tasks.count)")
          .font(.caption.weight(.semibold))
          .foregroundStyle(.secondary)
      }

      ForEach(tasks) { task in
        VStack(alignment: .leading, spacing: 10) {
          TaskRow(task: task)

          Menu {
            ForEach(TaskStatus.allCases.filter { $0 != task.status }) { targetStatus in
              Button("Move to \(targetStatus.title)") {
                Task { await move(task, targetStatus) }
              }
            }
          } label: {
            Label("Move", systemImage: "arrow.right.circle")
              .font(.caption.weight(.semibold))
          }
        }
        .padding()
        .frame(width: 280, alignment: .leading)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
      }
    }
    .frame(width: 304, alignment: .top)
    .padding(12)
    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
  }
}
