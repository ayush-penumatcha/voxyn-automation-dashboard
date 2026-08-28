"use strict";

const REFRESH_INTERVAL_MS = 45000;
const THEME_STORAGE_KEY = "voxyn-dashboard-theme";
const REQUIRED_ROOT_FIELDS = ["schema_version","generated_at","timezone","notice","caption_visibility","system_status","system_label","today","next_post","auth","systems","posts","recent_activity","issues"];
const REQUIRED_HISTORY_FIELDS = ["schema_version","generated_at","timezone","caption_visibility","records"];
const {recordsForRange, metrics} = window.VoxynAnalytics;
let currentTimezone = "UTC";
let currentRange = "TODAY";
let nextScheduledAt = "";
let lastStatus = null;
let lastHistory = null;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function statusPill(status) {
  const normalized = String(status || "NOT_GENERATED").toUpperCase();
  const pill = element("span", `status status-${normalized.toLowerCase().replaceAll("_", "-")}`);
  pill.append(element("span", "", {POSTED:"✓",READY:"●",GENERATED:"●",PROCESSING:"◆",FAILED:"!",MISSED:"◷",AUTH_REQUIRED:"!",CANCELLED:"×"}[normalized] || "○"));
  pill.append(document.createTextNode(normalized.replaceAll("_", " ")));
  return pill;
}

function exactKeys(value, required) {
  return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join("|") === [...required].sort().join("|");
}

function validateStatus(data) {
  if (!exactKeys(data, REQUIRED_ROOT_FIELDS)) throw new Error("Status schema is not recognized");
  if (![1,2].includes(data.schema_version) || !Array.isArray(data.posts) || !Array.isArray(data.issues) || !Array.isArray(data.recent_activity)) throw new Error("Status schema is invalid");
  return data;
}

function validateHistory(data) {
  if (!exactKeys(data, REQUIRED_HISTORY_FIELDS) || data.schema_version !== 1 || !Array.isArray(data.records)) throw new Error("History schema is invalid");
  return data;
}

function formatTime(value, includeSeconds = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {timeZone:currentTimezone,hour:"numeric",minute:"2-digit",second:includeSeconds?"2-digit":undefined,hour12:true,timeZoneName:"short"}).format(date);
}

function updateClock() {
  const now = new Date();
  document.getElementById("live-time").textContent = new Intl.DateTimeFormat("en-US", {timeZone:currentTimezone,hour:"numeric",minute:"2-digit",second:"2-digit",hour12:true,timeZoneName:"short"}).format(now);
  document.getElementById("live-date").textContent = new Intl.DateTimeFormat("en-US", {timeZone:currentTimezone,weekday:"long",year:"numeric",month:"long",day:"numeric"}).format(now);
}

