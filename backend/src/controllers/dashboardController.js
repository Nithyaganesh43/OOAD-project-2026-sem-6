const Project = require("../models/Project");
const Task = require("../models/Task");
const User = require("../models/User");
const WorkSession = require("../models/WorkSession");
const asyncHandler = require("../utils/asyncHandler");
const { TASK_STATUSES } = require("../constants/task");
const { getWorkDateKey } = require("../utils/date");

const getAdminDashboard = asyncHandler(async (_req, res) => {
  const [
    totalUsers,
    activeUsers,
    totalProjects,
    totalTasks,
    activeSessions,
    tasksByStatusRaw,
    recentProjects,
  ] = await Promise.all([
    User.countDocuments({ role: "user" }),
    User.countDocuments({ role: "user", isActive: true }),
    Project.countDocuments(),
    Task.countDocuments(),
    WorkSession.countDocuments({ status: "active" }),
    Task.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Project.find()
      .populate("members", "name email")
      .sort({ createdAt: -1 })
      .limit(5),
  ]);

  const tasksByStatus = TASK_STATUSES.reduce((accumulator, status) => {
    const matched = tasksByStatusRaw.find((item) => item._id === status);
    accumulator[status] = matched ? matched.count : 0;
    return accumulator;
  }, {});

  res.json({
    summary: {
      totalUsers,
      activeUsers,
      totalProjects,
      totalTasks,
      activeSessions,
      tasksByStatus,
    },
    recentProjects,
  });
});

const getUserDashboard = asyncHandler(async (req, res) => {
  const todayKey = getWorkDateKey(new Date());

  const [projects, tasks, activeSession, todaySessions] = await Promise.all([
    Project.find({ members: req.user._id })
      .populate("members", "name email")
      .sort({ createdAt: -1 }),
    Task.find({ assignee: req.user._id })
      .populate("project", "name startDate endDate")
      .sort({ dueDate: 1, createdAt: -1 }),
    WorkSession.findOne({ user: req.user._id, status: "active" })
      .populate("project", "name")
      .populate("task", "title status"),
    WorkSession.find({ user: req.user._id, workDate: todayKey })
      .populate("task", "title status")
      .populate("project", "name")
      .sort({ checkInAt: -1 }),
  ]);

  const tasksByStatus = TASK_STATUSES.reduce((accumulator, status) => {
    accumulator[status] = tasks.filter((task) => task.status === status).length;
    return accumulator;
  }, {});

  res.json({
    summary: {
      assignedProjects: projects.length,
      assignedTasks: tasks.length,
      activeSession,
      tasksByStatus,
    },
    projects,
    tasks,
    todaySessions,
  });
});

module.exports = {
  getAdminDashboard,
  getUserDashboard,
};
