import { useEffect, useMemo, useState } from 'react'
import DashboardShell from '../components/DashboardShell'
import KanbanBoard from '../components/KanbanBoard'
import MetricCard from '../components/MetricCard'
import SessionMonitoring from '../components/SessionMonitoring'
import { dashboardApi, projectApi, sessionApi, taskApi } from '../services/api'
import { extractApiErrorMessage } from '../services/apiClient'
import { STATUS_LABELS, USER_STATUS_TRANSITIONS } from '../utils/constants'
import { formatDate, formatDateTime, formatMinutes } from '../utils/format'

const todayInput = new Date().toISOString().slice(0, 10)
const monthInput = new Date().toISOString().slice(0, 7)

const userSections = [
  { id: 'overview', label: 'Overview', description: 'My current workload and progress' },
  { id: 'projects', label: 'Projects', description: 'Assigned project context and timeline' },
  { id: 'workday', label: 'Check-in/out', description: 'Start and close work sessions' },
  { id: 'kanban', label: 'Kanban', description: 'Move work across allowed statuses' },
  { id: 'sessions', label: 'History', description: 'Review day and month activity' },
]

const UserDashboardPage = () => {
  const [summary, setSummary] = useState(null)
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [sessionOverview, setSessionOverview] = useState({
    filter: { mode: 'day', key: todayInput },
    totalSessions: 0,
    totalMinutes: 0,
    activeSessions: 0,
    sessions: [],
  })
  const [activeSession, setActiveSession] = useState(null)
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [kanbanColumns, setKanbanColumns] = useState({})
  const [sessionViewMode, setSessionViewMode] = useState('day')
  const [sessionDate, setSessionDate] = useState(todayInput)
  const [sessionMonth, setSessionMonth] = useState(monthInput)
  const [feedback, setFeedback] = useState({ type: '', message: '' })

  const [checkInForm, setCheckInForm] = useState({ taskId: '', plannedWork: '' })
  const [checkOutForm, setCheckOutForm] = useState({ actualWork: '', taskStatus: 'in-progress' })

  const selectedProject = useMemo(
    () => projects.find((project) => project._id === selectedProjectId),
    [projects, selectedProjectId],
  )

  const projectTasks = useMemo(
    () => tasks.filter((task) => task.project?._id === selectedProjectId),
    [tasks, selectedProjectId],
  )

  const activeSessionStatusOptions = useMemo(() => {
    const currentStatus = activeSession?.task?.status

    if (!currentStatus) {
      return []
    }

    return [currentStatus, ...(USER_STATUS_TRANSITIONS[currentStatus] || [])]
  }, [activeSession?.task?.status])

  const setSuccess = (message) => setFeedback({ type: 'success', message })
  const setError = (message) => setFeedback({ type: 'error', message })

  const loadDashboard = async () => {
    try {
      const { data } = await dashboardApi.user()
      setSummary(data.summary)
      setProjects(data.projects || [])
      setTasks(data.tasks || [])
      setActiveSession(data.summary?.activeSession || null)

      const defaultProjectId = selectedProjectId || data.projects?.[0]?._id || ''
      setSelectedProjectId(defaultProjectId)
    } catch (error) {
      setError(extractApiErrorMessage(error))
    }
  }

  const loadProjectKanban = async (projectId) => {
    if (!projectId) {
      setKanbanColumns({})
      return
    }

    try {
      const { data } = await projectApi.kanban(projectId)
      setKanbanColumns(data.columns || {})
    } catch (error) {
      setError(extractApiErrorMessage(error))
    }
  }

  const loadSessionOverview = async (mode = sessionViewMode) => {
    try {
      const params = mode === 'month' ? { month: sessionMonth } : { date: sessionDate }
      const { data } = await sessionApi.myOverview(params)
      setSessionOverview(data)
    } catch (error) {
      setError(extractApiErrorMessage(error))
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  useEffect(() => {
    loadProjectKanban(selectedProjectId)
  }, [selectedProjectId])

  useEffect(() => {
    loadSessionOverview()
  }, [])

  useEffect(() => {
    loadSessionOverview(sessionViewMode)
  }, [sessionViewMode])

  useEffect(() => {
    if (!activeSessionStatusOptions.length) {
      setCheckOutForm((current) => ({ ...current, taskStatus: 'in-progress' }))
      return
    }

    setCheckOutForm((current) => {
      if (activeSessionStatusOptions.includes(current.taskStatus)) {
        return current
      }

      return {
        ...current,
        taskStatus: activeSessionStatusOptions[0],
      }
    })
  }, [activeSessionStatusOptions])

  const onMoveTask = async (task, nextStatus) => {
    const allowed = USER_STATUS_TRANSITIONS[task.status] || []

    if (!allowed.includes(nextStatus)) {
      setError(`Invalid transition: ${STATUS_LABELS[task.status]} to ${STATUS_LABELS[nextStatus]}`)
      return
    }

    try {
      await taskApi.updateStatus(task._id, {
        status: nextStatus,
        message: 'Moved by user from Kanban board',
      })
      setSuccess('Task moved successfully')
      await loadDashboard()
      await loadProjectKanban(selectedProjectId)
    } catch (error) {
      setError(extractApiErrorMessage(error))
    }
  }

  const onCheckIn = async (event) => {
    event.preventDefault()

    try {
      await sessionApi.checkIn(checkInForm)
      setCheckInForm({ taskId: '', plannedWork: '' })
      setSuccess('Check-in recorded')
      await loadDashboard()
      await loadSessionOverview()
    } catch (error) {
      setError(extractApiErrorMessage(error))
    }
  }

  const onCheckOut = async (event) => {
    event.preventDefault()

    if (!activeSession?._id) {
      setError('No active session found')
      return
    }

    try {
      await sessionApi.checkOut(activeSession._id, checkOutForm)
      setCheckOutForm({ actualWork: '', taskStatus: 'in-progress' })
      setSuccess('Check-out recorded and task updated')
      await loadDashboard()
      await loadSessionOverview()
      await loadProjectKanban(selectedProjectId)
    } catch (error) {
      setError(extractApiErrorMessage(error))
    }
  }

  const metrics = summary
    ? [
        { label: 'Assigned Projects', value: summary.assignedProjects },
        { label: 'Assigned Tasks', value: summary.assignedTasks },
        { label: 'To Do', value: summary.tasksByStatus?.todo || 0 },
        { label: 'In Progress', value: summary.tasksByStatus?.['in-progress'] || 0 },
        { label: 'Blocked', value: summary.tasksByStatus?.blocked || 0 },
        { label: 'Completed', value: summary.tasksByStatus?.completed || 0 },
      ]
    : []

  return (
    <DashboardShell
      title="My Workboard"
      subtitle="Track assigned projects, log daily sessions, and move tasks through the delivery pipeline."
      sections={userSections}
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
            <h2>My delivery snapshot</h2>
          </div>
          <p className="muted">Current workload, blocked items, and completion counts at a glance.</p>
        </div>

        <div className="metrics-grid">
          {metrics.map((metric) => (
            <MetricCard key={metric.label} label={metric.label} value={metric.value} />
          ))}
        </div>
      </section>

      <section id="projects" className="panel dashboard-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Projects</p>
            <h2>Assigned project context</h2>
          </div>
          <p className="muted">Switch projects to view the relevant timeline and working task list.</p>
        </div>

        <div className="two-col">
          <div className="subpanel">
            <div className="subpanel-heading">
              <h3>Project focus</h3>
              <p className="small muted">Choose the project you want to work from right now.</p>
            </div>

            <label>
              Assigned project
              <select
                value={selectedProjectId}
                onChange={(event) => setSelectedProjectId(event.target.value)}
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
                  <span className="small muted">Timeline</span>
                  <strong>
                    {formatDate(selectedProject.startDate)} to {formatDate(selectedProject.endDate)}
                  </strong>
                </div>
                <div className="project-summary-card">
                  <span className="small muted">Status</span>
                  <strong>{selectedProject.timeline?.statusLabel || 'not-started'}</strong>
                </div>
                <div className="project-summary-card">
                  <span className="small muted">Completion</span>
                  <strong>{selectedProject.timeline?.completionPercent || 0}%</strong>
                </div>
              </div>
            ) : (
              <div className="empty-box">Select one of your assigned projects to continue.</div>
            )}
          </div>

          <div className="subpanel">
            <div className="subpanel-heading">
              <h3>Activity history</h3>
              <p className="small muted">Use the History section below to switch between day and month activity monitoring.</p>
            </div>

            <p className="small muted">
              Your session history uses the same monitoring view as the admin dashboard.
            </p>
          </div>
        </div>
      </section>

      <section id="workday" className="panel dashboard-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Check-in/out</p>
            <h2>Daily execution</h2>
          </div>
          <p className="muted">Log planned work before starting and actual work when closing the session.</p>
        </div>

        <div className="two-col">
          <div className="subpanel">
            <div className="subpanel-heading">
              <h3>Check-in</h3>
              <p className="small muted">Pick an active task from the selected project and define the plan.</p>
            </div>

            <form className="form-grid" onSubmit={onCheckIn}>
              <label>
                Task
                <select
                  value={checkInForm.taskId}
                  onChange={(event) =>
                    setCheckInForm((current) => ({ ...current, taskId: event.target.value }))
                  }
                  required
                >
                  <option value="">Select task...</option>
                  {projectTasks
                    .filter((task) => task.status !== 'completed')
                    .map((task) => (
                      <option value={task._id} key={task._id}>
                        {task.title} ({STATUS_LABELS[task.status]})
                      </option>
                    ))}
                </select>
              </label>

              <textarea
                placeholder="What are you planning to do in this session?"
                rows={4}
                value={checkInForm.plannedWork}
                onChange={(event) =>
                  setCheckInForm((current) => ({ ...current, plannedWork: event.target.value }))
                }
                required
              />

              <button className="btn btn-primary" type="submit" disabled={Boolean(activeSession)}>
                {activeSession ? 'Already checked in' : 'Check in'}
              </button>
            </form>

            {activeSession ? (
              <div className="active-session-box">
                <p className="small muted">Active session</p>
                <p>Task: {activeSession.task?.title}</p>
                <p>Started: {formatDateTime(activeSession.checkInAt)}</p>
              </div>
            ) : null}
          </div>

          <div className="subpanel">
            <div className="subpanel-heading">
              <h3>Check-out</h3>
              <p className="small muted">Capture actual work completed and the task status after the session.</p>
            </div>

            <form className="form-grid" onSubmit={onCheckOut}>
              <textarea
                placeholder="What did you complete in this session?"
                rows={4}
                value={checkOutForm.actualWork}
                onChange={(event) =>
                  setCheckOutForm((current) => ({ ...current, actualWork: event.target.value }))
                }
                required
              />

              <label>
                Move task to
                <select
                  value={checkOutForm.taskStatus}
                  onChange={(event) =>
                    setCheckOutForm((current) => ({ ...current, taskStatus: event.target.value }))
                  }
                  disabled={!activeSession}
                >
                  {activeSessionStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </label>

              <button className="btn btn-secondary" type="submit" disabled={!activeSession}>
                Check out
              </button>
            </form>
          </div>
        </div>
      </section>

      <section id="kanban" className="panel dashboard-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Kanban</p>
            <h2>My board</h2>
          </div>
          <p className="muted">Drag cards only to statuses allowed by the workflow rules.</p>
        </div>

        {selectedProject ? (
          <div className="context-banner">
            <strong>{selectedProject.name}</strong>
            <span>{projectTasks.length} tracked tasks in this project</span>
          </div>
        ) : (
          <div className="empty-box">Choose a project to display your Kanban board.</div>
        )}

        <KanbanBoard
          columns={kanbanColumns}
          canMove
          onMove={onMoveTask}
          moveHint="Only valid transitions are accepted when you drag a card."
          getAllowedStatuses={(task) => USER_STATUS_TRANSITIONS[task.status] || []}
        />
      </section>

      <section id="sessions" className="panel dashboard-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">History</p>
            <h2>Session history</h2>
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
            <button className="btn btn-secondary" type="button" onClick={() => loadSessionOverview()}>
              Load
            </button>
          </div>
        </div>

        <div className="metrics-grid">
          <MetricCard
            label={sessionViewMode === 'month' ? 'Monthly Check-ins' : 'Total Sessions'}
            value={sessionOverview.totalSessions}
          />
          <MetricCard label="Active Sessions" value={sessionOverview.activeSessions} />
          <MetricCard label="Tracked Duration" value={formatMinutes(sessionOverview.totalMinutes)} />
        </div>

        <SessionMonitoring
          mode={sessionViewMode}
          sessions={sessionOverview.sessions}
          selectedDate={sessionDate}
          selectedMonth={sessionMonth}
        />
      </section>
    </DashboardShell>
  )
}

export default UserDashboardPage
