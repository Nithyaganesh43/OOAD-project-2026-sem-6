const TASK_STATUSES = ["todo", "in-progress", "blocked", "completed"];
const TASK_PRIORITIES = ["low", "medium", "high", "critical"];
const TIMELINE_STATUS = ["not-started", "on-track", "at-risk", "completed"];

const USER_ALLOWED_STATUS_TRANSITIONS = {
  todo: ["in-progress", "blocked"],
  "in-progress": ["todo", "blocked", "completed"],
  blocked: ["todo", "in-progress"],
  completed: [],
};

module.exports = {
  TASK_STATUSES,
  TASK_PRIORITIES,
  TIMELINE_STATUS,
  USER_ALLOWED_STATUS_TRANSITIONS,
};
