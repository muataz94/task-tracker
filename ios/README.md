# Task Tracker iOS

Native SwiftUI starter for the Task Tracker web app.

This project mirrors the existing Google Sheets Apps Script backend used by the web app:

- `POST` requests go to the Apps Script `API_URL`.
- Requests use `Content-Type: text/plain`.
- Payloads include the Google ID token plus an `action`.
- Core actions are `getDashboard`, `getAll`, `addRow`, `updateRow`, and `deleteRow`.

## Requirements

- macOS with Xcode 16 or newer
- iOS 17 deployment target
- XcodeGen, optional but recommended

Install XcodeGen on a Mac:

```sh
brew install xcodegen
```

Generate the Xcode project:

```sh
cd ios
xcodegen generate
open TaskTracker.xcodeproj
```

## Google Sign-In setup

Create an iOS OAuth client in Google Cloud before running sign-in. Native iOS sign-in needs an iOS client ID and URL scheme, while the backend can still receive an ID token for the existing web client.

Update these placeholders:

- `TaskTrackerConfig.googleIOSClientID`
- `TaskTrackerConfig.googleIOSURLScheme`
- `GIDClientID` and `CFBundleURLSchemes` in `Info.plist`
- The matching values in `project.yml`

Keep this value as the server client ID because it matches the current web/backend setup:

- `TaskTrackerConfig.googleServerClientID`: `536004951636-66ltg9ksnvts6m90mftcl6fd99avbdcv.apps.googleusercontent.com`

The Apps Script endpoint is already copied from `frontend/config.js`.

## First App Intents

The first pass exposes three useful system actions:

- Open a section: Dashboard, Tasks, Kanban, or Settings
- Open Add Task with optional prefilled fields
- Quick Create Task inline, when a valid token is available in Keychain

The inline intent is intentionally narrow. If the token is missing or expired, it tells the user to open the app and sign in again.

## Notes

This workspace is on Windows, so the iOS app cannot be compiled or launched here. Build and simulator verification need to happen on a Mac with Xcode.