function updateCountdown() {
  const output = document.getElementById("next-countdown");
  if (!nextScheduledAt) { output.textContent = "—"; return; }
  const milliseconds = new Date(nextScheduledAt).getTime() - Date.now();
  if (!Number.isFinite(milliseconds)) { output.textContent = "—"; return; }
  if (milliseconds <= 0) { output.textContent = "Due now"; return; }
  const minutes = Math.floor(milliseconds / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  output.textContent = days ? `${days}d ${hours%24}h` : `${String(hours).padStart(2,"0")}h ${String(minutes%60).padStart(2,"0")}m`;
}

function safeSourceUrl(value) {
  try {
    const url = new URL(value);
    if (!["http:","https:"].includes(url.protocol) || url.username || url.password) return "";
    const host = url.hostname.toLowerCase();
    if (["localhost","127.0.0.1","::1","slack.com","linkedin.com","www.linkedin.com","github.com","www.github.com"].includes(host) || host.endsWith(".local")) return "";
    return url.href;
  } catch (_) { return ""; }
}

function setTheme(theme) {
  const selected = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = selected;
  const button = document.getElementById("theme-toggle");
  if (button) {
    const dark = selected === "dark";
    button.setAttribute("aria-pressed", String(dark));
    button.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
    button.querySelector("span").textContent = dark ? "☾" : "☀";
    button.querySelector("strong").textContent = dark ? "Dark" : "Light";
  }
  return selected;
}

function loadTheme() {
  let theme = "light";
  try { theme = localStorage.getItem(THEME_STORAGE_KEY) || "light"; } catch (_) { theme = "light"; }
  setTheme(theme);
}

function installThemeToggle() {
  document.getElementById("theme-toggle").addEventListener("click", () => {
    const theme = setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch (_) { /* Light/dark still works for this view. */ }
  });
}

function renderKpis(records) {
  const values = metrics(records);
  const definitions = [
    ["Total Posts",values.total,"Scheduled in range","▦"],
    ["Posted",values.posted,`${values.posted} successful`,"✓"],
    ["Ready / Generated",values.readyGenerated,"Future or in progress","→"],
    ["Missed",values.missed,"Expired unpublished","◷"],
    ["Failed",values.failed,"Failed or auth blocked","!"],
    ["Success Rate",values.successRate===null?"—":`${values.successRate.toFixed(1)}%`,"Posted ÷ completed eligible","↗"]
  ];
  const root = document.getElementById("kpis"); root.replaceChildren();
  definitions.forEach(([label,value,detail,icon])=>{const card=element("article","kpi");card.append(element("div","kpi-icon",icon));const copy=element("div");copy.append(element("span","",label),element("strong","",value),element("small","",detail));card.append(copy);root.append(card)});
  renderDistribution(values);
}

function renderDistribution(values) {
  const root = document.getElementById("distribution"); root.replaceChildren();
  const denominator = Math.max(values.total, 1);
  [["posted",values.posted],["ready",values.readyGenerated],["missed",values.missed],["failed",values.failed]].forEach(([name,value])=>{
    const bar=element("span",`distribution-${name}`);bar.style.width=`${(value/denominator)*100}%`;bar.title=`${name}: ${value}`;root.append(bar);
  });
}

function renderNext(data) {
  const next = data.next_post;
  const statusRoot = document.getElementById("next-status"); statusRoot.replaceChildren();
  nextScheduledAt = next ? next.scheduled_at : "";
  document.getElementById("next-time").textContent = next ? next.scheduled_time : "—";
  document.getElementById("next-topic").textContent = next ? `${next.post_type} · ${next.topic}` : "No upcoming post";
  statusRoot.append(statusPill(next ? next.status : "NOT_GENERATED")); updateCountdown();
}

function schedulerStatus(data, now = Date.now()) {
  const scheduler=data.systems && data.systems.scheduler;
  if(!scheduler)return null;
  const checked=new Date(scheduler.last_checked_at||"").getTime();
  const threshold=Number(scheduler.stale_after_minutes)*60000;
  if(!Number.isFinite(checked)||!Number.isFinite(threshold)||threshold<600000||now-checked>threshold){return {...scheduler,status:"WARNING",display_status:"STALE"};}
  return {...scheduler,display_status:scheduler.status};
}

function renderSystems(data) {
  const labels={generator:["Content Generator","✦"],slack:["Slack Queue","↗"],publisher:["LinkedIn Publisher","in"],linkedin_auth:["LinkedIn Authentication","⌁"],renderer:["Renderer","◇"],state:["State / History","▤"]};
  labels.scheduler=["Automation Scheduler","S"];
  const root=document.getElementById("system-cards");root.replaceChildren();
  const scheduler=schedulerStatus(data);
  Object.entries(labels).forEach(([key,[label,icon]])=>{if(!data.systems[key])return;const item=key==="scheduler"?scheduler:data.systems[key];const status=item.status;const shown=item.display_status||status;const card=element("article",`health-card ${status.toLowerCase().replaceAll("_","-")}`);card.append(element("div","health-icon",icon));const copy=element("div");copy.append(element("h3","",label));const state=element("strong");state.append(element("span","health-dot"),document.createTextNode(shown.replaceAll("_"," ")));const detail=key==="scheduler"&&item.last_checked_at?`Last controller check: ${formatTime(item.last_checked_at,true)}`:"Sanitized high-level operational state";copy.append(state,element("p","",detail));card.append(copy);root.append(card)});
}

function appendSource(container, record) {
  const url=safeSourceUrl(record.source_url);
  if(url){const link=element("a","",record.source_name||new URL(url).hostname);link.href=url;link.target="_blank";link.rel="noopener noreferrer";container.append(link)}
  else container.textContent=record.source_name||"Not available";
}

function captionDetails(record) {
  if (!record.caption) return element("p","caption-hidden",lastHistory && !lastHistory.caption_visibility ? "Caption hidden by privacy settings." : "Caption not available.");
  const details=element("details","caption");details.append(element("summary","","Read caption"),element("p","",record.caption));return details;
}

function renderHistory(records) {
  const table=document.getElementById("history-rows");const mobile=document.getElementById("mobile-history");table.replaceChildren();mobile.replaceChildren();
  if(!records.length){const row=element("tr");const cell=element("td","table-empty","No sanitized records are available for this period.");cell.colSpan=7;row.append(cell);table.append(row);mobile.append(element("div","empty-history","No sanitized records are available for this period."));return}
  records.forEach(record=>{
    const row=element("tr");row.append(element("td","",record.date),element("td","",record.scheduled_time),element("td","",record.post_type));
    const story=element("td","story-cell");story.append(element("strong","",record.topic),captionDetails(record));row.append(story);
    const source=element("td");appendSource(source,record);row.append(source);
    const theme=element("td","",record.theme_name||"Not available");if(record.theme_family)theme.append(element("small","",record.theme_family));row.append(theme);
    const state=element("td");state.append(statusPill(record.status));row.append(state);table.append(row);
    const card=element("article","history-card");const head=element("div","history-card-head");const title=element("div");title.append(element("span","eyebrow",`${record.date} · ${record.scheduled_time} · ${record.post_type}`),element("h3","",record.topic));head.append(title,statusPill(record.status));card.append(head,captionDetails(record));const meta=element("div","history-meta");const sourceMobile=element("span");appendSource(sourceMobile,record);meta.append(sourceMobile,element("span","",record.theme_name||"Theme unavailable"));card.append(meta);mobile.append(card);
  });
}

function renderActivity(records) {
  const root=document.getElementById("activity-list");root.replaceChildren();
  const events=records.filter(record=>["POSTED","FAILED","MISSED","AUTH_REQUIRED"].includes(record.status)).slice(0,12);
  if(!events.length){const item=element("li");item.append(element("span","timeline-marker"));const copy=element("div");copy.append(element("strong","","No completed activity in this period"),element("small","","Future generated posts do not count as completed outcomes."));item.append(copy);root.append(item);return}
  events.forEach(record=>{const item=element("li",`activity-${record.status.toLowerCase()}`);item.append(element("span","timeline-marker"));const copy=element("div");copy.append(element("time","",`${record.date} · ${record.scheduled_time}`),element("strong","",`${record.post_type} · ${record.status.replaceAll("_"," ")}`),element("small","",record.topic));item.append(copy);root.append(item)});
}

function renderRange() {
  if(!lastStatus || !lastHistory) return;
  const records=recordsForRange(lastHistory.records,lastStatus.today.date,currentRange);
  const labels={TODAY:"Today's posts","3D":"Last 3 days","7D":"Last 7 days","30D":"Last 30 days",ALL:"All-time publishing history"};
  document.getElementById("history-title").textContent=labels[currentRange];
  document.querySelectorAll("#range-selector button").forEach(button=>button.classList.toggle("active",button.dataset.range===currentRange));
  renderKpis(records);renderHistory(records);renderActivity(records);
}

function installRangeSelector() {
  document.querySelectorAll("#range-selector button").forEach(button=>{button.addEventListener("click",()=>{currentRange=button.dataset.range;renderRange()})});
}

function renderAuth(data){const panel=document.getElementById("authentication");panel.className=`panel auth-panel ${data.auth.status.toLowerCase().replaceAll("_","-")}`;const title=document.getElementById("auth-title");title.replaceChildren(element("span","health-dot"),document.createTextNode(data.auth.status.replaceAll("_"," ")));document.getElementById("auth-days").textContent=data.auth.days_remaining===null?"Unknown":`${data.auth.days_remaining} days remaining`;document.getElementById("auth-check").textContent=data.auth.last_checked||"Not available"}

function renderIssues(data){const root=document.getElementById("issue-list");root.replaceChildren();if(!data.issues.length){const empty=element("div","empty-state");empty.append(element("span","","✓"));const copy=element("div");copy.append(element("strong","","No unresolved issues"),element("p","","The sanitized production snapshot has no actionable failures."));empty.append(copy);root.append(empty);return}data.issues.forEach(issue=>{const card=element("article","issue-card");card.append(element("span","","!"));const copy=element("div");copy.append(element("strong","",issue.category.replaceAll("_"," ")),element("small","",`${issue.scheduled_time} · ${issue.post_type}`),element("p","",issue.recommendation));card.append(copy);root.append(card)})}

function renderStatus(rawStatus, rawHistory) {
  const data=validateStatus(rawStatus);const history=validateHistory(rawHistory);lastStatus=data;lastHistory=history;currentTimezone=data.timezone;
  document.getElementById("timezone").textContent=currentTimezone;document.getElementById("privacy-note").textContent=data.notice;document.getElementById("last-updated").textContent=formatTime(data.generated_at,true);
  const scheduler=schedulerStatus(data);const schedulerStale=scheduler&&scheduler.status==="WARNING";const overallStatus=schedulerStale&&data.system_status==="HEALTHY"?"WARNING":data.system_status;const overallLabel=schedulerStale&&data.system_status==="HEALTHY"?"Attention Required":data.system_label;
  const overall=document.getElementById("system-status");overall.className=`system-status level-${overallStatus.toLowerCase()}`;overall.replaceChildren(element("span","pulse-dot"),element("strong","",overallLabel));
  renderNext(data);renderSystems(data);renderAuth(data);renderIssues(data);renderRange();updateClock();return data;
}

async function refreshStatus(){try{const stamp=Date.now();const [statusResponse,historyResponse]=await Promise.all([fetch(`status.json?ts=${stamp}`,{method:"GET",cache:"no-store",credentials:"omit"}),fetch(`history.json?ts=${stamp}`,{method:"GET",cache:"no-store",credentials:"omit"})]);if(!statusResponse.ok||!historyResponse.ok)throw new Error("Dashboard data request failed");renderStatus(await statusResponse.json(),await historyResponse.json())}catch(error){const overall=document.getElementById("system-status");overall.className="system-status level-critical";overall.replaceChildren(element("span","pulse-dot"),element("strong","","Status Unavailable"));if(!lastStatus)document.getElementById("history-rows").replaceChildren(element("tr","","Sanitized dashboard data is temporarily unavailable."))}}

loadTheme();installThemeToggle();installRangeSelector();updateClock();setInterval(updateClock,1000);setInterval(updateCountdown,1000);refreshStatus();setInterval(refreshStatus,REFRESH_INTERVAL_MS);

if(typeof window!=="undefined")window.VoxynPublicDashboard={validateStatus,validateHistory,safeSourceUrl,recordsForRange,metrics,setTheme,schedulerStatus,renderStatus,refreshStatus};
