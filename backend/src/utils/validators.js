const mongoose = require("mongoose");

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const uniqueObjectIds = (values = []) => [...new Set(values.map(String))];

module.exports = {
  isNonEmptyString,
  isValidObjectId,
  uniqueObjectIds,
};
