const mongoose = require("mongoose");
const { TASK_STATUSES } = require("../constants/task");

const workSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
      index: true,
    },
    workDate: {
      type: String,
      required: true,
      index: true,
    },
    plannedWork: {
      type: String,
      required: true,
      trim: true,
    },
    actualWork: {
      type: String,
      default: "",
      trim: true,
    },
    checkInAt: {
      type: Date,
      required: true,
    },
    checkOutAt: {
      type: Date,
      default: null,
    },
    durationMinutes: {
      type: Number,
      default: 0,
    },
    checkoutTaskStatus: {
      type: String,
      enum: TASK_STATUSES,
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "closed"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("WorkSession", workSessionSchema);
