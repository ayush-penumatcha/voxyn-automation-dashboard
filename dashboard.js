"use strict";

const REFRESH_INTERVAL_MS = 45000;
const REQUIRED_ROOT_FIELDS = ["schema_version","generated_at","timezone","notice","caption_visibility","system_status","system_label","today","next_post","auth","systems","posts","recent_activity","issues"];
let currentTimezone = "UTC";
let nextScheduledAt = "";
let lastStatus = null;

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

function validateStatus(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Status data is unavailable");
  const keys = Object.keys(data).sort();
  if (keys.join("|") !== [...REQUIRED_ROOT_FIELDS].sort().join("|")) throw new Error("Status schema is not recognized");
  if (data.schema_version !== 1 || !Array.isArray(data.posts) || !Array.isArray(data.issues) || !Array.isArray(data.recent_activity)) throw new Error("Status schema is invalid");
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

function renderKpis(data) {
  const definitions = [
    ["Today's Posts",data.today.total,"Configured slots","▦"],
    ["Posted",data.today.posted,`${data.today.posted} / ${data.today.total} today`,"✓"],
    ["Ready / Generated",data.today.ready_generated,"Awaiting or prepared","→"],
    ["Failed",data.today.failed,"Requires review","!"],
    ["Missed",data.today.missed,"Outside window","◷"],
    ["Auth",data.auth.status,data.auth.days_remaining===null?"Validity unavailable":`${data.auth.days_remaining} days remaining`,"⌁"]
  ];
  const root = document.getElementById("kpis"); root.replaceChildren();
  definitions.forEach(([label,value,detail,icon])=>{const card=element("article","kpi");card.append(element("div","kpi-icon",icon));const copy=element("div");copy.append(element("span","",label),element("strong","",value),element("small","",detail));card.append(copy);root.append(card)});
}

function renderNext(data) {
  const next = data.next_post;
  const statusRoot = document.getElementById("next-status"); statusRoot.replaceChildren();
  nextScheduledAt = next ? next.scheduled_at : "";
  document.getElementById("next-time").textContent = next ? next.scheduled_time : "—";
  document.getElementById("next-topic").textContent = next ? `${next.post_type} · ${next.topic}` : "No upcoming post";
  statusRoot.append(statusPill(next ? next.status : "NOT_GENERATED")); updateCountdown();
}

function renderSystems(data) {
  const labels={generator:["Content Generator","✦"],slack:["Slack Queue","↗"],publisher:["LinkedIn Publisher","in"],linkedin_auth:["LinkedIn Authentication","⌁"],renderer:["Renderer","◇"],state:["State / History","▤"]};
  const root=document.getElementById("system-cards");root.replaceChildren();
  Object.entries(labels).forEach(([key,[label,icon]])=>{const status=data.systems[key].status;const card=element("article",`health-card ${status.toLowerCase().replaceAll("_","-")}`);card.append(element("div","health-icon",icon));const copy=element("div");copy.append(element("h3","",label));const state=element("strong");state.append(element("span","health-dot"),document.createTextNode(status.replaceAll("_"," ")));copy.append(state,element("p","","Sanitized high-level operational state"));card.append(copy);root.append(card)});
}

function renderPosts(data) {
  const root=document.getElementById("posts");root.replaceChildren();
  if (!data.posts.length) { root.append(element("div","load-error","No production post status is available.")); return; }
  data.posts.forEach(post=>{const card=element("article","post-card");card.dataset.status=post.status;const head=element("div","post-card-head");const title=element("div");title.append(element("span","eyebrow",`${post.scheduled_time} · ${post.post_type}`),element("h3","",post.topic));head.append(title,statusPill(post.status));card.append(head,element("span","type",post.post_type));if(post.caption){const details=element("details","caption");details.open=true;details.append(element("summary","","Final Caption"),element("p","",post.caption));card.append(details)}else{card.append(element("p","caption-hidden",data.caption_visibility?"Caption is not available.":"Upcoming caption is hidden by privacy settings."))}const meta=element("dl","post-meta");const source=element("div");source.append(element("dt","","Source"));const sourceValue=element("dd");const url=safeSourceUrl(post.source_url);if(url){const link=element("a","",post.source_name||new URL(url).hostname);link.href=url;link.target="_blank";link.rel="noopener noreferrer";sourceValue.append(link)}else{sourceValue.textContent=post.source_name||"Not available"}source.append(sourceValue);const theme=element("div");theme.append(element("dt","","Theme"),element("dd","",post.theme_name||"Not available"));if(post.theme_family)theme.lastChild.append(element("small","",post.theme_family));meta.append(source,theme);card.append(meta);root.append(card)});
}

function renderAuth(data){const panel=document.getElementById("authentication");panel.className=`panel auth-panel ${data.auth.status.toLowerCase().replaceAll("_","-")}`;const title=document.getElementById("auth-title");title.replaceChildren(element("span","health-dot"),document.createTextNode(data.auth.status.replaceAll("_"," ")));document.getElementById("auth-days").textContent=data.auth.days_remaining===null?"Unknown":`${data.auth.days_remaining} days remaining`;document.getElementById("auth-check").textContent=data.auth.last_checked||"Not available"}

function renderActivity(data){const root=document.getElementById("activity-list");root.replaceChildren();if(!data.recent_activity.length){const item=element("li");item.append(element("span","timeline-marker"));const copy=element("div");copy.append(element("strong","","No recent recorded activity"),element("small","","Events appear after durable publisher history is available."));item.append(copy);root.append(item);return}data.recent_activity.forEach(event=>{const item=element("li");item.append(element("span","timeline-marker"));const copy=element("div");copy.append(element("time","",event.time||"—"),element("strong","",event.message));item.append(copy);root.append(item)})}

function renderIssues(data){const root=document.getElementById("issue-list");root.replaceChildren();if(!data.issues.length){const empty=element("div","empty-state");empty.append(element("span","","✓"));const copy=element("div");copy.append(element("strong","","No unresolved issues"),element("p","","The sanitized production snapshot has no actionable failures."));empty.append(copy);root.append(empty);return}data.issues.forEach(issue=>{const card=element("article","issue-card");card.append(element("span","","!"));const copy=element("div");copy.append(element("strong","",issue.category.replaceAll("_"," ")),element("small","",`${issue.scheduled_time} · ${issue.post_type}`),element("p","",issue.recommendation));card.append(copy);root.append(card)})}

function renderStatus(raw) {
  const data=validateStatus(raw);lastStatus=data;currentTimezone=data.timezone;document.getElementById("timezone").textContent=currentTimezone;document.getElementById("privacy-note").textContent=data.notice;document.getElementById("last-updated").textContent=formatTime(data.generated_at,true);const overall=document.getElementById("system-status");overall.className=`system-status level-${data.system_status.toLowerCase()}`;overall.replaceChildren(element("span","pulse-dot"),element("strong","",data.system_label));renderKpis(data);renderNext(data);renderSystems(data);renderPosts(data);renderAuth(data);renderActivity(data);renderIssues(data);updateClock();installFilters();return data;
}

function installFilters(){document.querySelectorAll("#post-filters button").forEach(button=>{button.onclick=()=>{document.querySelectorAll("#post-filters button").forEach(item=>item.classList.toggle("active",item===button));document.querySelectorAll(".post-card").forEach(card=>{const filter=button.dataset.filter;const attention=filter==="ATTENTION"&&["FAILED","MISSED","AUTH_REQUIRED"].includes(card.dataset.status);card.hidden=filter!=="ALL"&&card.dataset.status!==filter&&!(filter==="READY"&&["READY","GENERATED"].includes(card.dataset.status))&&!attention})}})}

async function refreshStatus(){try{const response=await fetch(`status.json?ts=${Date.now()}`,{method:"GET",cache:"no-store",credentials:"omit"});if(!response.ok)throw new Error("Status request failed");renderStatus(await response.json())}catch(error){const overall=document.getElementById("system-status");overall.className="system-status level-critical";overall.replaceChildren(element("span","pulse-dot"),element("strong","","Status Unavailable"));if(!lastStatus){document.getElementById("posts").replaceChildren(element("div","load-error","Sanitized status is temporarily unavailable. No private fallback data is requested."))}}}

updateClock();setInterval(updateClock,1000);setInterval(updateCountdown,1000);refreshStatus();setInterval(refreshStatus,REFRESH_INTERVAL_MS);

if(typeof window!=="undefined")window.VoxynPublicDashboard={validateStatus,safeSourceUrl,renderStatus,refreshStatus};
