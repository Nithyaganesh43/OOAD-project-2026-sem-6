export const TASK_STATUSES = ['todo', 'in-progress', 'blocked', 'completed']

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'critical']

export const TIMELINE_STATUSES = ['not-started', 'on-track', 'at-risk', 'completed']

export const STATUS_LABELS = {
  todo: 'To Do',
  'in-progress': 'In Progress',
  blocked: 'Blocked',
  completed: 'Completed',
}

export const PRIORITY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

export const USER_STATUS_TRANSITIONS = {
  todo: ['in-progress', 'blocked'],
  'in-progress': ['todo', 'blocked', 'completed'],
  blocked: ['todo', 'in-progress'],
  completed: [],
}
