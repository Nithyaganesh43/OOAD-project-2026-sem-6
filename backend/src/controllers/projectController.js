const Project = require("../models/Project");
const Task = require("../models/Task");
const User = require("../models/User");
const WorkSession = require("../models/WorkSession");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { TASK_STATUSES, TIMELINE_STATUS } = require("../constants/task");
const { getAccessibleProject } = require("../services/projectAccessService");
const { isNonEmptyString, uniqueObjectIds } = require("../utils/validators");
const { ROLES } = require("../constants/roles");

const validateMembers = async (memberIds = []) => {
  const uniqueMemberIds = uniqueObjectIds(memberIds);

  if (!uniqueMemberIds.length) {
    return [];
  }

  const members = await User.find({
    _id: { $in: uniqueMemberIds },
    role: ROLES.USER,
    isActive: true,
  });

  if (members.length !== uniqueMemberIds.length) {
    throw new ApiError(
      400,
      "All project members must be active users with valid ids"
    );
  }

  return uniqueMemberIds;
};

const validateProjectDates = (startDate, endDate) => {
  const parsedStartDate = startDate ? new Date(startDate) : null;
  const parsedEndDate = endDate ? new Date(endDate) : null;

  if (!parsedStartDate || Number.isNaN(parsedStartDate.getTime())) {
    throw new ApiError(400, "Project startDate must be valid");
  }

  if (!parsedEndDate || Number.isNaN(parsedEndDate.getTime())) {
    throw new ApiError(400, "Project endDate must be valid");
  }

  if (parsedEndDate < parsedStartDate) {
    throw new ApiError(400, "Project endDate must be after startDate");
  }

  return { parsedStartDate, parsedEndDate };
};

const createProject = asyncHandler(async (req, res) => {
  const { name, description, startDate, endDate, memberIds = [], timeline } =
    req.body;

  if (!isNonEmptyString(name)) {
    throw new ApiError(400, "Project name is required");
  }

  const { parsedStartDate, parsedEndDate } = validateProjectDates(
    startDate,
    endDate
  );
  const members = await validateMembers(memberIds);

  const project = await Project.create({
    name: name.trim(),
    description: isNonEmptyString(description) ? description.trim() : "",
    startDate: parsedStartDate,
    endDate: parsedEndDate,
    members,
    createdBy: req.user._id,
    timeline: {
      completionPercent: timeline?.completionPercent ?? 0,
      statusLabel: timeline?.statusLabel || "not-started",
      note: timeline?.note || "",
      manuallyUpdatedAt: new Date(),
      manuallyUpdatedBy: req.user._id,
    },
  });

  const populatedProject = await Project.findById(project._id)
    .populate("members", "name email role isActive")
    .populate("createdBy", "name email role");

  res.status(201).json({
    message: "Project created successfully",
    project: populatedProject,
  });
});

const getProjects = asyncHandler(async (req, res) => {
  const query =
    req.user.role === ROLES.ADMIN
      ? {}
      : {
          members: req.user._id,
        };

  const projects = await Project.find(query)
    .populate("members", "name email role isActive")
    .populate("createdBy", "name email role")
    .sort({ createdAt: -1 });

  res.json({ projects });
});

const getProjectById = asyncHandler(async (req, res) => {
  const project = await getAccessibleProject(req.user, req.params.projectId);
  res.json({ project });
});

const updateProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.projectId);

  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  const {
    name,
    description,
    startDate,
    endDate,
    memberIds,
    timeline,
    isArchived,
  } = req.body;

  const nextStartDate = startDate || project.startDate;
  const nextEndDate = endDate || project.endDate;

  if (startDate || endDate) {
    const { parsedStartDate, parsedEndDate } = validateProjectDates(
      nextStartDate,
      nextEndDate
    );

    const taskOutsideTimeline = await Task.findOne({
      project: project._id,
      dueDate: { $ne: null },
      $or: [{ dueDate: { $lt: parsedStartDate } }, { dueDate: { $gt: parsedEndDate } }],
    });

    if (taskOutsideTimeline) {
      throw new ApiError(
        400,
        "Project dates cannot exclude existing task due dates"
      );
    }

    project.startDate = parsedStartDate;
    project.endDate = parsedEndDate;
  }

  if (isNonEmptyString(name)) {
    project.name = name.trim();
  }

  if (typeof description === "string") {
    project.description = description.trim();
  }

  if (Array.isArray(memberIds)) {
    const nextMembers = await validateMembers(memberIds);
    const taskWithRemovedAssignee = await Task.findOne({
      project: project._id,
      assignee: { $nin: nextMembers },
    });

    if (taskWithRemovedAssignee) {
      throw new ApiError(
        400,
        "Project members cannot be removed while tasks are still assigned to them"
      );
    }

    project.members = nextMembers;
  }

  if (timeline) {
    if (
      typeof timeline.completionPercent === "number" &&
      timeline.completionPercent >= 0 &&
      timeline.completionPercent <= 100
    ) {
      project.timeline.completionPercent = timeline.completionPercent;
    }

    if (
      timeline.statusLabel &&
      TIMELINE_STATUS.includes(timeline.statusLabel)
    ) {
      project.timeline.statusLabel = timeline.statusLabel;
    }

    if (typeof timeline.note === "string") {
      project.timeline.note = timeline.note.trim();
    }

    project.timeline.manuallyUpdatedAt = new Date();
    project.timeline.manuallyUpdatedBy = req.user._id;
  }

  if (typeof isArchived === "boolean") {
    project.isArchived = isArchived;
  }

  await project.save();

  const populatedProject = await Project.findById(project._id)
    .populate("members", "name email role isActive")
    .populate("createdBy", "name email role")
    .populate("timeline.manuallyUpdatedBy", "name email role");

  res.json({
    message: "Project updated successfully",
    project: populatedProject,
  });
});

const deleteProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.projectId);

  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  const [task, activeSession] = await Promise.all([
    Task.findOne({ project: project._id }),
    WorkSession.findOne({ project: project._id, status: "active" }),
  ]);

  if (task || activeSession) {
    throw new ApiError(
      400,
      "Project cannot be deleted while tasks or active sessions exist"
    );
  }

  await project.deleteOne();

  res.json({
    message: "Project deleted successfully",
    deletedProject: {
      _id: project._id,
      name: project.name,
    },
  });
});

const getProjectKanban = asyncHandler(async (req, res) => {
  const project = await getAccessibleProject(req.user, req.params.projectId);
  const taskQuery =
    req.user.role === ROLES.ADMIN
      ? {
          project: project._id,
          ...(req.query.assigneeId ? { assignee: req.query.assigneeId } : {}),
        }
      : { project: project._id, assignee: req.user._id };

  const tasks = await Task.find(taskQuery)
    .populate("assignee", "name email")
    .populate("createdBy", "name email")
    .sort({ createdAt: -1 });

  const columns = TASK_STATUSES.reduce((accumulator, status) => {
    accumulator[status] = tasks.filter((task) => task.status === status);
    return accumulator;
  }, {});

  res.json({
    project,
    columns,
    taskCount: tasks.length,
  });
});

const getProjectGantt = asyncHandler(async (req, res) => {
  const project = await getAccessibleProject(req.user, req.params.projectId);
  const taskQuery =
    req.user.role === ROLES.ADMIN
      ? {
          project: project._id,
          ...(req.query.assigneeId ? { assignee: req.query.assigneeId } : {}),
        }
      : { project: project._id, assignee: req.user._id };

  const tasks = await Task.find(taskQuery)
    .populate("assignee", "name email")
    .sort({ dueDate: 1, createdAt: 1 });

  const ganttItems = tasks.map((task) => ({
    id: task._id,
    name: task.title,
    start: task.createdAt,
    end: task.dueDate || project.endDate,
    status: task.status,
    priority: task.priority,
    progress:
      task.status === "completed"
        ? 100
        : task.status === "in-progress"
        ? 60
        : task.status === "blocked"
        ? 25
        : 0,
    assignee: task.assignee,
  }));

  res.json({
    project: {
      _id: project._id,
      name: project.name,
      startDate: project.startDate,
      endDate: project.endDate,
      timeline: project.timeline,
    },
    ganttItems,
    note:
      "Frontend can render this data using frappe-gantt or react-gantt-timeline.",
  });
});

module.exports = {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  getProjectKanban,
  getProjectGantt,
};
