const mongoose = require("mongoose");
const { TIMELINE_STATUS } = require("../constants/task");

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
      validate: {
        validator(value) {
          return !this.startDate || value >= this.startDate;
        },
        message: "Project end date must be after start date",
      },
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    timeline: {
      completionPercent: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
      statusLabel: {
        type: String,
        enum: TIMELINE_STATUS,
        default: "not-started",
      },
      note: {
        type: String,
        default: "",
        trim: true,
      },
      manuallyUpdatedAt: {
        type: Date,
        default: null,
      },
      manuallyUpdatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Project", projectSchema);
