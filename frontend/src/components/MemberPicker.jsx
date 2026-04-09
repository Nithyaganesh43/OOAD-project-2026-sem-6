const MemberPicker = ({ users, selectedIds, onChange }) => {
  const toggleMember = (userId) => {
    if (selectedIds.includes(userId)) {
      onChange(selectedIds.filter((id) => id !== userId))
      return
    }

    onChange([...selectedIds, userId])
  }

  if (!users.length) {
    return <div className="empty-box">No active team members available</div>
  }

  return (
    <div className="member-picker">
      <div className="member-picker-header">
        <p className="small muted">Selected team members</p>
        <strong>{selectedIds.length}</strong>
      </div>

      <div className="member-grid">
        {users.map((user) => {
          const isSelected = selectedIds.includes(user._id)
          const initials = user.name
            .split(' ')
            .map((part) => part[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()

          return (
            <button
              key={user._id}
              type="button"
              className={isSelected ? 'member-card selected' : 'member-card'}
              onClick={() => toggleMember(user._id)}
              aria-pressed={isSelected}
            >
              <span className="member-avatar">{initials}</span>
              <span className="member-copy">
                <strong>{user.name}</strong>
                <small>{user.email}</small>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default MemberPicker
