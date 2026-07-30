import SwiftUI

struct TaskEditorView: View {
  @Environment(SessionStore.self) private var session
  @Environment(TaskTrackerAPI.self) private var api
  @Environment(\.dismiss) private var dismiss
  @State private var draft: TaskDraft
  @State private var isSaving = false
  @State private var errorMessage: String?

  init(draft: TaskDraft) {
    _draft = State(initialValue: draft)
  }

  var body: some View {
    NavigationStack {
      Form {
        Section("Task") {
          TextField("Title", text: $draft.title)
          TextField("Project", text: $draft.project)
          TextField("Assignee", text: $draft.assignee)
          TextField("Due date", text: $draft.dueDate, prompt: Text("YYYY-MM-DD"))
        }

        Section("Status") {
          Picker("Priority", selection: $draft.priority) {
            ForEach(TaskPriority.allCases) { priority in
              Text(priority.title).tag(priority)
            }
          }

          Picker("Status", selection: $draft.status) {
            ForEach(TaskStatus.allCases) { status in
              Text(status.title).tag(status)
            }
          }
        }

        Section("Notes") {
          TextEditor(text: $draft.description)
            .frame(minHeight: 120)
        }

        if let errorMessage {
          Text(errorMessage)
            .foregroundStyle(.red)
        }
      }
      .navigationTitle("Add Task")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Save") {
            Task { await save() }
          }
          .disabled(draft.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || draft.project.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSaving)
        }
      }
    }
  }

  private func save() async {
    guard let token = session.idToken else {
      errorMessage = "Please sign in again."
      return
    }

    isSaving = true
    defer { isSaving = false }

    do {
      _ = try await api.createTask(draft, token: token)
      dismiss()
    } catch {
      errorMessage = error.localizedDescription
    }
  }
}
