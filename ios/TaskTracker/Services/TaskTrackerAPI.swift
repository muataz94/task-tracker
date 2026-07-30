import Foundation
import Observation

enum TaskTrackerAPIError: LocalizedError {
  case missingToken
  case badResponse
  case server(String)

  var errorDescription: String? {
    switch self {
    case .missingToken: "Please sign in again."
    case .badResponse: "The server returned an unexpected response."
    case .server(let message): message
    }
  }
}

@Observable
final class TaskTrackerAPI {
  static let shared = TaskTrackerAPI()

  private let decoder = JSONDecoder()

  private init() {}

  func dashboard(token: String) async throws -> DashboardResponse {
    try await call("getDashboard", token: token, params: [:])
  }

  func tasks(token: String) async throws -> [TaskItem] {
    let result: APIRows<TaskItem> = try await call("getAll", token: token, params: ["sheet": "Tasks"])
    return result.rows
  }

  func createTask(_ draft: TaskDraft, token: String) async throws -> String? {
    let result: APIOK = try await call("addRow", token: token, params: [
      "sheet": "Tasks",
      "data": draft.payload
    ])
    return result.id
  }

  func updateTask(id: String, fields: [String: String], token: String) async throws {
    let _: APIOK = try await call("updateRow", token: token, params: [
      "sheet": "Tasks",
      "id": id,
      "data": fields
    ])
  }

  private func call<T: Decodable>(_ action: String, token: String, params: [String: Any]) async throws -> T {
    var payload = params
    payload["token"] = token
    payload["action"] = action

    var request = URLRequest(url: TaskTrackerConfig.apiURL)
    request.httpMethod = "POST"
    request.setValue("text/plain", forHTTPHeaderField: "Content-Type")
    request.httpBody = try JSONSerialization.data(withJSONObject: payload)

    let (data, response) = try await URLSession.shared.data(for: request)
    guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
      throw TaskTrackerAPIError.badResponse
    }

    if let error = try? decoder.decode(APIErrorResponse.self, from: data), let message = error.error {
      throw TaskTrackerAPIError.server(message)
    }

    return try decoder.decode(T.self, from: data)
  }
}
