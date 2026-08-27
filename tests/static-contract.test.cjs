"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

test("site has no private production dependencies", () => {
  const html = read("index.html");
  assert.match(html, /dashboard\.css/);
  assert.match(html, /dashboard\.js/);
  assert.doesNotMatch(html, /Slack|member_urn|access_token|linkedin_publish_history/i);
});

test("captions use safe DOM construction", () => {
  const source = read("dashboard.js");
  assert.match(source, /textContent/);
  assert.doesNotMatch(source, /innerHTML|insertAdjacentHTML|document\.write/);
  assert.match(source, /noopener noreferrer/);
  assert.match(source, /safeSourceUrl/);
});

test("browser refresh, clock and countdown are present", () => {
  const source = read("dashboard.js");
  assert.match(source, /status\.json\?ts=/);
  assert.match(source, /method:"GET"/);
  assert.match(source, /setInterval\(refreshStatus,REFRESH_INTERVAL_MS\)/);
  assert.match(source, /setInterval\(updateClock,1000\)/);
  assert.match(source, /setInterval\(updateCountdown,1000\)/);
  assert.match(source, /history\.json\?ts=/);
  assert.match(source, /REFRESH_INTERVAL_MS = 45000/);
});

test("responsive mobile layout and health pulse exist", () => {
  const css = read("dashboard.css");
  assert.match(css, /@media\(max-width:580px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /@keyframes health-pulse/);
  assert.match(css, /health-card\.active \.health-dot/);
  assert.match(css, /health-card\.unknown \.health-dot/);
  assert.match(css, /health-card\.error \.health-dot/);
  assert.match(css, /:root\[data-theme="dark"\]/);
  assert.match(css, /@media\(max-width:580px\)/);
});

test("light is the default and theme preference is limited to one key", () => {
  const html = read("index.html");
  const source = read("dashboard.js");
  assert.match(html, /data-theme="light"/);
  assert.match(html, /id="theme-toggle"/);
  assert.match(source, /voxyn-dashboard-theme/);
  assert.match(source, /localStorage\.setItem\(THEME_STORAGE_KEY, theme\)/);
  assert.doesNotMatch(source, /localStorage\.setItem\([^T]/);
  assert.match(source, /let currentRange = "TODAY"/);
});

test("range selector and sanitized history view are present", () => {
  const html = read("index.html");
  for (const range of ["TODAY","3D","7D","30D","ALL"]) assert.match(html, new RegExp(`data-range="${range}"`));
  assert.match(html, /id="history-rows"/);
  assert.doesNotMatch(html, /POST_ID|LinkedIn Post ID/);
});

test("status is schema-only and contains no private identifiers", () => {
  const raw = read("status.json");
  const status = JSON.parse(raw);
  assert.equal(status.schema_version, 1);
  assert.ok(Array.isArray(status.posts));
  const forbiddenValues = ["slack_channel_id","file_id","member_urn","claim_id","access_token","refresh_token","oauth_code","xox"+"b-","urn:"+"li:","linkedin.com"+"/in/"];
  for (const forbidden of forbiddenValues) {
    assert.equal(raw.toLowerCase().includes(forbidden), false, forbidden);
  }
});

test("history is schema-only and contains no private identifiers", () => {
  const raw = read("history.json");
  const history = JSON.parse(raw);
  assert.equal(history.schema_version, 1);
  assert.ok(Array.isArray(history.records));
  for (const forbidden of ["post_id","slack_channel_id","file_id","member_urn","claim_id","access_token","refresh_token","oauth_code","linkedin_post_id"]) {
    assert.equal(raw.toLowerCase().includes(`"${forbidden}"`), false, forbidden);
  }
});
