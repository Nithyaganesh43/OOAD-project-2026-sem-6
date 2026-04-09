# API Reference

## Backend structure

```text
backend/
  app.js
  server.js
  .env.example
  src/
    config/
    constants/
    controllers/
    middleware/
    models/
    routes/
    services/
    utils/
```

## MongoDB schema design

### User

```js
{
  _id: ObjectId,
  name: String,
  email: String, // unique, lowercase, email format
  password: String, // bcrypt hash
  role: "admin" | "user",
  isActive: Boolean,
  lastLoginAt: Date | null,
  createdAt: Date,
  updatedAt: Date
}
```

### Project

```js
{
  _id: ObjectId,
  name: String,
  description: String,
  startDate: Date,
  endDate: Date,
  members: [ObjectId], // User refs
  createdBy: ObjectId, // admin ref
  timeline: {
    completionPercent: Number,
    statusLabel: "not-started" | "on-track" | "at-risk" | "completed",
    note: String,
    manuallyUpdatedAt: Date | null,
    manuallyUpdatedBy: ObjectId | null
  },
  isArchived: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Task

```js
{
  _id: ObjectId,
  project: ObjectId, // Project ref
  assignee: ObjectId, // User ref
  title: String,
  description: String,
  priority: "low" | "medium" | "high" | "critical",
  dueDate: Date | null,
  status: "todo" | "in-progress" | "blocked" | "completed",
  createdBy: ObjectId,
  statusUpdatedAt: Date,
  completedAt: Date | null,
  statusHistory: [
    {
      fromStatus: String | null,
      toStatus: String,
      changedBy: ObjectId,
      changedAt: Date,
      source: "admin-panel" | "kanban" | "check-out",
      message: String
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

### WorkSession

```js
{
  _id: ObjectId,
  user: ObjectId, // User ref
  project: ObjectId, // Project ref
  task: ObjectId, // Task ref
  workDate: "YYYY-MM-DD",
  plannedWork: String,
  actualWork: String,
  checkInAt: Date,
  checkOutAt: Date | null,
  durationMinutes: Number,
  checkoutTaskStatus: "todo" | "in-progress" | "blocked" | "completed" | null,
  status: "active" | "closed",
  createdAt: Date,
  updatedAt: Date
}
```

## Key consistency rules

- Startup seeds exactly one default admin:
  - `admin@email.com`
  - `admin@123`
- Only admin can create users, projects, and tasks.
- Users can access only assigned projects and their own tasks.
- Task assignee must already be a member of the task’s project.
- Task due date must stay inside the project start/end range.
- Removing a project member is blocked if tasks are still assigned to that user.
- Shrinking a project timeline is blocked if existing task due dates fall outside it.
- Only one active work session is allowed per user at a time.
- Check-in requires planned work text.
- Check-out requires actual work text and the next Kanban status.

## Auth

### POST `/api/auth/login`

```json
{
  "email": "admin@email.com",
  "password": "admin@123"
}
```

### GET `/api/auth/me`

Header:

```http
Authorization: Bearer JWT_TOKEN
```

## Admin APIs

### POST `/api/users`

```json
{
  "name": "Asha Nair",
  "email": "asha@college.com",
  "password": "asha123"
}
```

### GET `/api/users`

No body.

### GET `/api/users/:userId`

No body.

### PATCH `/api/users/:userId`

```json
{
  "name": "Asha Nair S",
  "email": "asha.s@college.com",
  "password": "newpass123",
  "isActive": true
}
```

### DELETE `/api/users/:userId`

No body.

### POST `/api/projects`

```json
{
  "name": "College ERP Task Tracker",
  "description": "Internal team project presentation demo",
  "startDate": "2026-04-10T00:00:00.000Z",
  "endDate": "2026-05-10T23:59:59.999Z",
  "memberIds": [
    "6611234567890abcdef1111",
    "6611234567890abcdef2222"
  ],
  "timeline": {
    "completionPercent": 0,
    "statusLabel": "not-started",
    "note": "Initial planning phase"
  }
}
```

### GET `/api/projects`

No body.

### GET `/api/projects/:projectId`

No body.

### PATCH `/api/projects/:projectId`

```json
{
  "name": "College ERP Tracker",
  "description": "Updated description",
  "startDate": "2026-04-10T00:00:00.000Z",
  "endDate": "2026-05-15T23:59:59.999Z",
  "memberIds": [
    "6611234567890abcdef1111",
    "6611234567890abcdef2222",
    "6611234567890abcdef3333"
  ],
  "timeline": {
    "completionPercent": 55,
    "statusLabel": "on-track",
    "note": "Frontend and backend are aligned for demo"
  },
  "isArchived": false
}
```

### DELETE `/api/projects/:projectId`

No body.

### GET `/api/projects/:projectId/kanban`

No body. Returns grouped Kanban columns. Admin sees all tasks in the project.
Optional query:

- `assigneeId=<userId>` to view one user’s board inside the project

### GET `/api/projects/:projectId/gantt`

No body. Returns Gantt-ready items for `frappe-gantt` or `react-gantt-timeline`.

### POST `/api/tasks`

```json
{
  "projectId": "6611234567890abcdefaaaa",
  "assigneeId": "6611234567890abcdef1111",
  "title": "Design login screen",
  "description": "Create a clean login screen in corporate blue and gray theme",
  "priority": "high",
  "dueDate": "2026-04-18T12:00:00.000Z",
  "status": "todo"
}
```

### GET `/api/tasks`

Optional query params:

- `projectId`
- `assigneeId`
- `status`

### GET `/api/tasks/:taskId`

No body.

### PATCH `/api/tasks/:taskId`

```json
{
  "projectId": "6611234567890abcdefaaaa",
  "assigneeId": "6611234567890abcdef1111",
  "title": "Design login and dashboard screens",
  "description": "Add presentation-quality layout",
  "priority": "critical",
  "dueDate": "2026-04-20T12:00:00.000Z",
  "status": "in-progress"
}
```

### PATCH `/api/tasks/:taskId/status`

```json
{
  "status": "blocked",
  "message": "Waiting for admin design approval"
}
```

### DELETE `/api/tasks/:taskId`

No body.

### GET `/api/dashboard/admin`

No body. Returns summary counts and recent projects.

### GET `/api/sessions/admin/overview?date=2026-04-06&projectId=<id>&userId=<id>`

No body. Returns admin monitoring data for daily work sessions.

## User APIs

### GET `/api/dashboard/user`

No body. Returns assigned projects, own tasks, own active session, and today sessions.

### GET `/api/projects`

Returns only assigned projects for the logged-in user.

### GET `/api/projects/:projectId/kanban`

Returns only that user’s tasks inside the selected project.

### GET `/api/tasks`

Returns only that user’s own tasks.

### POST `/api/sessions/check-in`

Before calling this, frontend should show the user’s assigned tasks. User selects one task and enters the plan for this session.

```json
{
  "taskId": "6611234567890abcdef9999",
  "plannedWork": "I will finish the login page validation and connect it to the API."
}
```

### POST `/api/sessions/:sessionId/check-out`

This captures the checkout note and Kanban move together.

```json
{
  "actualWork": "Completed login form, API integration, and error handling.",
  "taskStatus": "completed"
}
```

### GET `/api/sessions/me`

No body.

### GET `/api/sessions/me/today?date=2026-04-06`

No body. Returns the current user’s work sessions inside one 24-hour date bucket.

## Feature coverage

This backend already covers the APIs needed for:

- admin-controlled Kanban board
- user-side Kanban movement
- Gantt/timeline data
- start date, end date, due date, and deadline management
- completion status and status update timestamps
- multiple check-ins/check-outs per day
- planned work at check-in
- actual work note at check-out
- admin monitoring of users, projects, tasks, and daily session logs
