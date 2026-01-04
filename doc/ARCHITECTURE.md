# YouTrack Gerrit Plugin - Architecture Documentation

## Overview

This YouTrack App provides integration with Gerrit Code Review, allowing users to see related Change Requests (CRs) directly within issue views.

## Research Summary

### JIRA Gerrit Plugin (Reference Implementation)

The original [JIRA Gerrit Plugin](https://github.com/MeetMe/jira-gerrit-plugin) by MeetMe provides:

#### Core Features:
1. **Gerrit Reviews Issue Tab Panel** - Shows all reviews related to an issue
2. **Gerrit Subtask Reviews Tab Panel** - Shows reviews related to all issue's subtasks
3. **Workflow Conditions** - Require issues to have/not have open reviews or specific approval scores
4. **Workflow Functions** - Perform Gerrit approvals as workflow transitions

#### Configuration:
- SSH hostname, port, and username
- SSH private key (uploaded file)
- Issue search query (default: `tr:%s` for tracking, `topic:%s` for topics)
- HTTP base URL for links
- Show/hide empty panel option

#### Data Model (GerritChange):
- Change number, Change-ID
- Project, branch, subject
- Status (NEW, MERGED, ABANDONED)
- isOpen flag
- Last updated timestamp
- PatchSet information with approvals

### Gerrit API Options

#### SSH CLI (used by JIRA plugin):
- Uses `gerrit query` command via SSH
- Requires SSH key authentication
- Query format: `gerrit query --format=JSON --current-patch-set <query>`
- Pros: Well-tested, stable
- Cons: Requires SSH access, complex key management

#### REST API (recommended for YouTrack):
- Modern HTTP-based API
- Uses HTTP Basic Auth or API tokens
- Query endpoint: `GET /changes/?q=<query>&o=CURRENT_REVISION&o=LABELS`
- Pros: 
  - Simpler authentication (HTTP tokens)
  - Standard HTTP client usage
  - No SSH key file management needed
  - YouTrack's `http` module supports this natively
- Cons: May require newer Gerrit versions

**Decision: Use REST API** - It's simpler, more portable, and works well with YouTrack's JavaScript runtime.

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    YouTrack Gerrit Plugin                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐    ┌──────────────────────────────────┐  │
│  │    Widget        │    │          Backend                  │  │
│  │  (crlist)        │    │       (gerrit-api.js)             │  │
│  │                  │    │                                   │  │
│  │  ┌────────────┐  │    │  ┌─────────────────────────────┐ │  │
│  │  │ app.tsx    │◄─┼────┼──┤ HTTP Handler: changes       │ │  │
│  │  │            │  │    │  │ - Query Gerrit REST API     │ │  │
│  │  │ - Display  │  │    │  │ - Parse and return changes  │ │  │
│  │  │   CR list  │  │    │  └─────────────────────────────┘ │  │
│  │  │ - Links    │  │    │                                   │  │
│  │  │ - Status   │  │    │  ┌─────────────────────────────┐ │  │
│  │  │   badges   │  │    │  │ Gerrit Client Module        │ │  │
│  │  └────────────┘  │    │  │ - HTTP connection           │ │  │
│  │                  │    │  │ - Authentication            │ │  │
│  └──────────────────┘    │  │ - Query building            │ │  │
│                          │  └─────────────────────────────┘ │  │
│                          │                                   │  │
│                          └──────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Settings (settings.json)               │  │
│  │  - gerritUrl: Gerrit server URL                          │  │
│  │  - gerritUsername: HTTP username                         │  │
│  │  - gerritPassword: HTTP password (secret)                │  │
│  │  - searchQuery: Query pattern (default: message:%s)      │  │
│  │  - cacheTimeoutMin: Cache duration                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

External:
┌─────────────────────────────────────────────────────────────────┐
│                    Gerrit Code Review Server                    │
│                                                                 │
│  REST API: /changes/?q=...&o=CURRENT_REVISION&o=LABELS         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

1. User opens an issue in YouTrack
2. Widget loads and calls `host.fetchApp('gerrit-api/changes', {scope: true})`
3. Backend HTTP handler:
   a. Gets issue ID from context (`ctx.issue.id`)
   b. Reads Gerrit settings from `ctx.settings`
   c. Builds query: `message:<ISSUE_ID>` or custom pattern
   d. Calls Gerrit REST API: `GET /changes/?q=...`
   e. Parses response and extracts relevant fields
   f. Returns JSON to widget
4. Widget renders the list of Change Requests

## Gerrit REST API Query

### Search Query Patterns

The plugin supports configurable search queries. Default options:
- `message:%s` - Search for issue key in commit messages
- `tr:%s` - Search in tracking fields (Bug:, Issue: footers)
- `topic:%s` - Search in change topic

### API Request

```
GET /a/changes/?q=message:ISSUE-123&o=CURRENT_REVISION&o=LABELS&o=DETAILED_ACCOUNTS
```

Options used:
- `CURRENT_REVISION` - Include current patch set info
- `LABELS` - Include approval labels and votes
- `DETAILED_ACCOUNTS` - Include reviewer details

### Response Fields Used

From ChangeInfo entity:
- `_number` - Change number (for links)
- `change_id` - Unique change ID
- `project` - Gerrit project name
- `branch` - Target branch
- `subject` - Commit subject
- `status` - NEW, MERGED, ABANDONED
- `created` / `updated` - Timestamps
- `owner` - Change author
- `labels` - Approval scores (Code-Review, Verified, etc.)
- `insertions` / `deletions` - Line counts

## Settings Schema

| Setting | Type | Required | Description |
|---------|------|----------|-------------|
| gerritUrl | string | Yes | Base URL of Gerrit server (e.g., https://gerrit.example.com) |
| gerritUsername | string | Yes | Username for HTTP authentication |
| gerritPassword | secret | Yes | Password/token for HTTP authentication |
| searchQuery | string | No | Query pattern (default: `message:%s`) |
| showEmptyWidget | boolean | No | Show widget when no changes found |
| cacheTimeoutMin | integer | No | Cache duration in minutes (default: 5) |

## Extension Point

Widget uses `ISSUE_ABOVE_ACTIVITY_STREAM` extension point to display above the issue activity stream.

Alternative options considered:
- `ISSUE_FIELD_PANEL_LAST` - Below custom fields (too cramped)
- `ISSUE_BELOW_SUMMARY` - Below summary (too prominent)

## Testing Considerations

### Challenges:
1. YouTrack apps run in a sandboxed environment - no direct Jest/Mocha support
2. Backend scripts use YouTrack's proprietary APIs (`@jetbrains/youtrack-scripting-api`)
3. No mock framework for YouTrack context objects

### Possible Approaches:
1. **Unit tests for pure functions** - Extract business logic to testable modules
2. **Integration tests** - Manual testing with a real YouTrack + Gerrit setup
3. **Mock YouTrack API** - Create stubs for `http.Connection` and context objects
4. **Type checking** - TypeScript for frontend, JSDoc for backend

**Recommendation**: Focus on type safety and manual integration testing. True unit tests have limited value given the heavy dependency on external systems.

## Future Enhancements

1. **Workflow Conditions** - Block issue transitions based on Gerrit state
2. **Workflow Actions** - Submit changes when issue is resolved
3. **Dashboard Widget** - Show pending reviews across all projects
4. **Two-way sync** - Comment sync between YouTrack and Gerrit
5. **Subtask support** - Show changes for subtasks
