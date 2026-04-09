import { useEffect, useMemo, useState } from 'react'
import { formatDate, formatDateTime, formatMinutes } from '../utils/format'

const DAY_MINUTES = 24 * 60

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

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const formatDateTimeParts = (value) => {
  if (!value) return { date: '-', time: '-' }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { date: '-', time: '-' }

  return {
    date: date.toLocaleDateString(),
    time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }
}

const getMonthConfig = (monthValue) => {
  const base = monthValue ? new Date(`${monthValue}-01T00:00:00`) : new Date()
  if (Number.isNaN(base.getTime())) return null

  const year = base.getFullYear()
  const monthIndex = base.getMonth()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()

  return {
    year,
    monthIndex,
    daysInMonth,
    label: base.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
  }
}

const packSessionsIntoLanes = (sessions, selectedDate) => {
  const dayStart = startOfDay(selectedDate)
  const dayEnd = endOfDay(selectedDate)

  if (!dayStart || !dayEnd) return { items: [], laneCount: 1 }

  const lanes = []
  const items = sessions
    .map((session) => {
      const checkIn = new Date(session.checkInAt)
      const rawCheckOut = session.checkOutAt ? new Date(session.checkOutAt) : dayEnd
      const rangeStart = checkIn < dayStart ? dayStart : checkIn
      const rangeEnd = rawCheckOut > dayEnd ? dayEnd : rawCheckOut

      return {
        session,
        rangeStart,
        rangeEnd,
      }
    })
    .filter((item) => item.rangeStart <= item.rangeEnd)
    .sort((left, right) => left.rangeStart.getTime() - right.rangeStart.getTime())
    .map((item) => {
      let laneIndex = lanes.findIndex((laneEnd) => item.rangeStart.getTime() >= laneEnd)

      if (laneIndex === -1) {
        laneIndex = lanes.length
        lanes.push(item.rangeEnd.getTime())
      } else {
        lanes[laneIndex] = item.rangeEnd.getTime()
      }

      const startMinutes = clamp(
        Math.round((item.rangeStart.getTime() - dayStart.getTime()) / 60000),
        0,
        DAY_MINUTES,
      )
      const endMinutes = clamp(
        Math.round((item.rangeEnd.getTime() - dayStart.getTime()) / 60000),
        0,
        DAY_MINUTES,
      )

      return {
        ...item,
        laneIndex,
        startMinutes,
        durationMinutes: Math.max(30, endMinutes - startMinutes || 30),
      }
    })

  return {
    items,
    laneCount: Math.max(1, lanes.length),
  }
}

