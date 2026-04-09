const Project = require("../models/Project");
const ApiError = require("../utils/ApiError");
const { ROLES } = require("../constants/roles");

const getAccessibleProject = async (user, projectId) => {
  const query =
    user.role === ROLES.ADMIN
      ? { _id: projectId }
      : { _id: projectId, members: user._id };

  const project = await Project.findOne(query)
    .populate("members", "name email role isActive")
    .populate("createdBy", "name email role");

  if (!project) {
    throw new ApiError(404, "Project not found or not accessible");
  }

  return project;
};

module.exports = {
  getAccessibleProject,
};
