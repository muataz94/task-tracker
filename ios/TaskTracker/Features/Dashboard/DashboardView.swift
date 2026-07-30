import SwiftUI

struct DashboardView: View {
  @Environment(SessionStore.self) private var session
  @Environment(TaskTrackerAPI.self) private var api
  @State private var dashboard: DashboardResponse?
  @State private var isLoading = false
  @State private var errorMessage: String?

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 16) {
        header

        if let dashboard {
          statsGrid(dashboard)
          recentTasks(dashboard.tasks ?? [])
        } else if isLoading {
          ProgressView()
            .frame(maxWidth: .infinity, minHeight: 180)
        } else if let errorMessage {
          ContentUnavailableView("Could not load dashboard", systemImage: "wifi.exclamationmark", description: Text(errorMessage))
        }
      }
      .padding()
    }
    .navigationTitle("Dashboard")
    .toolbar {
      Button {
        Task { await load(force: true) }
      } label: {
        Image(systemName: "arrow.clockwise")
      }
    }
    .task { await load(force: false) }
  }

  private var header: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text("Welcome back")
        .font(.title2.weight(.semibold))
      Text(session.displayName.isEmpty ? session.email : session.displayName)
        .foregroundStyle(.secondary)
    }
  }

  private func statsGrid(_ dashboard: DashboardResponse) -> some View {
    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
      StatTile(title: "Open", value: "\(dashboard.taskSummary.open)", symbol: "clock")
      StatTile(title: "Overdue", value: "\(dashboard.taskSummary.overdue)", symbol: "exclamationmark.triangle")
      StatTile(title: "Progress", value: "\(Int(dashboard.avgProgress ?? 0))%", symbol: "chart.line.uptrend.xyaxis")
      StatTile(title: "Expenses", value: "\(Int(dashboard.totalExpenses ?? 0))", symbol: "banknote")
    }
  }

  private func recentTasks(_ tasks: [TaskItem]) -> some View {
    VStack(alignment: .leading, spacing: 10) {
      Text("Recent Tasks")
        .font(.headline)

      ForEach(tasks.prefix(6)) { task in
        TaskRow(task: task)
      }
    }
  }

  private func load(force: Bool) async {
    guard !isLoading else { return }
    guard let token = session.idToken else {
      errorMessage = "Please sign in again."
      return
    }

    isLoading = true
    defer { isLoading = false }

    do {
      dashboard = try await api.dashboard(token: token)
      errorMessage = nil
    } catch {
      errorMessage = error.localizedDescription
    }
  }
}

struct StatTile: View {
  var title: String
  var value: String
  var symbol: String

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      Image(systemName: symbol)
        .font(.title3)
        .foregroundStyle(.tint)
      Text(value)
        .font(.title.weight(.bold))
      Text(title)
        .font(.footnote)
        .foregroundStyle(.secondary)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding()
    .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
  }
}