const SessionPopup = ({ state, onClose, onSelectSession }) => {
  const activeSession =
    state?.sessions?.find((session) => session._id === state.activeSessionId) || state?.sessions?.[0] || null

  useEffect(() => {
    if (!state) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, state])

  if (!state || !activeSession) return null

  const checkInParts = formatDateTimeParts(activeSession.checkInAt)
  const checkOutParts = formatDateTimeParts(activeSession.checkOutAt)

  return (
    <div className="session-popup-backdrop" onClick={onClose}>
      <div className="session-popup" onClick={(event) => event.stopPropagation()}>
        <div className="session-popup-head">
          <div className="session-popup-copy">
            <p className="small muted">{state.title}</p>
            <h3>{activeSession.task?.title || 'Work session'}</h3>
            <p className="small muted">{state.subtitle}</p>
          </div>
          <div className="session-popup-actions">
            <span className={activeSession.status === 'active' ? 'session-status-badge active' : 'session-status-badge'}>
              {activeSession.status}
            </span>
            <button type="button" className="session-popup-close" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        {state.sessions.length > 1 ? (
          <div className="session-popup-switcher">
            {state.sessions.map((session) => (
              <button
                key={session._id}
                type="button"
                className={
                  session._id === activeSession._id
                    ? 'session-switch-btn active'
                    : 'session-switch-btn'
                }
                onClick={() => onSelectSession(session._id)}
              >
                {formatDateTime(session.checkInAt)}
              </button>
            ))}
          </div>
        ) : null}

        <div className="session-popup-grid">
          <div className="session-detail-metric">
            <span className="session-metric-label">User</span>
            <strong className="session-metric-value">{activeSession.user?.name || '-'}</strong>
          </div>
          <div className="session-detail-metric">
            <span className="session-metric-label">Project</span>
            <strong className="session-metric-value">{activeSession.project?.name || '-'}</strong>
          </div>
          <div className="session-detail-metric">
            <span className="session-metric-label">Check-in</span>
            <strong className="session-metric-value session-metric-value-time">
              <span>{checkInParts.date}</span>
              <span>{checkInParts.time}</span>
            </strong>
          </div>
          <div className="session-detail-metric">
            <span className="session-metric-label">Check-out</span>
            <strong className="session-metric-value session-metric-value-time">
              <span>{checkOutParts.date}</span>
              <span>{checkOutParts.time}</span>
            </strong>
          </div>
          <div className="session-detail-metric">
            <span className="session-metric-label">Duration</span>
            <strong className="session-metric-value">{formatMinutes(activeSession.durationMinutes)}</strong>
          </div>
          <div className="session-detail-metric">
            <span className="session-metric-label">Checkout status</span>
            <strong className="session-metric-value">{activeSession.checkoutTaskStatus || '-'}</strong>
          </div>
        </div>

        <div className="session-message-grid">
          <div className="session-message-card">
            <span className="small muted">Check-in note</span>
            <p>{activeSession.plannedWork || 'No check-in message recorded.'}</p>
          </div>
          <div className="session-message-card">
            <span className="small muted">Check-out note</span>
            <p>{activeSession.actualWork || 'No check-out message recorded.'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

const SessionDayTimeline = ({ sessions, selectedDate, onOpenSession }) => {
  const hours = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')}:00`)

  const groupedUsers = useMemo(() => {
    const userMap = new Map()

    sessions.forEach((session) => {
      const userId = session.user?._id || session.user?.email || session.user?.name || session._id
      const current = userMap.get(userId) || {
        id: userId,
        name: session.user?.name || 'Unknown user',
        sessions: [],
      }

      current.sessions.push(session)
      userMap.set(userId, current)
    })

    return Array.from(userMap.values())
      .map((user) => {
        const packed = packSessionsIntoLanes(user.sessions, selectedDate)
        return {
          ...user,
          laneCount: packed.laneCount,
          packedSessions: packed.items,
          trackedMinutes: user.sessions.reduce(
            (total, session) => total + (session.durationMinutes || 0),
            0,
          ),
        }
      })
      .sort((left, right) => right.trackedMinutes - left.trackedMinutes)
  }, [selectedDate, sessions])

  if (!groupedUsers.length) {
    return <div className="empty-box">No user activity recorded for this date.</div>
  }

  return (
    <div className="session-monitor-shell">
      <div className="session-monitor-note">
        <strong>24-hour coverage</strong>
        <span>Click a session bar to open its activity popup.</span>
      </div>

      <div className="session-day-board">
        <div className="session-day-board-inner">
          <div className="session-day-row session-day-header">
            <div className="session-user-meta session-user-meta-header">
              <span>User</span>
              <span>Tracked</span>
            </div>
            <div className="session-hour-grid" style={{ gridTemplateColumns: 'repeat(24, minmax(52px, 1fr))' }}>
              {hours.map((hour) => (
                <div key={hour} className="session-hour-cell">
                  {hour}
                </div>
              ))}
            </div>
          </div>

          {groupedUsers.map((user) => {
            const rowHeight = Math.max(72, 22 + user.laneCount * 24)

            return (
              <div className="session-day-row" key={user.id}>
                <div className="session-user-meta">
                  <strong>{user.name}</strong>
                  <span>{formatMinutes(user.trackedMinutes)}</span>
                </div>

                <div
                  className="session-hour-grid session-hour-row"
                  style={{ gridTemplateColumns: 'repeat(24, minmax(52px, 1fr))', minHeight: `${rowHeight}px` }}
                >
                  {hours.map((hour) => (
                    <div key={`${user.id}-${hour}`} className="session-grid-cell" />
                  ))}

                  <div className="session-bars-layer">
                    {user.packedSessions.map(({ session, laneIndex, startMinutes, durationMinutes }) => (
                      <button
                        key={session._id}
                        type="button"
                        className={session.status === 'active' ? 'session-bar active' : 'session-bar'}
                        style={{
                          left: `${(startMinutes / DAY_MINUTES) * 100}%`,
                          width: `${Math.max((durationMinutes / DAY_MINUTES) * 100, 1.2)}%`,
                          top: `${12 + laneIndex * 24}px`,
                        }}
                        title={`${user.name}: ${formatDateTime(session.checkInAt)} - ${formatDateTime(session.checkOutAt)}`}
                        onClick={() =>
                          onOpenSession({
                            title: 'Session activity',
                            subtitle: `${user.name} on ${formatDate(session.checkInAt)}`,
                            sessions: [session],
                            activeSessionId: session._id,
                          })
                        }
                      >
                        <span>{session.project?.name || session.task?.title || 'Session'}</span>
                      </button>
                    ))}
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

const SessionMonthMatrix = ({ sessions, selectedMonth, onOpenSession }) => {
  const monthConfig = useMemo(() => getMonthConfig(selectedMonth), [selectedMonth])

  const groupedUsers = useMemo(() => {
    if (!monthConfig) return []

    const userMap = new Map()

    sessions.forEach((session) => {
      const checkedDate = new Date(session.checkInAt)
      if (Number.isNaN(checkedDate.getTime())) return

      const userId = session.user?._id || session.user?.email || session.user?.name || session._id
      const current = userMap.get(userId) || {
        id: userId,
        name: session.user?.name || 'Unknown user',
        days: new Map(),
      }

      const day = checkedDate.getDate()
      const dayEntry = current.days.get(day) || { day, sessions: [] }
      dayEntry.sessions.push(session)
      current.days.set(day, dayEntry)
      userMap.set(userId, current)
    })

    return Array.from(userMap.values())
      .map((user) => ({
        ...user,
        activeDays: user.days,
      }))
      .sort((left, right) => left.name.localeCompare(right.name))
  }, [monthConfig, sessions])

  if (!monthConfig || !groupedUsers.length) {
    return <div className="empty-box">No check-in activity recorded for this month.</div>
  }

  const days = Array.from({ length: monthConfig.daysInMonth }, (_, index) => index + 1)

  return (
    <div className="session-monitor-shell">
      <div className="session-monitor-note">
        <strong>{monthConfig.label}</strong>
        <span>Click a green day cell to open the recorded session details.</span>
      </div>

      <div className="session-month-board">
        <div
          className="session-month-board-inner"
          style={{ minWidth: `${240 + monthConfig.daysInMonth * 34}px` }}
        >
          <div className="session-month-row session-month-header">
            <div className="session-user-meta session-user-meta-header">
              <span>User</span>
              <span>Presence</span>
            </div>
            <div
              className="session-month-grid"
              style={{ gridTemplateColumns: `repeat(${monthConfig.daysInMonth}, 34px)` }}
            >
              {days.map((day) => (
                <div className="session-month-cell session-month-head" key={day}>
                  {day}
                </div>
              ))}
            </div>
          </div>

          {groupedUsers.map((user) => (
            <div className="session-month-row" key={user.id}>
              <div className="session-user-meta">
                <strong>{user.name}</strong>
                <span>{user.activeDays.size} active days</span>
              </div>
              <div
                className="session-month-grid"
                style={{ gridTemplateColumns: `repeat(${monthConfig.daysInMonth}, 34px)` }}
              >
                {days.map((day) => {
                  const entry = user.activeDays.get(day)

                  return entry ? (
                    <button
                      key={`${user.id}-${day}`}
                      type="button"
                      className="session-month-cell active"
                      title={`${user.name} checked in on ${formatDate(new Date(monthConfig.year, monthConfig.monthIndex, day))}`}
                      onClick={() =>
                        onOpenSession({
                          title: 'Day activity',
                          subtitle: `${user.name} on ${formatDate(new Date(monthConfig.year, monthConfig.monthIndex, day))}`,
                          sessions: entry.sessions,
                          activeSessionId: entry.sessions[0]?._id,
                        })
                      }
                    />
                  ) : (
                    <div
                      className="session-month-cell"
                      key={`${user.id}-${day}`}
                      title={`${user.name} had no check-in on ${formatDate(new Date(monthConfig.year, monthConfig.monthIndex, day))}`}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const SessionMonitoring = ({ mode, sessions, selectedDate, selectedMonth }) => {
  const [popupState, setPopupState] = useState(null)

  const openPopup = (nextState) => setPopupState(nextState)
  const closePopup = () => setPopupState(null)

  return (
    <>
      {mode === 'month' ? (
        <SessionMonthMatrix sessions={sessions} selectedMonth={selectedMonth} onOpenSession={openPopup} />
      ) : (
        <SessionDayTimeline sessions={sessions} selectedDate={selectedDate} onOpenSession={openPopup} />
      )}

      <SessionPopup
        state={popupState}
        onClose={closePopup}
        onSelectSession={(sessionId) =>
          setPopupState((current) => (current ? { ...current, activeSessionId: sessionId } : current))
        }
      />
    </>
  )
}

export default SessionMonitoring
