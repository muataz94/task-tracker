import SwiftUI

struct AppShellView: View {
  @Environment(AppRouter.self) private var router

  var body: some View {
    @Bindable var router = router

    TabView(selection: $router.selectedTab) {
      ForEach(AppTab.allCases) { tab in
        NavigationStack {
          tabContent(for: tab)
        }
        .tabItem {
          Label(tab.title, systemImage: tab.systemImage)
        }
        .tag(tab)
      }
    }
    .sheet(item: $router.presentedSheet) { sheet in
      switch sheet {
      case .addTask(let draft):
        TaskEditorView(draft: draft)
      }
    }
  }

  @ViewBuilder
  private func tabContent(for tab: AppTab) -> some View {
    switch tab {
    case .dashboard:
      DashboardView()
    case .tasks:
      TasksView()
    case .kanban:
      KanbanView()
    case .settings:
      SettingsView()
    }
  }
}
