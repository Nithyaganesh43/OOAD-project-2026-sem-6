import { useEffect, useMemo, useState } from 'react'
import DashboardShell from '../components/DashboardShell'
import KanbanBoard from '../components/KanbanBoard'
import MemberPicker from '../components/MemberPicker'
import MetricCard from '../components/MetricCard'
import ProjectGantt from '../components/ProjectGantt'
import SessionMonitoring from '../components/SessionMonitoring'
import { dashboardApi, projectApi, sessionApi, taskApi, userApi } from '../services/api'
import { extractApiErrorMessage } from '../services/apiClient'
import { TASK_PRIORITIES, TASK_STATUSES, TIMELINE_STATUSES } from '../utils/constants'
import { formatDate, formatMinutes, toISOStringSafe } from '../utils/format'

const todayInput = new Date().toISOString().slice(0, 10)
const monthInput = new Date().toISOString().slice(0, 7)

const adminSections = [
  { id: 'overview', label: 'Overview', description: 'Executive metrics and system status' },
  { id: 'users', label: 'Users', description: 'Create users and manage access' },
  { id: 'projects', label: 'Projects', description: 'Plan teams, dates, and delivery health' },
  { id: 'tasks', label: 'Tasks', description: 'Assign work and review recent activity' },
  { id: 'kanban', label: 'Kanban', description: 'Move work between delivery lanes' },
  { id: 'timeline', label: 'Gantt', description: 'Inspect project schedule visually' },
  { id: 'sessions', label: 'Sessions', description: 'Review daily work logs and tracked time' },
]

