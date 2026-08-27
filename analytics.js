"use strict";

(function expose(root) {
  const RANGE_DAYS = {TODAY:1,"3D":3,"7D":7,"30D":30};

  function subtractCalendarDays(dateText, count) {
    const date = new Date(`${dateText}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - count);
    return date.toISOString().slice(0,10);
  }

  function recordsForRange(records, today, range) {
    if (range === "ALL") return [...records];
    if (!Object.hasOwn(RANGE_DAYS, range)) throw new Error("Unsupported analytics range");
    const start = subtractCalendarDays(today, RANGE_DAYS[range] - 1);
    return records.filter(record => record.date >= start && record.date <= today);
  }

  function metrics(records) {
    const count = status => records.filter(record => record.status === status).length;
    const posted = count("POSTED");
    const missed = count("MISSED");
    const failed = count("FAILED") + count("AUTH_REQUIRED");
    const readyGenerated = count("READY") + count("GENERATED") + count("PROCESSING");
    const completedEligible = posted + missed + failed;
    return {
      total:records.length, posted, missed, failed, readyGenerated,
      successRate:completedEligible ? (posted/completedEligible)*100 : null,
    };
  }

  const api = {RANGE_DAYS, subtractCalendarDays, recordsForRange, metrics};
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.VoxynAnalytics = api;
})(typeof window !== "undefined" ? window : globalThis);
