"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {recordsForRange, metrics} = require("../analytics.js");

const records = [
  {date:"2026-08-27",status:"POSTED"},
  {date:"2026-08-27",status:"GENERATED"},
  {date:"2026-08-26",status:"FAILED"},
  {date:"2026-08-25",status:"MISSED"},
  {date:"2026-08-21",status:"POSTED"},
  {date:"2026-07-01",status:"CANCELLED"},
];

test("calendar ranges use the configured local-date value", () => {
  assert.equal(recordsForRange(records,"2026-08-27","TODAY").length,2);
  assert.equal(recordsForRange(records,"2026-08-27","3D").length,4);
  assert.equal(recordsForRange(records,"2026-08-27","7D").length,5);
  assert.equal(recordsForRange(records,"2026-08-27","30D").length,5);
  assert.equal(recordsForRange(records,"2026-08-27","ALL").length,6);
});

test("future generated and cancelled records do not reduce success rate", () => {
  const result=metrics(records);
  assert.equal(result.posted,2);
  assert.equal(result.readyGenerated,1);
  assert.equal(result.failed,1);
  assert.equal(result.missed,1);
  assert.equal(result.successRate,50);
});

test("a range containing only future work has no misleading success rate", () => {
  assert.equal(metrics([{date:"2026-08-27",status:"GENERATED"}]).successRate,null);
});