const AdminDashboardPage = () => {
  const [summary, setSummary] = useState(null)
  const [users, setUsers] = useState([])
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedVisualAssigneeId, setSelectedVisualAssigneeId] = useState('')
  const [kanbanColumns, setKanbanColumns] = useState({})
  const [ganttItems, setGanttItems] = useState([])
  const [sessionsOverview, setSessionsOverview] = useState({
    filter: { mode: 'day', key: todayInput },
    totalSessions: 0,
    totalMinutes: 0,
    activeSessions: 0,
    sessions: [],
  })
  const [sessionViewMode, setSessionViewMode] = useState('day')
  const [sessionDate, setSessionDate] = useState(todayInput)
  const [sessionMonth, setSessionMonth] = useState(monthInput)
  const [feedback, setFeedback] = useState({ type: '', message: '' })

  const [userForm, setUserForm] = useState({ name: '', email: '', password: '' })
  const [projectForm, setProjectForm] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    memberIds: [],
  })
  const [timelineForm, setTimelineForm] = useState({
    completionPercent: 0,
    statusLabel: 'not-started',
    note: '',
  })
  const [taskForm, setTaskForm] = useState({
    projectId: '',
    assigneeId: '',
    title: '',
    description: '',
    priority: 'medium',
    dueDate: '',
    status: 'todo',
  })

  const selectedProject = useMemo(
    () => projects.find((project) => project._id === selectedProjectId),
    [projects, selectedProjectId],
  )

  const selectedProjectMembers = useMemo(
    () => selectedProject?.members || [],
    [selectedProject],
  )

  const selectedVisualAssignee = useMemo(
    () => selectedProjectMembers.find((member) => member._id === selectedVisualAssigneeId) || null,
    [selectedProjectMembers, selectedVisualAssigneeId],
  )

  const activeUsers = useMemo(
    () => users.filter((user) => user.role === 'user' && user.isActive),
    [users],
  )

  const selectedTaskProject = useMemo(
    () => projects.find((project) => project._id === taskForm.projectId),
    [projects, taskForm.projectId],
  )

  const setSuccess = (message) => setFeedback({ type: 'success', message })
  const setError = (message) => setFeedback({ type: 'error', message })

  const loadBaseData = async () => {
    try {
      const [dashboardRes, usersRes, projectsRes, tasksRes] = await Promise.all([
        dashboardApi.admin(),
        userApi.list(),
        projectApi.list(),
        taskApi.list(),
      ])

      setSummary(dashboardRes.data.summary)
      setUsers(usersRes.data.users)
      setProjects(projectsRes.data.projects)
      setTasks(tasksRes.data.tasks)

      const fetchedProjects = projectsRes.data.projects
      const hasSelectedProject = fetchedProjects.some((project) => project._id === selectedProjectId)
      const hasTaskProject = fetchedProjects.some((project) => project._id === taskForm.projectId)

      const defaultProjectId = hasSelectedProject
        ? selectedProjectId
        : hasTaskProject
          ? taskForm.projectId
          : fetchedProjects[0]?._id || ''

      setSelectedProjectId(defaultProjectId)
      setTaskForm((current) => ({
        ...current,
        projectId: current.projectId || defaultProjectId,
      }))
    } catch (error) {
      setError(extractApiErrorMessage(error))
    }
  }

  const loadProjectVisuals = async (projectId, assigneeId = selectedVisualAssigneeId) => {
    if (!projectId) {
      setKanbanColumns({})
      setGanttItems([])
      return
    }

    try {
      const params = assigneeId ? { assigneeId } : {}
      const [kanbanRes, ganttRes] = await Promise.all([
        projectApi.kanban(projectId, params),
        projectApi.gantt(projectId, params),
      ])

      setKanbanColumns(kanbanRes.data.columns || {})
      setGanttItems(ganttRes.data.ganttItems || [])
    } catch (error) {
      setError(extractApiErrorMessage(error))
    }
  }

  const loadSessionsOverview = async (mode = sessionViewMode) => {
    try {
      const params = mode === 'month' ? { month: sessionMonth } : { date: sessionDate }
      const { data } = await sessionApi.adminOverview(params)
      setSessionsOverview(data)
    } catch (error) {
      setError(extractApiErrorMessage(error))
    }
  }

  useEffect(() => {
    loadBaseData()
  }, [])

  useEffect(() => {
    loadProjectVisuals(selectedProjectId, selectedVisualAssigneeId)

    if (selectedProject) {
      setTimelineForm({
        completionPercent: selectedProject.timeline?.completionPercent ?? 0,
        statusLabel: selectedProject.timeline?.statusLabel || 'not-started',
        note: selectedProject.timeline?.note || '',
      })
    }
  }, [selectedProjectId, selectedProject, selectedVisualAssigneeId])

  useEffect(() => {
    if (!selectedProjectMembers.some((member) => member._id === selectedVisualAssigneeId)) {
      setSelectedVisualAssigneeId('')
    }
  }, [selectedProjectMembers, selectedVisualAssigneeId])

  useEffect(() => {
    loadSessionsOverview()
  }, [])

  useEffect(() => {
    loadSessionsOverview(sessionViewMode)
  }, [sessionViewMode])

  const onCreateUser = async (event) => {
    event.preventDefault()

    try {
      await userApi.create(userForm)
      setUserForm({ name: '', email: '', password: '' })
      setSuccess('User created successfully')
      await loadBaseData()
    } catch (error) {
      setError(extractApiErrorMessage(error))
    }
  }

  const onUpdateUserActive = async (user) => {
    try {
      await userApi.update(user._id, { isActive: !user.isActive })
      setSuccess('User status updated')
      await loadBaseData()
    } catch (error) {
      setError(extractApiErrorMessage(error))
    }
  }

  const onDeleteUser = async (user) => {
    const confirmed = window.confirm(`Delete user "${user.name}"? This action cannot be undone.`)

    if (!confirmed) return

    try {
      await userApi.remove(user._id)
      setSuccess('User deleted successfully')
      await loadBaseData()
    } catch (error) {
      setError(extractApiErrorMessage(error))
    }
  }

  const onCreateProject = async (event) => {
    event.preventDefault()

    const payload = {
      ...projectForm,
      startDate: toISOStringSafe(projectForm.startDate),
      endDate: toISOStringSafe(projectForm.endDate, true),
      timeline: {
        completionPercent: 0,
        statusLabel: 'not-started',
        note: 'Initial planning phase',
      },
    }

    try {
      await projectApi.create(payload)
      setProjectForm({
        name: '',
        description: '',
        startDate: '',
        endDate: '',
        memberIds: [],
      })
      setSuccess('Project created successfully')
      await loadBaseData()
    } catch (error) {
      setError(extractApiErrorMessage(error))
    }
  }

  const onDeleteProject = async (project) => {
    const confirmed = window.confirm(`Delete project "${project.name}"? This action cannot be undone.`)

    if (!confirmed) return

    try {
      await projectApi.remove(project._id)
      setSuccess('Project deleted successfully')
      await loadBaseData()
    } catch (error) {
      setError(extractApiErrorMessage(error))
    }
  }

  const onUpdateTimeline = async (event) => {
    event.preventDefault()

    if (!selectedProjectId) return

    try {
      await projectApi.update(selectedProjectId, {
        timeline: {
          completionPercent: Number(timelineForm.completionPercent),
          statusLabel: timelineForm.statusLabel,
          note: timelineForm.note,
        },
      })
      setSuccess('Project timeline updated')
      await loadBaseData()
    } catch (error) {
      setError(extractApiErrorMessage(error))
    }
  }

  const onCreateTask = async (event) => {
    event.preventDefault()

    try {
      await taskApi.create({
        ...taskForm,
        dueDate: taskForm.dueDate ? new Date(taskForm.dueDate).toISOString() : null,
      })
      setTaskForm((current) => ({
        ...current,
        title: '',
        description: '',
        dueDate: '',
      }))
      setSuccess('Task created and assigned')
      await loadBaseData()
      await loadProjectVisuals(taskForm.projectId, selectedVisualAssigneeId)
    } catch (error) {
      setError(extractApiErrorMessage(error))
    }
  }

  const onDeleteTask = async (task) => {
    const confirmed = window.confirm(`Delete task "${task.title}"? This action cannot be undone.`)

    if (!confirmed) return

    try {
      await taskApi.remove(task._id)
      setSuccess('Task deleted successfully')
      await loadBaseData()

      if (selectedProjectId) {
        await loadProjectVisuals(selectedProjectId, selectedVisualAssigneeId)
      }
    } catch (error) {
      setError(extractApiErrorMessage(error))
    }
  }

  const onMoveTask = async (task, nextStatus) => {
    try {
      await taskApi.updateStatus(task._id, {
        status: nextStatus,
        message: 'Updated by admin from Kanban board',
      })
      setSuccess('Task status updated')
      await loadBaseData()
      await loadProjectVisuals(selectedProjectId, selectedVisualAssigneeId)
    } catch (error) {
      setError(extractApiErrorMessage(error))
    }
  }

  const metrics = summary
    ? [
        { label: 'Total Users', value: summary.totalUsers },
        { label: 'Active Users', value: summary.activeUsers },
        { label: 'Total Projects', value: summary.totalProjects },
        { label: 'Total Tasks', value: summary.totalTasks },
        { label: 'Active Sessions', value: summary.activeSessions },
      ]
    : []

  return (
    <DashboardShell
      title="Admin Control Center"
      subtitle="Manage people, project delivery, workflow movement, and time tracking from a structured workspace."
      sections={adminSections}
    >
      {feedback.message ? (
        <p className={feedback.type === 'error' ? 'alert alert-error' : 'alert alert-success'}>
          {feedback.message}
        </p>
      ) : null}

      <section id="overview" className="panel dashboard-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Overview</p>
            <h2>Operational snapshot</h2>
          </div>
          <p className="muted">High-level counts for adoption, delivery load, and active work.</p>
        </div>
        <div className="metrics-grid">
          {metrics.map((metric) => (
            <MetricCard key={metric.label} label={metric.label} value={metric.value} />
          ))}
        </div>
      </section>

      <section id="users" className="panel dashboard-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Users</p>
            <h2>Team access management</h2>
          </div>
          <p className="muted">Create accounts and keep the working team active without leaving the dashboard.</p>
        </div>

        <div className="two-col">
          <div className="subpanel">
            <div className="subpanel-heading">
              <h3>Create user</h3>
              <p className="small muted">Add a new account for the platform.</p>
            </div>

            <form className="form-grid" onSubmit={onCreateUser}>
              <input
                placeholder="Full name"
                value={userForm.name}
                onChange={(event) =>
                  setUserForm((current) => ({ ...current, name: event.target.value }))
                }
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={userForm.email}
                onChange={(event) =>
                  setUserForm((current) => ({ ...current, email: event.target.value }))
                }
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={userForm.password}
                onChange={(event) =>
                  setUserForm((current) => ({ ...current, password: event.target.value }))
                }
                required
              />
              <button className="btn btn-primary" type="submit">
                Create user
              </button>
            </form>
          </div>

          <div className="subpanel">
            <div className="subpanel-heading">
              <h3>User directory</h3>
              <p className="small muted">Review role coverage and activate or deactivate team members.</p>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user._id}>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>{user.role}</td>
                      <td>{user.isActive ? 'Active' : 'Inactive'}</td>
                      <td>
                        {user.role === 'user' ? (
                          <div className="table-actions">
                            <button className="btn btn-secondary" type="button" onClick={() => onUpdateUserActive(user)}>
                              {user.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                            <button className="btn btn-danger" type="button" onClick={() => onDeleteUser(user)}>
                              Delete
                            </button>
                          </div>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section id="projects" className="panel dashboard-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Projects</p>
            <h2>Planning and staffing</h2>
          </div>
          <p className="muted">Build project teams with a clearer member picker and keep timeline health visible.</p>
        </div>

        <div className="two-col">
          <div className="subpanel">
            <div className="subpanel-heading">
              <h3>Create project</h3>
              <p className="small muted">Capture dates, summary, and the initial project team.</p>
            </div>

            <form className="form-grid" onSubmit={onCreateProject}>
              <input
                placeholder="Project name"
                value={projectForm.name}
                onChange={(event) =>
                  setProjectForm((current) => ({ ...current, name: event.target.value }))
                }
                required
              />

              <textarea
                placeholder="Description"
                rows={4}
                value={projectForm.description}
                onChange={(event) =>
                  setProjectForm((current) => ({ ...current, description: event.target.value }))
                }
              />

              <div className="inline-form-grid">
                <label>
                  Start date
                  <input
                    type="date"
                    value={projectForm.startDate}
                    onChange={(event) =>
                      setProjectForm((current) => ({ ...current, startDate: event.target.value }))
                    }
                    required
                  />
                </label>

                <label>
                  End date
                  <input
                    type="date"
                    value={projectForm.endDate}
                    onChange={(event) =>
                      setProjectForm((current) => ({ ...current, endDate: event.target.value }))
                    }
                    required
                  />
                </label>
              </div>

              <div className="form-field">
                <div className="field-copy">
                  <span>Assign members</span>
                  <p className="small muted">Click team cards to add or remove them from the new project.</p>
                </div>
                <MemberPicker
                  users={activeUsers}
                  selectedIds={projectForm.memberIds}
                  onChange={(memberIds) =>
                    setProjectForm((current) => ({ ...current, memberIds }))
                  }
                />
              </div>

              <button className="btn btn-primary" type="submit">
                Create project
              </button>
            </form>
          </div>

          <div className="subpanel">
            <div className="subpanel-heading">
              <h3>Project control</h3>
              <p className="small muted">Select a project, review schedule context, and update timeline reporting.</p>
            </div>

            <label>
              Active project
              <select
                value={selectedProjectId}
                onChange={(event) => {
                  setSelectedProjectId(event.target.value)
                  setTaskForm((current) => ({ ...current, projectId: event.target.value, assigneeId: '' }))
                }}
              >
                <option value="">Select project...</option>
                {projects.map((project) => (
                  <option value={project._id} key={project._id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            {selectedProject ? (
              <div className="project-summary-grid">
                <div className="project-summary-card">
                  <span className="small muted">Schedule</span>
                  <strong>
                    {formatDate(selectedProject.startDate)} to {formatDate(selectedProject.endDate)}
                  </strong>
                </div>
                <div className="project-summary-card">
                  <span className="small muted">Members</span>
                  <strong>{selectedProjectMembers.length}</strong>
                </div>
                <div className="project-summary-card">
                  <span className="small muted">Completion</span>
                  <strong>{selectedProject.timeline?.completionPercent || 0}%</strong>
                </div>
              </div>
            ) : (
              <div className="empty-box">Select a project to view timeline and workflow details.</div>
            )}

            <form className="form-grid" onSubmit={onUpdateTimeline}>
              <h4>Timeline update</h4>
              <label>
                Completion %
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={timelineForm.completionPercent}
                  onChange={(event) =>
                    setTimelineForm((current) => ({
                      ...current,
                      completionPercent: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              <label>
                Status label
                <select
                  value={timelineForm.statusLabel}
                  onChange={(event) =>
                    setTimelineForm((current) => ({ ...current, statusLabel: event.target.value }))
                  }
                >
                  {TIMELINE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <textarea
                placeholder="Timeline note"
                rows={4}
                value={timelineForm.note}
                onChange={(event) =>
                  setTimelineForm((current) => ({ ...current, note: event.target.value }))
                }
              />

              <button className="btn btn-secondary" type="submit" disabled={!selectedProjectId}>
                Update timeline
              </button>
            </form>

            <div className="danger-zone">
              <h4>Delete project</h4>
              <p className="small muted">Delete the selected project permanently.</p>
              <button
                className="btn btn-danger"
                type="button"
                disabled={!selectedProject}
                onClick={() => selectedProject && onDeleteProject(selectedProject)}
              >
                Delete selected project
              </button>
            </div>
          </div>
        </div>
      </section>

      <section id="tasks" className="panel dashboard-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Tasks</p>
            <h2>Assignment desk</h2>
          </div>
          <p className="muted">Create new tasks against the selected project team and review the latest work items.</p>
        </div>

        <div className="two-col">
          <div className="subpanel">
            <div className="subpanel-heading">
              <h3>Create task</h3>
              <p className="small muted">Assign a task to a staffed team member with its due date and starting status.</p>
            </div>

            <form className="form-grid" onSubmit={onCreateTask}>
              <label>
                Project
                <select
                  value={taskForm.projectId}
                  onChange={(event) =>
                    setTaskForm((current) => ({
                      ...current,
                      projectId: event.target.value,
                      assigneeId: '',
                    }))
                  }
                  required
                >
                  <option value="">Select project...</option>
                  {projects.map((project) => (
                    <option key={project._id} value={project._id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Assignee
                <select
                  value={taskForm.assigneeId}
                  onChange={(event) =>
                    setTaskForm((current) => ({ ...current, assigneeId: event.target.value }))
                  }
                  required
                >
                  <option value="">Select assignee...</option>
                  {(selectedTaskProject?.members || []).map((member) => (
                    <option value={member._id} key={member._id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>

              <input
                placeholder="Task title"
                value={taskForm.title}
                onChange={(event) =>
                  setTaskForm((current) => ({ ...current, title: event.target.value }))
                }
                required
              />

              <textarea
                placeholder="Description"
                rows={4}
                value={taskForm.description}
                onChange={(event) =>
                  setTaskForm((current) => ({ ...current, description: event.target.value }))
                }
              />

              <div className="inline-form-grid">
                <label>
                  Priority
                  <select
                    value={taskForm.priority}
                    onChange={(event) =>
                      setTaskForm((current) => ({ ...current, priority: event.target.value }))
                    }
                  >
                    {TASK_PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Due date
                  <input
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(event) =>
                      setTaskForm((current) => ({ ...current, dueDate: event.target.value }))
                    }
                  />
                </label>
              </div>

              <label>
                Initial status
                <select
                  value={taskForm.status}
                  onChange={(event) =>
                    setTaskForm((current) => ({ ...current, status: event.target.value }))
                  }
                >
                  {TASK_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <button className="btn btn-primary" type="submit">
                Create task
              </button>
            </form>
          </div>

          <div className="subpanel">
            <div className="subpanel-heading">
              <h3>Recent tasks</h3>
              <p className="small muted">Latest assignments across projects for quick review.</p>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Project</th>
                    <th>Assignee</th>
                    <th>Status</th>
                    <th>Due</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.slice(0, 12).map((task) => (
                    <tr key={task._id}>
                      <td>{task.title}</td>
                      <td>{task.project?.name}</td>
                      <td>{task.assignee?.name}</td>
                      <td>{task.status}</td>
                      <td>{formatDate(task.dueDate)}</td>
                      <td>
                        <button className="btn btn-danger" type="button" onClick={() => onDeleteTask(task)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section id="kanban" className="panel dashboard-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Kanban</p>
            <h2>Delivery board</h2>
          </div>
          <p className="muted">Review workflow ownership clearly and switch between all members or one assignee.</p>
        </div>

        {selectedProject ? (
          <div className="context-banner context-banner-stack">
            <div className="context-banner-main">
              <strong>{selectedProject.name}</strong>
              <span>{selectedProjectMembers.length} members assigned</span>
            </div>
            <label className="filter-field">
              Assignee filter
              <select
                value={selectedVisualAssigneeId}
                onChange={(event) => setSelectedVisualAssigneeId(event.target.value)}
              >
                <option value="">All members</option>
                {selectedProjectMembers.map((member) => (
                  <option key={member._id} value={member._id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <div className="empty-box">Select a project to manage its Kanban board.</div>
        )}

        <KanbanBoard
          columns={kanbanColumns}
          canMove
          onMove={onMoveTask}
          moveHint="Admins can move any task by dragging it into a new lane."
          showAssignee
          getAllowedStatuses={(task) => TASK_STATUSES.filter((status) => status !== task.status)}
        />
      </section>

      <section id="timeline" className="panel dashboard-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Gantt</p>
            <h2>Schedule view</h2>
          </div>
          <p className="muted">
            Timeline view for {selectedVisualAssignee ? selectedVisualAssignee.name : 'all assigned members'}.
          </p>
        </div>

        {selectedProject ? (
          <div className="context-banner context-banner-stack">
            <div className="context-banner-main">
              <strong>{selectedProject.name}</strong>
              <span>
                Showing {selectedVisualAssignee ? selectedVisualAssignee.name : 'all members'} across the project schedule
              </span>
            </div>
            <label className="filter-field">
              Assignee filter
              <select
                value={selectedVisualAssigneeId}
                onChange={(event) => setSelectedVisualAssigneeId(event.target.value)}
              >
                <option value="">All members</option>
                {selectedProjectMembers.map((member) => (
                  <option key={member._id} value={member._id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        <ProjectGantt
          ganttItems={ganttItems}
          projectName={selectedProject?.name}
          projectStartDate={selectedProject?.startDate}
          projectEndDate={selectedProject?.endDate}
        />
      </section>

      <section id="sessions" className="panel dashboard-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Sessions</p>
            <h2>User activity monitoring</h2>
          </div>
          <div className="inline-controls">
            <div className="segmented-control">
              <button
                className={sessionViewMode === 'day' ? 'segment-btn active' : 'segment-btn'}
                type="button"
                onClick={() => setSessionViewMode('day')}
              >
                Day
              </button>
              <button
                className={sessionViewMode === 'month' ? 'segment-btn active' : 'segment-btn'}
                type="button"
                onClick={() => setSessionViewMode('month')}
              >
                Month
              </button>
            </div>
            {sessionViewMode === 'day' ? (
              <input
                type="date"
                value={sessionDate}
                onChange={(event) => setSessionDate(event.target.value)}
              />
            ) : (
              <input
                type="month"
                value={sessionMonth}
                onChange={(event) => setSessionMonth(event.target.value)}
              />
            )}
            <button className="btn btn-secondary" type="button" onClick={() => loadSessionsOverview()}>
              Load
            </button>
          </div>
        </div>

        <div className="metrics-grid">
          <MetricCard
            label={sessionViewMode === 'month' ? 'Monthly Check-ins' : 'Total Sessions'}
            value={sessionsOverview.totalSessions}
          />
          <MetricCard label="Active Sessions" value={sessionsOverview.activeSessions} />
          <MetricCard label="Tracked Duration" value={formatMinutes(sessionsOverview.totalMinutes)} />
        </div>

        <SessionMonitoring
          mode={sessionViewMode}
          sessions={sessionsOverview.sessions}
          selectedDate={sessionDate}
          selectedMonth={sessionMonth}
        />
      </section>
    </DashboardShell>
  )
}

export default AdminDashboardPage
