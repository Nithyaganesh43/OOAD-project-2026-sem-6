const mongoose = require("mongoose");
const { TASK_PRIORITIES, TASK_STATUSES } = require("../constants/task");

const taskSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    priority: {
      type: String,
      enum: TASK_PRIORITIES,
      default: "medium",
    },
    dueDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: TASK_STATUSES,
      default: "todo",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    statusUpdatedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    statusHistory: [
      {
        fromStatus: {
          type: String,
          enum: TASK_STATUSES,
          default: null,
        },
        toStatus: {
          type: String,
          enum: TASK_STATUSES,
          required: true,
        },
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
        source: {
          type: String,
          enum: ["admin-panel", "kanban", "check-out"],
          default: "kanban",
        },
        message: {
          type: String,
          default: "",
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Task", taskSchema);
