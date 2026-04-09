const Project = require("../models/Project");
const Task = require("../models/Task");
const User = require("../models/User");
const WorkSession = require("../models/WorkSession");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { TASK_PRIORITIES, TASK_STATUSES } = require("../constants/task");
const { applyTaskTransition } = require("../utils/taskTransitions");
const { isNonEmptyString } = require("../utils/validators");
const { ROLES } = require("../constants/roles");

const ensureProjectAndAssignee = async ({ projectId, assigneeId, dueDate }) => {
  const project = await Project.findById(projectId);

  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  if (project.isArchived) {
    throw new ApiError(400, "Archived projects cannot receive new or updated tasks");
  }

  const assignee = await User.findOne({
    _id: assigneeId,
    role: ROLES.USER,
    isActive: true,
  });

  if (!assignee) {
    throw new ApiError(400, "Task assignee must be an active user");
  }

  const isMember = project.members.some(
    (memberId) => memberId.toString() === assignee._id.toString()
  );

  if (!isMember) {
    throw new ApiError(400, "Task assignee must already belong to the project");
  }

  if (dueDate) {
    const parsedDueDate = new Date(dueDate);

    if (Number.isNaN(parsedDueDate.getTime())) {
      throw new ApiError(400, "Task dueDate must be valid");
    }

    if (parsedDueDate < project.startDate || parsedDueDate > project.endDate) {
      throw new ApiError(
        400,
        "Task dueDate must stay within the project start and end dates"
      );
    }
  }

  return { project, assignee };
};

const getTasks = asyncHandler(async (req, res) => {
  const query = {};

  if (req.user.role === ROLES.USER) {
    query.assignee = req.user._id;
  }

  if (req.query.projectId) {
    query.project = req.query.projectId;
  }

  if (req.query.assigneeId && req.user.role === ROLES.ADMIN) {
    query.assignee = req.query.assigneeId;
  }

  if (req.query.status) {
    query.status = req.query.status;
  }

  const tasks = await Task.find(query)
    .populate("project", "name startDate endDate")
    .populate("assignee", "name email")
    .populate("createdBy", "name email")
    .populate("statusHistory.changedBy", "name email role")
    .sort({ createdAt: -1 });

  res.json({ tasks });
});

const createTask = asyncHandler(async (req, res) => {
  const {
    projectId,
    assigneeId,
    title,
    description,
    priority = "medium",
    dueDate,
    status = "todo",
  } = req.body;

  if (
    !isNonEmptyString(projectId) ||
    !isNonEmptyString(assigneeId) ||
    !isNonEmptyString(title)
  ) {
    throw new ApiError(400, "projectId, assigneeId, and title are required");
  }

  if (!TASK_PRIORITIES.includes(priority)) {
    throw new ApiError(400, "Task priority is invalid");
  }

  if (!TASK_STATUSES.includes(status)) {
    throw new ApiError(400, "Task status is invalid");
  }

  await ensureProjectAndAssignee({ projectId, assigneeId, dueDate });

  const task = await Task.create({
    project: projectId,
    assignee: assigneeId,
    title: title.trim(),
    description: typeof description === "string" ? description.trim() : "",
    priority,
    dueDate: dueDate || null,
    status,
    createdBy: req.user._id,
    statusUpdatedAt: new Date(),
    statusHistory: [
      {
        fromStatus: null,
        toStatus: status,
        changedBy: req.user._id,
        source: "admin-panel",
        message: "Task created",
      },
    ],
  });

  const populatedTask = await Task.findById(task._id)
    .populate("project", "name startDate endDate")
    .populate("assignee", "name email")
    .populate("createdBy", "name email");

  res.status(201).json({
    message: "Task created successfully",
    task: populatedTask,
  });
});

const getTaskById = asyncHandler(async (req, res) => {
  const query =
    req.user.role === ROLES.ADMIN
      ? { _id: req.params.taskId }
      : { _id: req.params.taskId, assignee: req.user._id };

  const task = await Task.findOne(query)
    .populate("project", "name startDate endDate members")
    .populate("assignee", "name email")
    .populate("createdBy", "name email")
    .populate("statusHistory.changedBy", "name email role");

  if (!task) {
    throw new ApiError(404, "Task not found or not accessible");
  }

  res.json({ task });
});

const updateTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.taskId);

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  const { projectId, assigneeId, title, description, priority, dueDate, status } =
    req.body;

  const nextProjectId = projectId || task.project.toString();
  const nextAssigneeId = assigneeId || task.assignee.toString();

  await ensureProjectAndAssignee({
    projectId: nextProjectId,
    assigneeId: nextAssigneeId,
    dueDate: dueDate || task.dueDate,
  });

  const activeSession = await WorkSession.findOne({
    task: task._id,
    status: "active",
  });

  if (activeSession && (projectId || assigneeId)) {
    throw new ApiError(
      400,
      "Task project or assignee cannot be changed while a work session is active"
    );
  }

  task.project = nextProjectId;
  task.assignee = nextAssigneeId;

  if (isNonEmptyString(title)) {
    task.title = title.trim();
  }

  if (typeof description === "string") {
    task.description = description.trim();
  }

  if (priority) {
    if (!TASK_PRIORITIES.includes(priority)) {
      throw new ApiError(400, "Task priority is invalid");
    }
    task.priority = priority;
  }

  if (dueDate !== undefined) {
    task.dueDate = dueDate || null;
  }

  if (status) {
    if (!TASK_STATUSES.includes(status)) {
      throw new ApiError(400, "Task status is invalid");
    }

    applyTaskTransition({
      task,
      nextStatus: status,
      actor: req.user,
      source: "admin-panel",
      message: "Task updated by admin",
    });
  }

  await task.save();

  const populatedTask = await Task.findById(task._id)
    .populate("project", "name startDate endDate")
    .populate("assignee", "name email")
    .populate("createdBy", "name email")
    .populate("statusHistory.changedBy", "name email role");

  res.json({
    message: "Task updated successfully",
    task: populatedTask,
  });
});

const updateTaskStatus = asyncHandler(async (req, res) => {
  const { status, message } = req.body;

  if (!TASK_STATUSES.includes(status)) {
    throw new ApiError(400, "Task status is invalid");
  }

  const query =
    req.user.role === ROLES.ADMIN
      ? { _id: req.params.taskId }
      : { _id: req.params.taskId, assignee: req.user._id };

  const task = await Task.findOne(query);

  if (!task) {
    throw new ApiError(404, "Task not found or not accessible");
  }

  applyTaskTransition({
    task,
    nextStatus: status,
    actor: req.user,
    source: "kanban",
    message: typeof message === "string" ? message.trim() : "",
  });

  await task.save();

  const populatedTask = await Task.findById(task._id)
    .populate("project", "name startDate endDate")
    .populate("assignee", "name email")
    .populate("statusHistory.changedBy", "name email role");

  res.json({
    message: "Task status updated successfully",
    task: populatedTask,
  });
});

const deleteTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.taskId);

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  const activeSession = await WorkSession.findOne({
    task: task._id,
    status: "active",
  });

  if (activeSession) {
    throw new ApiError(400, "Task cannot be deleted while a work session is active");
  }

  await task.deleteOne();

  res.json({
    message: "Task deleted successfully",
    deletedTask: {
      _id: task._id,
      title: task.title,
    },
  });
});

module.exports = {
  getTasks,
  createTask,
  getTaskById,
  updateTask,
  updateTaskStatus,
  deleteTask,
};
