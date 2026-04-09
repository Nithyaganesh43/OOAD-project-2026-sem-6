const ApiError = require("./ApiError");
const { USER_ALLOWED_STATUS_TRANSITIONS } = require("../constants/task");
const { ROLES } = require("../constants/roles");

const validateTaskTransition = ({ currentStatus, nextStatus, actorRole }) => {
  if (currentStatus === nextStatus) {
    return;
  }

  if (actorRole === ROLES.ADMIN) {
    return;
  }

  const allowed = USER_ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];

  if (!allowed.includes(nextStatus)) {
    throw new ApiError(
      400,
      `Task status cannot move from ${currentStatus} to ${nextStatus}`
    );
  }
};

const applyTaskTransition = ({
  task,
  nextStatus,
  actor,
  source = "kanban",
  message = "",
}) => {
  validateTaskTransition({
    currentStatus: task.status,
    nextStatus,
    actorRole: actor.role,
  });

  if (task.status === nextStatus) {
    task.statusUpdatedAt = new Date();
    return task;
  }

  const now = new Date();

  task.statusHistory.push({
    fromStatus: task.status,
    toStatus: nextStatus,
    changedBy: actor._id,
    changedAt: now,
    source,
    message: message || "",
  });

  task.status = nextStatus;
  task.statusUpdatedAt = now;
  task.completedAt = nextStatus === "completed" ? now : null;

  return task;
};

module.exports = {
  applyTaskTransition,
  validateTaskTransition,
};
