const Task = require("../models/Task");
const WorkSession = require("../models/WorkSession");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { TASK_STATUSES } = require("../constants/task");
const { applyTaskTransition } = require("../utils/taskTransitions");
const { getDayRange, getMonthRange, getWorkDateKey } = require("../utils/date");
const { isNonEmptyString } = require("../utils/validators");

const checkIn = asyncHandler(async (req, res) => {
  const { taskId, plannedWork } = req.body;

  if (!isNonEmptyString(taskId) || !isNonEmptyString(plannedWork)) {
    throw new ApiError(400, "taskId and plannedWork are required");
  }

  const activeSession = await WorkSession.findOne({
    user: req.user._id,
    status: "active",
  });

  if (activeSession) {
    throw new ApiError(400, "User already has an active work session");
  }

  const task = await Task.findOne({
    _id: taskId,
    assignee: req.user._id,
  }).populate("project");

  if (!task) {
    throw new ApiError(404, "Assigned task not found");
  }

  if (task.status === "completed") {
    throw new ApiError(400, "Completed tasks cannot be checked in again");
  }

  const now = new Date();
  const session = await WorkSession.create({
    user: req.user._id,
    project: task.project._id,
    task: task._id,
    workDate: getWorkDateKey(now),
    plannedWork: plannedWork.trim(),
    checkInAt: now,
    status: "active",
  });

  const populatedSession = await WorkSession.findById(session._id)
    .populate("project", "name startDate endDate")
    .populate("task", "title status priority dueDate");

  res.status(201).json({
    message: "Check-in recorded successfully",
    session: populatedSession,
  });
});

const checkOut = asyncHandler(async (req, res) => {
  const { actualWork, taskStatus } = req.body;

  if (!isNonEmptyString(actualWork)) {
    throw new ApiError(400, "actualWork is required");
  }

  if (!TASK_STATUSES.includes(taskStatus)) {
    throw new ApiError(400, "A valid taskStatus is required on checkout");
  }

  const session = await WorkSession.findOne({
    _id: req.params.sessionId,
    user: req.user._id,
    status: "active",
  });

  if (!session) {
    throw new ApiError(404, "Active work session not found");
  }

  const task = await Task.findOne({
    _id: session.task,
    assignee: req.user._id,
  });

  if (!task) {
    throw new ApiError(404, "Assigned task not found");
  }

  if (task.status !== taskStatus) {
    applyTaskTransition({
      task,
      nextStatus: taskStatus,
      actor: req.user,
      source: "check-out",
      message: actualWork.trim(),
    });
  } else {
    task.statusUpdatedAt = new Date();
  }

  await task.save();

  const now = new Date();
  const durationMinutes = Math.max(
    1,
    Math.round((now.getTime() - session.checkInAt.getTime()) / 60000)
  );

  session.actualWork = actualWork.trim();
  session.checkOutAt = now;
  session.durationMinutes = durationMinutes;
  session.checkoutTaskStatus = taskStatus;
  session.status = "closed";

  await session.save();

  const populatedSession = await WorkSession.findById(session._id)
    .populate("project", "name startDate endDate")
    .populate("task", "title status priority dueDate")
    .populate("user", "name email");

  res.json({
    message: "Check-out recorded successfully",
    session: populatedSession,
  });
});

const getMySessions = asyncHandler(async (req, res) => {
  const sessions = await WorkSession.find({ user: req.user._id })
    .populate("project", "name")
    .populate("task", "title status")
    .sort({ checkInAt: -1 });

  res.json({ sessions });
});

const getMySessionOverview = asyncHandler(async (req, res) => {
  const query = { user: req.user._id };
  let filter = {
    mode: "all",
    key: null,
  };

  if (req.query.month) {
    const range = getMonthRange(req.query.month);

    if (!range) {
      throw new ApiError(400, "month must use YYYY-MM format");
    }

    query.checkInAt = {
      $gte: range.start,
      $lte: range.end,
    };

    filter = {
      mode: "month",
      key: range.key,
      daysInMonth: range.daysInMonth,
      start: range.start,
      end: range.end,
    };
  } else if (req.query.date) {
    const range = getDayRange(req.query.date);

    if (!range) {
      throw new ApiError(400, "date must use YYYY-MM-DD format");
    }

    query.checkInAt = {
      $gte: range.start,
      $lte: range.end,
    };

    filter = {
      mode: "day",
      key: range.key,
      start: range.start,
      end: range.end,
    };
  }

  const sessions = await WorkSession.find(query)
    .populate("user", "name email")
    .populate("project", "name")
    .populate("task", "title status priority")
    .sort({ checkInAt: -1 });

  const totalMinutes = sessions.reduce(
    (accumulator, session) => accumulator + (session.durationMinutes || 0),
    0
  );

  res.json({
    filter,
    totalSessions: sessions.length,
    totalMinutes,
    activeSessions: sessions.filter((session) => session.status === "active")
      .length,
    sessions,
  });
});

const getMyTodaySessions = asyncHandler(async (req, res) => {
  const range = getDayRange(req.query.date);

  if (!range) {
    throw new ApiError(400, "date must use YYYY-MM-DD format");
  }

  const sessions = await WorkSession.find({
    user: req.user._id,
    checkInAt: {
      $gte: range.start,
      $lte: range.end,
    },
  })
    .populate("project", "name")
    .populate("task", "title status")
    .sort({ checkInAt: -1 });

  const totalMinutes = sessions.reduce(
    (accumulator, session) => accumulator + (session.durationMinutes || 0),
    0
  );

  res.json({
    workDate: range.key,
    totalMinutes,
    sessions,
  });
});

const getAdminSessionOverview = asyncHandler(async (req, res) => {
  const query = {};
  let filter = {
    mode: "all",
    key: null,
  };

  if (req.query.month) {
    const range = getMonthRange(req.query.month);

    if (!range) {
      throw new ApiError(400, "month must use YYYY-MM format");
    }

    query.checkInAt = {
      $gte: range.start,
      $lte: range.end,
    };

    filter = {
      mode: "month",
      key: range.key,
      daysInMonth: range.daysInMonth,
      start: range.start,
      end: range.end,
    };
  } else if (req.query.date) {
    const range = getDayRange(req.query.date);

    if (!range) {
      throw new ApiError(400, "date must use YYYY-MM-DD format");
    }

    query.checkInAt = {
      $gte: range.start,
      $lte: range.end,
    };

    filter = {
      mode: "day",
      key: range.key,
      start: range.start,
      end: range.end,
    };
  }

  if (req.query.projectId) {
    query.project = req.query.projectId;
  }

  if (req.query.userId) {
    query.user = req.query.userId;
  }

  const sessions = await WorkSession.find(query)
    .populate("user", "name email")
    .populate("project", "name")
    .populate("task", "title status priority")
    .sort({ checkInAt: -1 });

  const totalMinutes = sessions.reduce(
    (accumulator, session) => accumulator + (session.durationMinutes || 0),
    0
  );

  res.json({
    filter,
    totalSessions: sessions.length,
    totalMinutes,
    activeSessions: sessions.filter((session) => session.status === "active")
      .length,
    sessions,
  });
});

module.exports = {
  checkIn,
  checkOut,
  getMySessions,
  getMySessionOverview,
  getMyTodaySessions,
  getAdminSessionOverview,
};
