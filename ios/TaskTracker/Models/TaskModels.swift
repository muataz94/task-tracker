import Foundation

struct APIRows<T: Decodable>: Decodable {
  var rows: [T]
}

struct APIOK: Decodable {
  var ok: Bool?
  var id: String?
}

struct APIErrorResponse: Decodable {
  var error: String?
}

struct DashboardResponse: Decodable {
  var taskSummary: TaskSummary
  var poSpend: Double?
  var avgProgress: Double?
  var totalExpenses: Double?
  var tasks: [TaskItem]?
}

struct TaskSummary: Decodable {
  var open: Int
  var inProgress: Int
  var done: Int
  var overdue: Int

  enum CodingKeys: String, CodingKey {
    case open
    case inProgress = "in_progress"
    case done
    case overdue
  }
}

struct TaskItem: Identifiable, Codable, Hashable {
  var id: String
  var title: String
  var status: TaskStatus
  var priority: TaskPriority
  var assignee: String?
  var dueDate: String?
  var startDate: String?
  var completionPercent: String?
  var project: String?
  var category: String?
  var estimatedHours: String?
  var actualHours: String?
  var tags: String?
  var description: String?
  var createdAt: String?

  enum CodingKeys: String, CodingKey {
    case id
    case title
    case status
    case priority
    case assignee
    case dueDate = "due_date"
    case startDate = "start_date"
    case completionPercent = "completion_pct"
    case project
    case category
    case estimatedHours = "estimated_hours"
    case actualHours = "actual_hours"
    case tags
    case description
    case createdAt = "created_at"
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decodeLenientString(forKey: .id)
    title = try container.decodeLenientString(forKey: .title)
    status = TaskStatus(rawValue: try container.decodeLenientString(forKey: .status)) ?? .open
    priority = TaskPriority(rawValue: try container.decodeLenientString(forKey: .priority)) ?? .medium
    assignee = try container.decodeOptionalLenientString(forKey: .assignee)
    dueDate = try container.decodeOptionalLenientString(forKey: .dueDate)
    startDate = try container.decodeOptionalLenientString(forKey: .startDate)
    completionPercent = try container.decodeOptionalLenientString(forKey: .completionPercent)
    project = try container.decodeOptionalLenientString(forKey: .project)
    category = try container.decodeOptionalLenientString(forKey: .category)
    estimatedHours = try container.decodeOptionalLenientString(forKey: .estimatedHours)
    actualHours = try container.decodeOptionalLenientString(forKey: .actualHours)
    tags = try container.decodeOptionalLenientString(forKey: .tags)
    description = try container.decodeOptionalLenientString(forKey: .description)
    createdAt = try container.decodeOptionalLenientString(forKey: .createdAt)
  }

  init(
    id: String,
    title: String,
    status: TaskStatus = .open,
    priority: TaskPriority = .medium,
    assignee: String? = nil,
    dueDate: String? = nil,
    startDate: String? = nil,
    completionPercent: String? = nil,
    project: String? = nil,
    category: String? = nil,
    estimatedHours: String? = nil,
    actualHours: String? = nil,
    tags: String? = nil,
    description: String? = nil,
    createdAt: String? = nil
  ) {
    self.id = id
    self.title = title
    self.status = status
    self.priority = priority
    self.assignee = assignee
    self.dueDate = dueDate
    self.startDate = startDate
    self.completionPercent = completionPercent
    self.project = project
    self.category = category
    self.estimatedHours = estimatedHours
    self.actualHours = actualHours
    self.tags = tags
    self.description = description
    self.createdAt = createdAt
  }
}

private extension KeyedDecodingContainer {
  func decodeLenientString(forKey key: Key) throws -> String {
    if let value = try? decode(String.self, forKey: key) { return value }
    if let value = try? decode(Int.self, forKey: key) { return String(value) }
    if let value = try? decode(Double.self, forKey: key) { return String(value) }
    if let value = try? decode(Bool.self, forKey: key) { return String(value) }
    return ""
  }

  func decodeOptionalLenientString(forKey key: Key) throws -> String? {
    let value = try decodeLenientString(forKey: key)
    return value.isEmpty ? nil : value
  }
}

enum TaskStatus: String, Codable, CaseIterable, Identifiable {
  case open
  case inProgress = "in_progress"
  case done
  case overdue

  var id: String { rawValue }

  var title: String {
    switch self {
    case .open: "Open"
    case .inProgress: "In Progress"
    case .done: "Done"
    case .overdue: "Overdue"
    }
  }
}

enum TaskPriority: String, Codable, CaseIterable, Identifiable {
  case low
  case medium
  case high

  var id: String { rawValue }

  var title: String {
    rawValue.capitalized
  }
}

struct TaskDraft: Codable, Equatable, Hashable {
  var title = ""
  var project = ""
  var assignee = ""
  var dueDate = ""
  var priority: TaskPriority = .medium
  var status: TaskStatus = .open
  var description = ""

  var payload: [String: String] {
    [
      "title": title,
      "project": project,
      "assignee": assignee,
      "due_date": dueDate,
      "priority": priority.rawValue,
      "status": status.rawValue,
      "description": description
    ]
  }
}
