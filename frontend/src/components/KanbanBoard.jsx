import { useState } from 'react'
import { PRIORITY_LABELS, STATUS_LABELS, TASK_STATUSES } from '../utils/constants'
import { formatDate, formatDateTime } from '../utils/format'

const KanbanBoard = ({
  columns,
  canMove,
  onMove,
  moveHint,
  showAssignee = false,
  getAllowedStatuses,
}) => {
  const [draggedTask, setDraggedTask] = useState(null)
  const [dropStatus, setDropStatus] = useState('')
  const [movingTaskId, setMovingTaskId] = useState('')

  const canDropTask = (task, nextStatus) => {
    if (!canMove || !task || task.status === nextStatus || movingTaskId) {
      return false
    }

    if (!getAllowedStatuses) {
      return true
    }

    return getAllowedStatuses(task).includes(nextStatus)
  }

  const handleDrop = async (nextStatus, sourceTask = draggedTask) => {
    if (!canDropTask(sourceTask, nextStatus)) {
      setDropStatus('')
      return
    }

    try {
      setMovingTaskId(sourceTask._id)
      await onMove(sourceTask, nextStatus)
    } finally {
      setDraggedTask(null)
      setDropStatus('')
      setMovingTaskId('')
    }
  }

  return (
    <>
      {moveHint ? <div className="kanban-note">{moveHint}</div> : null}

      <div className="kanban-grid">
        {TASK_STATUSES.map((status) => {
          const tasks = columns?.[status] || []
          const isDropTarget = dropStatus === status && canDropTask(draggedTask, status)

          return (
            <section
              className={isDropTarget ? 'kanban-column is-drop-target' : 'kanban-column'}
              key={status}
              onDragOver={(event) => {
                if (!canDropTask(draggedTask, status)) return
                event.preventDefault()
                setDropStatus(status)
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setDropStatus((current) => (current === status ? '' : current))
                }
              }}
              onDrop={async (event) => {
                event.preventDefault()
                await handleDrop(status)
              }}
            >
              <div className="kanban-column-header">
                <h3>{STATUS_LABELS[status]}</h3>
                <span>{tasks.length}</span>
              </div>

              <div className="kanban-cards">
                {tasks.map((task) => {
                  const allowedStatuses = getAllowedStatuses
                    ? getAllowedStatuses(task)
                    : TASK_STATUSES.filter((nextStatus) => nextStatus !== task.status)
                  const canDragTask = canMove && allowedStatuses.length > 0

                  return (
                    <article
                      className={movingTaskId === task._id ? 'task-card is-moving' : 'task-card'}
                      key={task._id}
                      draggable={canDragTask}
                      onDragStart={(event) => {
                        if (!canDragTask || movingTaskId) return
                        event.dataTransfer.effectAllowed = 'move'
                        setDraggedTask(task)
                      }}
                      onDragEnd={() => {
                        setDraggedTask(null)
                        setDropStatus('')
                      }}
                    >
                      <div className="task-card-head">
                        <p className="task-title">{task.title}</p>
                        <span className={`task-priority-badge ${task.priority}`}>
                          {PRIORITY_LABELS[task.priority]}
                        </span>
                      </div>

                      <div className="task-chip-row">
                        <span className="task-chip">Due {formatDate(task.dueDate)}</span>
                        {showAssignee && task.assignee ? (
                          <span className="task-chip">Assignee: {task.assignee.name}</span>
                        ) : null}
                      </div>

                      {(canMove || task.statusUpdatedAt || (showAssignee && task.assignee)) ? (
                        <details className="task-details">
                          <summary>Details & actions</summary>
                          <div className="task-details-body">
                            <p className="muted small">Updated {formatDateTime(task.statusUpdatedAt)}</p>
                            {canMove ? (
                              <p className="muted small">
                                {canDragTask ? 'Drag card or use quick move below.' : 'No further status changes are available.'}
                              </p>
                            ) : null}
                            {canMove && allowedStatuses.length ? (
                              <div className="task-actions">
                                {allowedStatuses.map((nextStatus) => (
                                  <button
                                    key={nextStatus}
                                    type="button"
                                    className="task-action-btn"
                                    disabled={Boolean(movingTaskId)}
                                    onClick={() => handleDrop(nextStatus, task)}
                                  >
                                    {STATUS_LABELS[nextStatus]}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </details>
                      ) : null}
                    </article>
                  )
                })}

                {!tasks.length ? <div className="empty-box">No tasks</div> : null}
              </div>
            </section>
          )
        })}
      </div>
    </>
  )
}

export default KanbanBoard
