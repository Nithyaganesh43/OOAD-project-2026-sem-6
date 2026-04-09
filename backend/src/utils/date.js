const parseLocalDate = (value) => {
  if (!value || typeof value !== "string") {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

const getWorkDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDayRange = (dateString) => {
  const baseDate = dateString ? parseLocalDate(dateString) : new Date();

  if (!baseDate || Number.isNaN(baseDate.getTime())) {
    return null;
  }

  const start = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    0,
    0,
    0,
    0
  );

  const end = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    23,
    59,
    59,
    999
  );

  return {
    key: getWorkDateKey(baseDate),
    start,
    end,
  };
};

const getMonthRange = (monthString) => {
  const safeValue =
    typeof monthString === "string" && /^\d{4}-\d{2}$/.test(monthString)
      ? `${monthString}-01`
      : null;

  const baseDate = safeValue ? parseLocalDate(safeValue) : new Date();

  if (!baseDate || Number.isNaN(baseDate.getTime())) {
    return null;
  }

  const start = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    1,
    0,
    0,
    0,
    0
  );

  const end = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );

  const month = String(baseDate.getMonth() + 1).padStart(2, "0");

  return {
    key: `${baseDate.getFullYear()}-${month}`,
    start,
    end,
    daysInMonth: end.getDate(),
  };
};

module.exports = {
  getDayRange,
  getMonthRange,
  getWorkDateKey,
  parseLocalDate,
};
