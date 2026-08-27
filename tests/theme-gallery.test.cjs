const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const catalog = JSON.parse(fs.readFileSync(path.join(root, "theme_catalog.json"), "utf8"));
const css = fs.readFileSync(path.join(root, "theme_catalog.css"), "utf8");
const galleryCss = fs.readFileSync(path.join(root, "theme-gallery.css"), "utf8");
const html = fs.readFileSync(path.join(root, "themes.html"), "utf8");
const jsSource = fs.readFileSync(path.join(root, "theme-gallery.js"), "utf8");
const gallery = require(path.join(root, "theme-gallery.js"));

test("catalog contains all 45 unique palettes across 15 families", () => {
  assert.equal(catalog.palette_count, 45);
  assert.equal(catalog.palettes.length, 45);
  assert.equal(new Set(catalog.palettes.map(item => item.palette_id)).size, 45);
  assert.equal(catalog.families.length, 15);
  for (const family of catalog.families) {
    assert.equal(catalog.palettes.filter(item => item.family === family).length, 3);
  }
});

test("every palette has visual metadata and readable contrast", () => {
  for (const theme of catalog.palettes) {
    for (const field of ["palette_id", "name", "family", "mood", "background", "gradient", "text", "accent", "border", "badge", "decorative", "contrast"]) {
      assert.ok(Object.hasOwn(theme, field), `${theme.palette_id} misses ${field}`);
    }
    assert.ok(theme.contrast.headline >= 4.5);
    assert.ok(theme.contrast.body >= 4.5);
    assert.match(css, new RegExp(`\\.palette-${theme.palette_id}\\{`));
    assert.ok(css.includes(theme.text.headline));
    assert.ok(css.includes(theme.gradient.start));
  }
});

test("search and family filtering are deterministic", () => {
  const theme = catalog.palettes[0];
  assert.equal(gallery.matchesTheme(theme, theme.name, "ALL"), true);
  assert.equal(gallery.matchesTheme(theme, theme.palette_id, theme.family), true);
  assert.equal(gallery.matchesTheme(theme, "definitely-not-a-theme", "ALL"), false);
  assert.equal(gallery.matchesTheme(theme, "", "SECURITY_RISK"), theme.family === "SECURITY_RISK");
});

test("gallery page contains navigation, filters, modal controls and fixed sample only", () => {
  assert.ok(html.includes("Theme Gallery"));
  assert.ok(html.includes('id="theme-search"'));
  assert.ok(html.includes('id="family-filter"'));
  assert.ok(html.includes('id="theme-dialog"'));
  assert.ok(html.includes('id="dialog-previous"'));
  assert.ok(html.includes('id="dialog-next"'));
  assert.equal(gallery.SAMPLE.headline, "AI Agents Are Moving From Demos to Real Work");
  assert.ok(jsSource.includes("ArrowLeft"));
  assert.ok(jsSource.includes("ArrowRight"));
});

test("gallery is safe, dependency-free, and uses DOM text nodes", () => {
  const combined = `${html}\n${jsSource}\n${JSON.stringify(catalog)}`.toLowerCase();
  assert.equal(combined.includes("innerhtml"), false);
  assert.equal(/https?:\/\//.test(html), false);
  for (const forbidden of ["access_token", "member_urn", "slack_channel_id", "file_id", "claim_id", "authorization"]) {
    assert.equal(JSON.stringify(catalog).toLowerCase().includes(forbidden), false);
  }
});

test("light and dark dashboard modes preserve palette-specific classes", () => {
  assert.ok(html.includes('data-theme="light"'));
  assert.ok(jsSource.includes('theme==="dark"?"dark":"light"'));
  assert.ok(jsSource.includes("voxyn-dashboard-theme"));
  assert.ok(jsSource.includes(`palette-${"${theme.palette_id}"}`));
  assert.ok(css.includes("--preview-gradient"));
});

test("responsive grid supports desktop, tablet and mobile", () => {
  assert.ok(galleryCss.includes("repeat(3,minmax(0,1fr))"));
  assert.ok(galleryCss.includes("@media(max-width:1200px)"));
  assert.ok(galleryCss.includes("@media(max-width:760px)"));
  assert.ok(galleryCss.includes("grid-template-columns:1fr"));
});
