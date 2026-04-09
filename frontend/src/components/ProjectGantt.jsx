import { useMemo, useState } from 'react'
import { STATUS_LABELS } from '../utils/constants'
import { formatDate } from '../utils/format'

const DAY_MS = 24 * 60 * 60 * 1000
const VIEW_MODES = ['Day', 'Week', 'Month']
const VIEW_CONFIG = {
  Day: { cellWidth: 72 },
  Week: { cellWidth: 128 },
  Month: { cellWidth: 160 },
}

const startOfDay = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  return date
}

const endOfDay = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(23, 59, 59, 999)
  return date
}

const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS)

const dayDiff = (start, end) =>
  Math.max(0, Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / DAY_MS))

const monthStart = (value) => new Date(value.getFullYear(), value.getMonth(), 1)

const monthEnd = (value) => new Date(value.getFullYear(), value.getMonth() + 1, 0, 23, 59, 59, 999)

const formatHeaderLabel = (start, end, viewMode) => {
  if (viewMode === 'Day') {
    return start.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
  }

  if (viewMode === 'Week') {
    const startLabel = start.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
    const endLabel = end.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
    return `${startLabel} - ${endLabel}`
  }

  return start.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

const normalizeTimelineDates = (startValue, endValue) => {
  const startDate = startOfDay(startValue)
  const endDate = endOfDay(endValue)

  if (!startDate && !endDate) {
    return { start: null, end: null }
  }

  if (!startDate) {
    return { start: startOfDay(endValue), end: endOfDay(endValue) }
  }

  if (!endDate) {
    return { start: startDate, end: endOfDay(startValue) }
  }

  return startDate <= endDate
    ? { start: startDate, end: endDate }
    : { start: startOfDay(endValue), end: endOfDay(startValue) }
}

const buildTimelineColumns = (rangeStart, rangeEnd, viewMode) => {
  if (!rangeStart || !rangeEnd) return []

  const columns = []

  if (viewMode === 'Day') {
    let cursor = new Date(rangeStart)

    while (cursor <= rangeEnd) {
      const columnStart = startOfDay(cursor)
      const columnEnd = endOfDay(cursor)
      columns.push({
        key: columnStart.toISOString(),
        start: columnStart,
        end: columnEnd,
        label: formatHeaderLabel(columnStart, columnEnd, viewMode),
      })
      cursor = addDays(cursor, 1)
    }

    return columns
  }

  if (viewMode === 'Week') {
    let cursor = new Date(rangeStart)

    while (cursor <= rangeEnd) {
      const columnStart = startOfDay(cursor)
      const columnEnd = endOfDay(new Date(Math.min(addDays(columnStart, 6).getTime(), rangeEnd.getTime())))
      columns.push({
        key: columnStart.toISOString(),
        start: columnStart,
        end: columnEnd,
        label: formatHeaderLabel(columnStart, columnEnd, viewMode),
      })
      cursor = addDays(columnStart, 7)
    }

    return columns
  }

  let cursor = monthStart(rangeStart)

  while (cursor <= rangeEnd) {
    const columnStart = cursor < rangeStart ? rangeStart : startOfDay(cursor)
    const rawEnd = monthEnd(cursor)
    const columnEnd = rawEnd > rangeEnd ? rangeEnd : rawEnd
    columns.push({
      key: columnStart.toISOString(),
      start: columnStart,
      end: columnEnd,
      label: formatHeaderLabel(columnStart, columnEnd, viewMode),
    })
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
  }

  return columns
}

const ProjectGantt = ({ ganttItems, projectName, projectStartDate, projectEndDate }) => {
  const [viewMode, setViewMode] = useState('Week')

  const preparedTasks = useMemo(() => {
    return (ganttItems || [])
      .map((item) => {
        const normalizedRange = normalizeTimelineDates(item.start, item.end)

        return {
          id: item.id,
          name: item.name,
          start: normalizedRange.start,
          end: normalizedRange.end,
          status: item.status,
          assigneeName: item.assignee?.name || 'Not assigned',
        }
      })
      .filter((item) => item.start && item.end)
      .sort((left, right) => left.start.getTime() - right.start.getTime())
  }, [ganttItems])

  const projectRange = useMemo(() => {
    const normalizedProjectRange = normalizeTimelineDates(projectStartDate, projectEndDate)

    if (normalizedProjectRange.start && normalizedProjectRange.end) {
      return normalizedProjectRange
    }

    if (!preparedTasks.length) {
      return { start: null, end: null }
    }

    return {
      start: preparedTasks[0].start,
      end: preparedTasks.reduce(
        (latest, task) => (task.end > latest ? task.end : latest),
        preparedTasks[0].end,
      ),
    }
  }, [preparedTasks, projectEndDate, projectStartDate])

  const timelineColumns = useMemo(
    () => buildTimelineColumns(projectRange.start, projectRange.end, viewMode),
    [projectRange.end, projectRange.start, viewMode],
  )

  const timelineSummary = useMemo(() => {
    if (!preparedTasks.length || !projectRange.start || !projectRange.end) return null

    const statusCounts = preparedTasks.reduce((accumulator, task) => {
      accumulator[task.status] = (accumulator[task.status] || 0) + 1
      return accumulator
    }, {})

    return {
      start: projectRange.start,
      end: projectRange.end,
      statusCounts,
    }
  }, [preparedTasks, projectRange.end, projectRange.start])

  const totalDays = useMemo(() => {
    if (!projectRange.start || !projectRange.end) return 1
    return Math.max(1, dayDiff(projectRange.start, projectRange.end) + 1)
  }, [projectRange.end, projectRange.start])

  const timelineWidth = timelineColumns.length * VIEW_CONFIG[viewMode].cellWidth

  if (!preparedTasks.length || !timelineSummary) {
    return <div className="empty-box">No task data for this timeline</div>
  }

  return (
    <div className="gantt-shell">
      <div className="gantt-toolbar">
        <div>
          <p className="small muted">Delivery timeline</p>
          <h3>Project timeline</h3>
          {projectName ? <p className="small muted">{projectName}</p> : null}
        </div>

        <div className="gantt-view-switcher">
          {VIEW_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              className={viewMode === mode ? 'view-mode-btn active' : 'view-mode-btn'}
              onClick={() => setViewMode(mode)}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="gantt-summary gantt-summary-rich">
        <div className="gantt-summary-card gantt-summary-primary">
          <span className="small muted">Project window</span>
          <strong>
            {formatDate(timelineSummary.start)} to {formatDate(timelineSummary.end)}
          </strong>
          <p className="small muted">Structured schedule view across {timelineColumns.length} timeline segments.</p>
        </div>
        <div className="gantt-summary-card">
          <span className="small muted">Work items</span>
          <strong>{preparedTasks.length}</strong>
          <p className="small muted">Each row represents one scheduled task with a status-colored span.</p>
        </div>
      </div>

      <div className="gantt-legend">
        {Object.entries(timelineSummary.statusCounts).map(([status, count]) => (
          <div className="gantt-legend-item" key={status}>
            <span className={`legend-dot ${status}`} />
            <span>
              {STATUS_LABELS[status]}: {count}
            </span>
          </div>
        ))}
      </div>

      <div className="gantt-board">
        <div className="gantt-board-inner" style={{ minWidth: `${280 + timelineWidth}px` }}>
          <div className="gantt-board-row gantt-board-header">
            <div className="gantt-task-meta gantt-task-meta-header">
              <span>Task</span>
              <span>Schedule</span>
            </div>
            <div className="gantt-header-grid" style={{ gridTemplateColumns: `repeat(${timelineColumns.length}, ${VIEW_CONFIG[viewMode].cellWidth}px)` }}>
              {timelineColumns.map((column) => (
                <div className="gantt-header-cell" key={column.key}>
                  <span>{column.label}</span>
                </div>
              ))}
            </div>
          </div>

          {preparedTasks.map((task) => {
            const startOffsetDays = dayDiff(projectRange.start, task.start)
            const taskDurationDays = Math.max(1, dayDiff(task.start, task.end) + 1)
            const left = `${(startOffsetDays / totalDays) * 100}%`
            const width = `${Math.max((taskDurationDays / totalDays) * 100, 4)}%`

            return (
              <div className="gantt-board-row" key={task.id}>
                <div className="gantt-task-meta">
                  <strong>{task.name}</strong>
                  <div className="gantt-task-meta-stack">
                    <span className="gantt-meta-copy">
                      Assigned to <strong>{task.assigneeName}</strong>
                    </span>
                    <div className="gantt-task-meta-line">
                      <span>
                        {formatDate(task.start)} to {formatDate(task.end)}
                      </span>
                      <span className={`gantt-status-badge ${task.status}`}>{STATUS_LABELS[task.status]}</span>
                    </div>
                  </div>
                </div>

                <div
                  className="gantt-row-grid"
                  style={{
                    gridTemplateColumns: `repeat(${timelineColumns.length}, ${VIEW_CONFIG[viewMode].cellWidth}px)`,
                  }}
                >
                  {timelineColumns.map((column) => (
                    <div className="gantt-grid-cell" key={`${task.id}-${column.key}`} />
                  ))}

                  <div className="gantt-task-bar-track">
                    <div className={`gantt-task-bar ${task.status}`} style={{ left, width }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default ProjectGantt
