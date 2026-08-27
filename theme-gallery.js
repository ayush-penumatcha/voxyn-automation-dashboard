"use strict";

(function themeGallery(root) {
  const SAMPLE = Object.freeze({
    headline:"AI Agents Are Moving From Demos to Real Work",
    body:"Reliable agent behavior remains one of the biggest challenges for production AI systems.",
    why:"Teams are shifting focus from flashy demos toward dependable automation and measurable outcomes.",
    source:"TechCrunch AI",
    handle:"@ayushpenumatcha",
    creator:"Ayush Penumatcha",
  });
  let catalog = null;
  let visible = [];
  let activeIndex = 0;

  function element(tag, className, text) {
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(text!==undefined)node.textContent=String(text);
    return node;
  }

  function validateCatalog(value) {
    if(!value||value.schema_version!==1||value.palette_count!==45||!Array.isArray(value.palettes)||value.palettes.length!==45)throw new Error("Theme catalogue is invalid");
    const ids=new Set();
    value.palettes.forEach(theme=>{if(!/^[a-z0-9-]+$/.test(theme.palette_id)||ids.has(theme.palette_id))throw new Error("Theme catalogue identifiers are invalid");ids.add(theme.palette_id)});
    return value;
  }

  function matchesTheme(theme, query, family) {
    const needle=String(query||"").trim().toLowerCase();
    const familyMatch=!family||family==="ALL"||theme.family===family;
    return familyMatch&&(!needle||[theme.name,theme.palette_id,theme.family,theme.mood].join(" ").toLowerCase().includes(needle));
  }

  function preview(theme, large=false) {
    const frame=element("div",`theme-preview palette-${theme.palette_id}${large?" expanded":""}`);
    const top=element("div","preview-top");top.append(element("span","preview-badge","AI OPERATIONS"),element("span","preview-mood",theme.mood));
    const copy=element("div","preview-copy");copy.append(element("h3","",SAMPLE.headline),element("p","",SAMPLE.body));
    const why=element("div","preview-why");why.append(element("strong","","WHY THIS MATTERS"),element("p","",SAMPLE.why));
    const footer=element("div","preview-footer");const source=element("div");source.append(element("small","","SOURCE"),element("strong","",SAMPLE.source));const creator=element("div","preview-creator");creator.append(element("strong","",SAMPLE.handle),element("small","",SAMPLE.creator));footer.append(source,creator);
    frame.append(top,copy,why,footer);return frame;
  }

  function token(label,value) {const item=element("li");item.append(element("span","",label),element("code","",value));return item}

  function card(theme) {
    const article=element("article","theme-card");article.dataset.family=theme.family;article.dataset.paletteId=theme.palette_id;
    const head=element("header","theme-card-head");const title=element("div");title.append(element("span","family-label",theme.family.replaceAll("_"," / ")),element("h3","",theme.name),element("code","",theme.palette_id));head.append(title,element("span","mood-pill",theme.mood));
    const tokens=element("ul","theme-tokens");tokens.append(token("Headline",theme.text.headline),token("Body",theme.text.body),token("Accent",theme.accent.primary),token("Gradient",`${theme.gradient.start} → ${theme.gradient.end}`),token("Headline contrast",theme.contrast.headline.toFixed(2)),token("Body contrast",theme.contrast.body.toFixed(2)));
    const action=element("button","preview-button","Expanded preview");action.type="button";action.addEventListener("click",()=>openTheme(theme.palette_id));
    article.append(head,preview(theme),tokens,action);return article;
  }

  function render() {
    if(!catalog)return;
    const query=document.getElementById("theme-search").value;
    const family=document.getElementById("family-filter").value;
    visible=catalog.palettes.filter(theme=>matchesTheme(theme,query,family));
    const rootNode=document.getElementById("theme-families");rootNode.replaceChildren();
    catalog.families.forEach(name=>{const themes=visible.filter(theme=>theme.family===name);if(!themes.length)return;const section=element("section","family-section");const heading=element("header","family-head");const title=element("div");title.append(element("span","eyebrow","PALETTE FAMILY"),element("h2","",name.replaceAll("_"," / ")));heading.append(title,element("span","family-count",`${themes.length} theme${themes.length===1?"":"s"}`));const grid=element("div","theme-grid");themes.forEach(theme=>grid.append(card(theme)));section.append(heading,grid);rootNode.append(section)});
    document.getElementById("result-count").textContent=`${visible.length} of ${catalog.palette_count} themes`;
    if(!visible.length)rootNode.append(element("div","gallery-empty","No themes match this search and family filter."));
  }

  function openTheme(paletteId) {
    activeIndex=Math.max(0,visible.findIndex(theme=>theme.palette_id===paletteId));
    updateDialog();document.getElementById("theme-dialog").showModal();
  }

  function updateDialog() {
    if(!visible.length)return;const theme=visible[activeIndex];
    document.getElementById("dialog-title").textContent=theme.name;
    document.getElementById("dialog-meta").textContent=`${theme.palette_id} · ${theme.family.replaceAll("_"," / ")} · ${theme.mood}`;
    const rootNode=document.getElementById("dialog-preview");rootNode.replaceChildren(preview(theme,true));
    document.getElementById("dialog-position").textContent=`${activeIndex+1} / ${visible.length}`;
  }

  function stepDialog(direction) {if(!visible.length)return;activeIndex=(activeIndex+direction+visible.length)%visible.length;updateDialog()}

  function setDashboardTheme(theme) {
    const selected=theme==="dark"?"dark":"light";document.documentElement.dataset.theme=selected;
    const button=document.getElementById("theme-toggle");if(button){const dark=selected==="dark";button.setAttribute("aria-pressed",String(dark));button.querySelector("span").textContent=dark?"☾":"☀";button.querySelector("strong").textContent=dark?"Dark":"Light"}return selected;
  }

  function installControls() {
    const filter=document.getElementById("family-filter");catalog.families.forEach(family=>{const option=element("option","",family.replaceAll("_"," / "));option.value=family;filter.append(option)});
    document.getElementById("theme-search").addEventListener("input",render);filter.addEventListener("change",render);
    const dialog=document.getElementById("theme-dialog");document.getElementById("dialog-close").addEventListener("click",()=>dialog.close());document.getElementById("dialog-previous").addEventListener("click",()=>stepDialog(-1));document.getElementById("dialog-next").addEventListener("click",()=>stepDialog(1));dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close()});document.addEventListener("keydown",event=>{if(!dialog.open)return;if(event.key==="ArrowLeft")stepDialog(-1);if(event.key==="ArrowRight")stepDialog(1);if(event.key==="Escape")dialog.close()});
    let selected="light";try{selected=localStorage.getItem("voxyn-dashboard-theme")||"light"}catch(_){selected="light"}setDashboardTheme(selected);document.getElementById("theme-toggle").addEventListener("click",()=>{const value=setDashboardTheme(document.documentElement.dataset.theme==="dark"?"light":"dark");try{localStorage.setItem("voxyn-dashboard-theme",value)}catch(_){/* The toggle still works for this view. */}});
  }

  async function initialize() {
    try{const response=await fetch(document.body.dataset.catalogUrl,{method:"GET",cache:"no-store",credentials:"same-origin"});if(!response.ok)throw new Error("Theme catalogue request failed");catalog=validateCatalog(await response.json());installControls();render()}catch(_){document.getElementById("theme-families").replaceChildren(element("div","gallery-error","The sanitized theme catalogue is unavailable."))}
  }

  if(typeof document!=="undefined")initialize();
  const api={SAMPLE,validateCatalog,matchesTheme,preview,openTheme,stepDialog,setDashboardTheme};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  root.VoxynThemeGallery=api;
})(typeof window!=="undefined"?window:globalThis);
