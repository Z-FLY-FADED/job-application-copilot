"use strict";

const STORE_KEY = "jobPilotCN_v2";
const LEGACY_KEY = "jobPilotCN_v1";
const DEFAULT_MESSAGE = "您好，我是{姓名}。我关注到贵公司的{职位}岗位，我具备{技能}相关经验，与岗位要求较匹配，希望能进一步沟通。感谢您的时间！";

const seedJobs = [
  { id:"s1", title:"机械结构工程师", company:"某智能机器人公司", city:"上海", salary:"18-28K", platform:"BOSS直聘", experience:"1-3年", tags:["SolidWorks","机器人","结构设计","量产"], description:"负责机器人结构设计、零部件选型、样机装配测试与量产优化。", publishedAt:todayMinus(1), url:"" },
  { id:"s2", title:"机器人控制算法工程师", company:"某具身智能企业", city:"杭州", salary:"25-45K", platform:"猎聘", experience:"硕士", tags:["MATLAB","Simulink","控制算法","机器人","C++"], description:"负责运动控制算法、仿真验证、控制器调参与机器人系统联调。", publishedAt:todayMinus(2), url:"" },
  { id:"s3", title:"嵌入式软件工程师", company:"某工业自动化企业", city:"苏州", salary:"16-26K", platform:"智联招聘", experience:"1-3年", tags:["C","C++","Linux","CAN","电机控制"], description:"负责嵌入式软件开发、通信协议、驱动调试和电机控制系统联调。", publishedAt:todayMinus(3), url:"" },
  { id:"s4", title:"机电系统工程师", company:"某高端装备企业", city:"深圳", salary:"20-32K", platform:"BOSS直聘", experience:"3-5年", tags:["机电一体化","电机","SolidWorks","测试","项目管理"], description:"负责机电系统方案设计、执行器选型、测试验证与跨团队项目推进。", publishedAt:todayMinus(5), url:"" },
  { id:"s5", title:"仿真工程师", company:"某新能源研发中心", city:"上海", salary:"18-30K", platform:"猎聘", experience:"1-3年", tags:["MATLAB","Simulink","建模","控制策略","数据分析"], description:"搭建系统级仿真模型，开展控制策略开发、参数标定和结果分析。", publishedAt:todayMinus(1), url:"" },
  { id:"s6", title:"产品测试工程师", company:"某机器人科技公司", city:"北京", salary:"14-22K", platform:"智联招聘", experience:"应届生", tags:["机器人","测试","Python","数据分析","可靠性"], description:"制定机器人产品测试方案，执行功能与可靠性测试并跟踪问题闭环。", publishedAt:todayMinus(8), url:"" }
];

const defaults = {
  resume:"",
  profile:{ name:"", role:"", city:"", minSalary:"", experience:"", education:"", keywords:"", exclude:"" },
  automation:{ threshold:75, dailyLimit:8, companyLimit:1, freshnessDays:7, blacklist:"", skipApplied:true, messageTemplate:DEFAULT_MESSAGE },
  jobs:seedJobs,
  queue:[],
  records:[],
  analysis:null,
  lastSimulation:null,
  sourcePrefs:{ selected:["iguopin","cujiuye","mohrss-institution","scs","boss","zhaopin"], category:"all" },
  mergedFeedKeys:[]
};

let state = loadState();
let pendingJobId = null;

function todayMinus(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || localStorage.getItem(LEGACY_KEY));
    if (!saved) return clone(defaults);
    return {
      ...clone(defaults), ...saved,
      profile:{ ...defaults.profile, ...(saved.profile || {}) },
      automation:{ ...defaults.automation, ...(saved.automation || {}) },
      jobs:Array.isArray(saved.jobs) && saved.jobs.length ? saved.jobs : clone(seedJobs),
      sourcePrefs:{ ...defaults.sourcePrefs, ...(saved.sourcePrefs || {}) },
      mergedFeedKeys:Array.isArray(saved.mergedFeedKeys) ? saved.mergedFeedKeys : []
    };
  } catch { return clone(defaults); }
}
function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  updateDashboard();
}
function $(id) { return document.getElementById(id); }
function normalizeList(value="") { return String(value).split(/[,，、\n]/).map(x => x.trim()).filter(Boolean); }
function escapeHtml(value="") { return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[c])); }
function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2200);
}
function download(name, content, type) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 500);
}

const titles = { dashboard:"求职概览", resume:"简历与求职画像", sources:"岗位情报", jobs:"岗位匹配", queue:"投递队列", automation:"自动化中心", records:"投递记录" };
function switchView(view) {
  document.querySelectorAll(".view").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(el => el.classList.toggle("active", el.dataset.view === view));
  $(`${view}View`).classList.add("active");
  $("pageTitle").textContent = titles[view];
  if (view === "sources") renderSources();
  if (view === "jobs") renderJobs();
  if (view === "queue") renderQueue();
  if (view === "automation") renderAutomation();
  if (view === "records") renderRecords();
  window.scrollTo({ top:0, behavior:"smooth" });
}

function analyzeText(text) {
  const bank = ["SolidWorks","MATLAB","Simulink","Python","C++","C语言","Linux","ROS","CAN","PLC","AutoCAD","ANSYS","机器人","机械设计","结构设计","控制算法","嵌入式","电机控制","数据分析","项目管理","量产","测试","仿真","英语"];
  const skills = bank.filter(skill => text.toLowerCase().includes(skill.toLowerCase()));
  const education = ["博士","硕士","本科","大专"].find(item => text.includes(item)) || "待识别";
  const years = [...text.matchAll(/(\d+)\s*年/g)].map(match => Number(match[1])).filter(year => year < 30);
  const projectCount = (text.match(/项目/g) || []).length;
  const completeness = Math.min(100, 20 + (text.length > 300 ? 20 : 0) + Math.min(25, skills.length * 5) + (education !== "待识别" ? 15 : 0) + (projectCount ? 20 : 0));
  return { skills, education, maxYears:years.length ? Math.max(...years) : 0, projectCount, completeness, charCount:text.length };
}

function salaryRange(value="") {
  const numbers = String(value).match(/\d+/g)?.map(Number) || [];
  return { low:numbers[0] || 0, high:numbers[1] || numbers[0] || 0 };
}
function calculateMatch(job) {
  const profileKeys = [...normalizeList(state.profile.keywords), ...(state.analysis?.skills || [])];
  const content = `${job.title} ${job.tags?.join(" ") || ""} ${job.description || ""}`.toLowerCase();
  const excluded = normalizeList(state.profile.exclude).filter(key => content.includes(key.toLowerCase()));
  if (excluded.length) return { score:5, reasons:[`命中排除词：${excluded.join("、")}`], blocked:true };

  let score = state.resume ? 18 : 10;
  const reasons = [];
  const matched = [...new Set(profileKeys.filter(key => content.includes(key.toLowerCase())))];
  if (matched.length) { score += Math.min(40, matched.length * 9); reasons.push(`技能：${matched.slice(0, 4).join("、")}`); }

  const role = state.profile.role.trim();
  if (role) {
    const roleCore = role.replace(/工程师|专员|经理|岗位/g, "");
    if (job.title.includes(role) || job.title.includes(roleCore) || role.includes(job.title.replace(/工程师|专员|经理/g, ""))) {
      score += 25; reasons.push("职位方向符合");
    }
  }
  if (state.profile.city && job.city.includes(state.profile.city)) { score += 10; reasons.push("城市符合"); }
  if (state.profile.minSalary && salaryRange(job.salary).high >= Number(state.profile.minSalary)) { score += 7; reasons.push("薪资符合"); }
  if (state.profile.experience && String(job.experience || "").includes(state.profile.experience)) { score += 5; reasons.push("经验符合"); }
  return { score:Math.min(98, score), reasons:reasons.length ? reasons : ["画像信息不足"], blocked:false };
}

function renderAnalysis() {
  if (!state.analysis) return;
  $("analysisEmpty").classList.add("hidden");
  $("analysisResult").classList.remove("hidden");
  const skills = state.analysis.skills.length ? state.analysis.skills : ["暂未识别"];
  $("analysisResult").innerHTML = `
    <div class="analysis-card"><strong>识别技能</strong><div class="chips">${skills.map(x => `<span class="chip">${escapeHtml(x)}</span>`).join("")}</div></div>
    <div class="analysis-card"><strong>基础信息</strong><div class="chips"><span class="chip">${state.analysis.education}</span><span class="chip">${state.analysis.maxYears} 年经历线索</span><span class="chip">${state.analysis.projectCount} 处项目描述</span></div></div>
    <div class="analysis-card"><strong>完整度 ${state.analysis.completeness}%</strong><p class="hint">${state.analysis.skills.length < 4 ? "建议补充技术栈、工具、项目成果和量化指标。" : "技能信息较完整，建议继续强化项目结果与职责边界。"}</p></div>`;
}

function getFilteredJobs() {
  const query = $("jobSearch").value.trim().toLowerCase();
  const platform = $("platformFilter").value;
  const threshold = Number($("matchFilter").value);
  return state.jobs.map(job => ({ ...job, match:calculateMatch(job) }))
    .filter(job => job.match.score >= threshold && (platform === "all" || job.platform === platform) && (!query || `${job.title}${job.company}${job.tags?.join("") || ""}`.toLowerCase().includes(query)))
    .sort((a, b) => b.match.score - a.match.score);
}

function getDailyFeed() {
  const feed = window.DailyJobFeed || { updatedAt:"", sources:[], jobs:[] };
  return {
    updatedAt:feed.updatedAt || "",
    sources:Array.isArray(feed.sources) ? feed.sources : [],
    jobs:Array.isArray(feed.jobs) ? feed.jobs : []
  };
}
function sourceQuery() {
  return [state.profile.role, $("sourceKeyword").value.trim(), $("sourceCity").value.trim() || state.profile.city].filter(Boolean).join(" ");
}
function sourceUrl(source) {
  return (source.search || source.url).replace("{query}", encodeURIComponent(sourceQuery()));
}
function renderSources() {
  $("sourceCategory").value = state.sourcePrefs.category || "all";
  if (!$("sourceCity").value && state.profile.city) $("sourceCity").value = state.profile.city;
  if (!$("sourceKeyword").value && state.profile.role) $("sourceKeyword").value = state.profile.role;
  const category = $("sourceCategory").value;
  const sources = (window.JobSources || []).filter(source => category === "all" || source.category === category);
  $("sourceResultCount").textContent = `${sources.length} 个岗位来源`;
  $("sourceGrid").innerHTML = sources.map(source => `
    <article class="source-card ${source.official ? "official-source" : ""}">
      <label class="source-check"><input type="checkbox" data-source-id="${source.id}" ${state.sourcePrefs.selected.includes(source.id) ? "checked" : ""}></label>
      <span class="source-logo">${escapeHtml(source.short)}</span>
      <div><div class="source-name"><strong>${escapeHtml(source.name)}</strong>${source.official ? '<span>官方</span>' : ""}</div><p>${escapeHtml(source.description)}</p><small>${escapeHtml(source.categoryLabel)}</small></div>
      <button class="ghost open-source" data-source-id="${source.id}">搜索</button>
    </article>`).join("");
  renderDailyFeed();
}
function renderDailyFeed() {
  const feed = getDailyFeed();
  $("feedUpdatedAt").textContent = feed.updatedAt ? new Date(feed.updatedAt).toLocaleString("zh-CN") : "等待每日任务";
  $("feedSourceCount").textContent = `${feed.sources.length} 个来源`;
  $("feedBadge").textContent = feed.jobs.length;
  $("dailyFeedCount").textContent = feed.jobs.length;
  $("dailyFeedTime").textContent = feed.updatedAt ? `更新于 ${new Date(feed.updatedAt).toLocaleTimeString("zh-CN", { hour:"2-digit", minute:"2-digit" })}` : "等待更新";
  $("dailyFeedPreview").innerHTML = feed.jobs.length ? feed.jobs.slice(0, 8).map(job => `
    <div class="feed-row"><strong>${escapeHtml(job.title)}</strong><span>${escapeHtml(job.company || job.department || "招聘单位")}</span><small>${escapeHtml(job.city || "全国")} · ${escapeHtml(job.platform || job.source || "官方公告")}</small></div>`).join("") : `<div class="empty compact-empty">每日任务完成后，新岗位会显示在这里。</div>`;
}
function mergeDailyFeed() {
  const feed = getDailyFeed();
  let added = 0;
  for (const raw of feed.jobs) {
    const job = normalizeJob(raw);
    const key = raw.sourceKey || `${job.title}|${job.company}|${job.url}`;
    const duplicate = state.mergedFeedKeys.includes(key) || state.jobs.some(item => item.title === job.title && item.company === job.company && item.url === job.url);
    if (!duplicate && job.title && job.company) {
      state.jobs.push(job);
      state.mergedFeedKeys.push(key);
      added += 1;
    }
  }
  saveState();
  toast(added ? `已合并 ${added} 个今日岗位` : "没有新的可合并岗位");
  renderDailyFeed();
}
function renderJobs() {
  const jobs = getFilteredJobs();
  $("jobResultCount").textContent = `${jobs.length} 个岗位`;
  $("jobList").innerHTML = jobs.length ? jobs.map(job => `
    <article class="job-card">
      <div>
        <div class="job-title-row"><h4>${escapeHtml(job.title)}</h4><span class="source-chip">${escapeHtml(job.platform)}</span></div>
        <div class="job-meta">${escapeHtml(job.company)} · ${escapeHtml(job.city)} · ${escapeHtml(job.salary || "薪资面议")} · 发布于 ${escapeHtml(job.publishedAt || "未知")}</div>
        <div class="job-tags">${(job.tags || []).map(tag => `<span class="job-tag">${escapeHtml(tag)}</span>`).join("")}</div>
        <p class="hint job-reason">${escapeHtml(job.match.reasons.join("；"))}</p>
      </div>
      <div class="match-box"><strong>${job.match.score}%</strong><small>匹配度</small><button class="primary add-queue" data-id="${job.id}">${state.queue.includes(job.id) ? "已加入" : "加入队列"}</button></div>
    </article>`).join("") : `<div class="empty">没有符合当前筛选条件的岗位。</div>`;
}

function todayRecords() {
  const today = new Date().toISOString().slice(0, 10);
  return state.records.filter(record => String(record.time || "").slice(0, 10) === today && record.status === "已投递");
}
function evaluateRule(job, provisionalCounts={}) {
  const match = calculateMatch(job);
  const reasons = [];
  if (match.blocked) reasons.push(...match.reasons);
  if (match.score < Number(state.automation.threshold)) reasons.push(`匹配度 ${match.score}% 低于阈值`);
  const blacklist = normalizeList(state.automation.blacklist);
  if (blacklist.some(name => job.company.includes(name))) reasons.push("公司在黑名单中");
  if (state.automation.freshnessDays && job.publishedAt) {
    const age = Math.floor((Date.now() - new Date(`${job.publishedAt}T00:00:00`).getTime()) / 86400000);
    if (age > Number(state.automation.freshnessDays)) reasons.push(`岗位已发布 ${age} 天`);
  }
  if (state.automation.skipApplied && state.records.some(r => r.company === job.company && r.title === job.title && r.status === "已投递")) reasons.push("同公司同职位已投递");
  const existingCompanyCount = state.records.filter(r => r.company === job.company && r.status === "已投递").length;
  const plannedCompanyCount = provisionalCounts[job.company] || 0;
  if (existingCompanyCount + plannedCompanyCount >= Number(state.automation.companyLimit)) reasons.push("达到同公司投递上限");
  if (state.queue.includes(job.id)) reasons.push("已在投递队列");
  return { eligible:reasons.length === 0, reasons, match };
}
function simulateRules() {
  const quota = Math.max(0, Number(state.automation.dailyLimit) - todayRecords().length);
  const counts = {};
  const accepted = [];
  const skipped = [];
  const sorted = [...state.jobs].sort((a, b) => calculateMatch(b).score - calculateMatch(a).score);
  for (const job of sorted) {
    const result = evaluateRule(job, counts);
    if (result.eligible && accepted.length < quota) {
      accepted.push({ ...job, score:result.match.score });
      counts[job.company] = (counts[job.company] || 0) + 1;
    } else {
      skipped.push({ ...job, score:result.match.score, reasons:result.eligible ? ["达到今日剩余额度"] : result.reasons });
    }
  }
  state.lastSimulation = { time:new Date().toISOString(), quota, accepted, skipped };
  saveState();
  renderSimulation();
  return state.lastSimulation;
}
function renderSimulation() {
  const result = state.lastSimulation;
  if (!result) {
    $("simulationResult").className = "empty";
    $("simulationResult").textContent = "点击“模拟运行”，查看哪些岗位会被加入队列以及被跳过的原因。";
    return;
  }
  $("simulationResult").className = "simulation-result";
  $("simulationResult").innerHTML = `
    <div class="simulation-summary"><strong>${result.accepted.length}</strong><span>符合规则</span><strong>${result.skipped.length}</strong><span>被跳过</span><small>${new Date(result.time).toLocaleString("zh-CN")}</small></div>
    <div class="simulation-columns">
      <div><h4>将加入队列</h4>${result.accepted.length ? result.accepted.map(j => `<div class="simulation-row ok"><span>${escapeHtml(j.title)} · ${escapeHtml(j.company)}</span><b>${j.score}%</b></div>`).join("") : `<p class="hint">暂无符合规则的岗位。</p>`}</div>
      <div><h4>跳过</h4>${result.skipped.slice(0, 12).map(j => `<div class="simulation-row skip"><span>${escapeHtml(j.title)}<small>${escapeHtml(j.reasons.join("；"))}</small></span><b>${j.score}%</b></div>`).join("")}</div>
    </div>`;
}

function generateMessage(job) {
  const skills = (state.analysis?.skills || normalizeList(state.profile.keywords)).slice(0, 4).join("、") || "相关岗位";
  return state.automation.messageTemplate
    .replaceAll("{姓名}", state.profile.name || "求职者")
    .replaceAll("{职位}", job.title)
    .replaceAll("{公司}", job.company)
    .replaceAll("{技能}", skills)
    .replaceAll("{城市}", job.city);
}
function searchUrl(job) {
  if (job.url) return job.url;
  const keyword = encodeURIComponent(`${job.title} ${state.profile.city || job.city}`.trim());
  return window.JobPlatformAdapters.getSearchUrl(job.platform, keyword);
}
function renderQueue() {
  const jobs = state.queue.map(id => state.jobs.find(job => job.id === id)).filter(Boolean);
  $("queueList").innerHTML = jobs.length ? jobs.map(job => `
    <article class="queue-item">
      <div><h4>${escapeHtml(job.title)} · ${escapeHtml(job.company)}</h4><p>${escapeHtml(job.platform)}｜${escapeHtml(job.city)}｜${escapeHtml(job.salary || "薪资面议")}｜匹配度 ${calculateMatch(job).score}%</p><small class="message-preview">${escapeHtml(generateMessage(job))}</small></div>
      <div class="queue-actions"><button class="ghost remove-queue" data-id="${job.id}">移除</button><button class="primary prepare-job" data-id="${job.id}">准备投递</button></div>
    </article>`).join("") : `<div class="empty">队列为空，可从岗位匹配或自动化中心生成。</div>`;
}
function renderRecords() {
  $("recordList").innerHTML = state.records.length ? state.records.map(record => `
    <article class="record-item"><div><h4>${escapeHtml(record.title)} · ${escapeHtml(record.company)}</h4><p>${escapeHtml(record.platform)}｜${escapeHtml(record.status)}｜${new Date(record.time).toLocaleString("zh-CN")}</p></div><span class="chip">${escapeHtml(record.status)}</span></article>`).join("") : `<div class="empty">暂无投递记录。</div>`;
}
function renderAutomation() {
  $("autoThreshold").value = state.automation.threshold;
  $("dailyLimit").value = state.automation.dailyLimit;
  $("companyLimit").value = state.automation.companyLimit;
  $("freshnessDays").value = String(state.automation.freshnessDays);
  $("companyBlacklist").value = state.automation.blacklist;
  $("skipApplied").checked = state.automation.skipApplied;
  $("messageTemplate").value = state.automation.messageTemplate;
  $("adapterGrid").innerHTML = window.JobPlatformAdapters.list().map(adapter => `
    <div class="adapter-card"><span class="platform-logo ${adapter.key}">${adapter.short}</span><div><strong>${adapter.name}</strong><small>${adapter.modeLabel}</small></div><span class="adapter-status">${adapter.statusLabel}</span></div>`).join("");
  renderSimulation();
}
function readAutomationForm() {
  state.automation = {
    threshold:Number($("autoThreshold").value) || 75,
    dailyLimit:Number($("dailyLimit").value) || 8,
    companyLimit:Number($("companyLimit").value) || 1,
    freshnessDays:Number($("freshnessDays").value) || 0,
    blacklist:$("companyBlacklist").value.trim(),
    skipApplied:$("skipApplied").checked,
    messageTemplate:$("messageTemplate").value.trim() || DEFAULT_MESSAGE
  };
}
function updateDashboard() {
  const fields = Object.values(state.profile).filter(Boolean).length;
  const readiness = Math.min(100, (state.resume ? 25 : 0) + (state.analysis ? 15 : 0) + fields * 6 + (state.automation.messageTemplate ? 12 : 0));
  $("profileScore").textContent = readiness;
  $("profileRing").style.strokeDashoffset = 314 - 314 * readiness / 100;
  $("matchedCount").textContent = state.jobs.filter(job => calculateMatch(job).score >= state.automation.threshold).length;
  $("pendingCount").textContent = state.queue.length;
  $("appliedCount").textContent = state.records.filter(record => record.status === "已投递").length;
  $("queueBadge").textContent = state.queue.length;
  $("resumeStepText").textContent = state.resume ? `已导入 ${state.resume.length} 字` : "等待导入简历";
  renderDailyFeed();
}
function hydrate() {
  $("resumeText").value = state.resume;
  $("candidateName").value = state.profile.name;
  $("targetRole").value = state.profile.role;
  $("targetCity").value = state.profile.city;
  $("minSalary").value = state.profile.minSalary;
  $("experience").value = state.profile.experience;
  $("education").value = state.profile.education;
  $("keywords").value = state.profile.keywords;
  $("excludeKeywords").value = state.profile.exclude;
  if (state.analysis) renderAnalysis();
  populatePlatformOptions();
  renderDashboardPlatforms();
  renderAutomation();
  updateDashboard();
}
function addToQueue(id) {
  if (state.queue.includes(id)) return toast("该岗位已在队列中");
  state.queue.push(id);
  saveState();
  renderJobs();
  toast("已加入投递队列");
}
function parseImportedJobs(text, filename) {
  if (filename.toLowerCase().endsWith(".json")) {
    const value = JSON.parse(text);
    return Array.isArray(value) ? value : value.jobs || [];
  }
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const rows = lines.map(line => line.split(",").map(cell => cell.replace(/^"|"$/g, "").trim()));
  const header = rows.shift().map(x => x.toLowerCase());
  return rows.map(row => {
    const item = Object.fromEntries(header.map((key, index) => [key, row[index] || ""]));
    return { title:item.title || item["职位"], company:item.company || item["公司"], city:item.city || item["城市"], salary:item.salary || item["薪资"], platform:item.platform || item["平台"] || "BOSS直聘", tags:normalizeList(item.tags || item["关键词"]), description:item.description || item["描述"] || "", url:item.url || item["链接"] || "", publishedAt:item.publishedat || item["发布日期"] || "" };
  });
}
function normalizeJob(job) {
  const platformNames = window.JobPlatformAdapters.names();
  return {
    id:job.id || `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title:String(job.title || "").trim(),
    company:String(job.company || "").trim(),
    city:String(job.city || "").trim(),
    salary:String(job.salary || "").trim(),
    platform:platformNames.includes(job.platform) ? job.platform : String(job.platform || "官方招聘公告"),
    experience:String(job.experience || "").trim(),
    tags:Array.isArray(job.tags) ? job.tags : normalizeList(job.tags),
    description:String(job.description || "").trim(),
    publishedAt:String(job.publishedAt || "").slice(0, 10),
    url:String(job.url || "").trim(),
    jobType:String(job.jobType || job.category || "").trim(),
    deadline:String(job.deadline || "").slice(0, 10),
    source:String(job.source || "").trim()
  };
}
function populatePlatformOptions() {
  const names = window.JobPlatformAdapters.names();
  $("platformFilter").innerHTML = `<option value="all">全部平台</option>${names.map(name => `<option>${escapeHtml(name)}</option>`).join("")}`;
  $("jobPlatformSelect").innerHTML = names.map(name => `<option>${escapeHtml(name)}</option>`).join("");
}
function renderDashboardPlatforms() {
  $("dashboardPlatforms").innerHTML = window.JobPlatformAdapters.list().slice(0, 6).map(adapter => `
    <button data-platform="${adapter.key}"><span class="platform-logo ${adapter.key}">${escapeHtml(adapter.short)}</span><span><strong>${escapeHtml(adapter.name)}</strong><small>${escapeHtml(adapter.modeLabel)}</small></span><i>打开</i></button>`).join("");
}

document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => switchView(button.dataset.view)));
document.querySelectorAll("[data-jump]").forEach(button => button.addEventListener("click", () => switchView(button.dataset.jump)));
document.addEventListener("click", event => {
  const button = event.target.closest("[data-platform]");
  if (button) window.open(window.JobPlatformAdapters.getHomeUrl(button.dataset.platform), "_blank", "noopener");
});

$("sourceCategory").addEventListener("change", () => {
  state.sourcePrefs.category = $("sourceCategory").value;
  saveState();
  renderSources();
});
$("sourceGrid").addEventListener("change", event => {
  const input = event.target.closest("[data-source-id]");
  if (!input) return;
  state.sourcePrefs.selected = input.checked
    ? [...new Set([...state.sourcePrefs.selected, input.dataset.sourceId])]
    : state.sourcePrefs.selected.filter(id => id !== input.dataset.sourceId);
  saveState();
});
$("sourceGrid").addEventListener("click", event => {
  const button = event.target.closest(".open-source");
  if (!button) return;
  const source = window.JobSources.find(item => item.id === button.dataset.sourceId);
  if (source) window.open(sourceUrl(source), "_blank", "noopener");
});
$("selectRecommendedSources").addEventListener("click", () => {
  state.sourcePrefs.selected = window.JobSources.filter(source => source.recommended).map(source => source.id);
  saveState();
  renderSources();
  toast("已选择推荐来源");
});
$("openSourceSearch").addEventListener("click", () => {
  const selected = window.JobSources.filter(source => state.sourcePrefs.selected.includes(source.id));
  if (!selected.length) return toast("请先勾选至少一个岗位来源");
  selected.slice(0, 8).forEach(source => window.open(sourceUrl(source), "_blank", "noopener"));
  if (selected.length > 8) toast("为避免浏览器拦截，本次打开前 8 个来源");
});
$("mergeDailyFeed").addEventListener("click", mergeDailyFeed);

$("resumeFile").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;
  $("resumeText").value = await file.text();
  toast(`已读取 ${file.name}`);
});
$("analyzeResume").addEventListener("click", () => {
  const text = $("resumeText").value.trim();
  if (!text) return toast("请先粘贴简历文本");
  state.resume = text;
  state.analysis = analyzeText(text);
  if (!$("keywords").value && state.analysis.skills.length) $("keywords").value = state.analysis.skills.join(", ");
  renderAnalysis();
  saveState();
  toast("简历分析完成");
});
$("clearResume").addEventListener("click", () => {
  if (!confirm("确定清空简历和分析结果吗？")) return;
  state.resume = "";
  state.analysis = null;
  $("resumeText").value = "";
  $("analysisEmpty").classList.remove("hidden");
  $("analysisResult").classList.add("hidden");
  saveState();
});
$("saveProfile").addEventListener("click", () => {
  state.profile = {
    name:$("candidateName").value.trim(), role:$("targetRole").value.trim(), city:$("targetCity").value.trim(),
    minSalary:$("minSalary").value, experience:$("experience").value, education:$("education").value,
    keywords:$("keywords").value.trim(), exclude:$("excludeKeywords").value.trim()
  };
  saveState();
  toast("求职画像已保存");
});

["jobSearch","platformFilter","matchFilter"].forEach(id => $(id).addEventListener("input", () => {
  if (id === "matchFilter") $("matchValue").textContent = `${$("matchFilter").value}%`;
  renderJobs();
}));
$("jobList").addEventListener("click", event => {
  const button = event.target.closest(".add-queue");
  if (button) addToQueue(button.dataset.id);
});
$("addJobBtn").addEventListener("click", () => $("jobDialog").showModal());
$("saveJobBtn").addEventListener("click", event => {
  if (!$("jobForm").reportValidity()) { event.preventDefault(); return; }
  const data = Object.fromEntries(new FormData($("jobForm")));
  state.jobs.push(normalizeJob({ ...data, tags:normalizeList(data.tags) }));
  saveState();
  $("jobForm").reset();
  setTimeout(renderJobs);
  toast("岗位已录入");
});
$("importJobsBtn").addEventListener("click", () => $("jobsFile").click());
$("jobsFile").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const jobs = parseImportedJobs(await file.text(), file.name).map(normalizeJob).filter(job => job.title && job.company);
    state.jobs.push(...jobs);
    saveState();
    renderJobs();
    toast(`已导入 ${jobs.length} 个岗位`);
  } catch { toast("导入失败，请检查 JSON 或 CSV 格式"); }
  event.target.value = "";
});
$("queueAll").addEventListener("click", () => {
  getFilteredJobs().filter(job => job.match.score >= state.automation.threshold).forEach(job => { if (!state.queue.includes(job.id)) state.queue.push(job.id); });
  saveState();
  renderJobs();
  toast("高匹配岗位已加入队列");
});

$("queueList").addEventListener("click", event => {
  const remove = event.target.closest(".remove-queue");
  if (remove) {
    state.queue = state.queue.filter(id => id !== remove.dataset.id);
    saveState();
    renderQueue();
    return;
  }
  const prepare = event.target.closest(".prepare-job");
  if (prepare) {
    const job = state.jobs.find(item => item.id === prepare.dataset.id);
    pendingJobId = job.id;
    $("confirmJobInfo").innerHTML = `<div class="confirm-card"><strong>${escapeHtml(job.title)} · ${escapeHtml(job.company)}</strong><span>${escapeHtml(job.platform)}｜${escapeHtml(job.city)}｜${escapeHtml(job.salary || "薪资面议")}</span></div>`;
    $("confirmMessage").value = generateMessage(job);
    $("confirmDialog").showModal();
  }
});
$("confirmOpenBtn").addEventListener("click", async () => {
  const job = state.jobs.find(item => item.id === pendingJobId);
  if (!job) return;
  try { await navigator.clipboard.writeText($("confirmMessage").value); } catch { $("confirmMessage").select(); document.execCommand("copy"); }
  window.open(searchUrl(job), "_blank", "noopener");
  setTimeout(() => {
    const completed = confirm(`已复制话术并打开 ${job.platform}。\n\n请核对岗位并完成投递。若已成功提交，点击“确定”记录为已投递；否则点击“取消”。`);
    if (completed) {
      state.records.unshift({ ...job, message:$("confirmMessage").value, time:new Date().toISOString(), status:"已投递" });
      state.queue = state.queue.filter(id => id !== job.id);
      saveState();
      renderQueue();
      toast("投递结果已记录");
    }
  }, 250);
});
$("clearQueue").addEventListener("click", () => {
  if (state.queue.length && confirm("确定清空投递队列吗？")) { state.queue = []; saveState(); renderQueue(); }
});

$("saveAutomation").addEventListener("click", () => { readAutomationForm(); saveState(); toast("自动化设置已保存"); });
$("simulateBtn").addEventListener("click", () => { readAutomationForm(); simulateRules(); toast("模拟运行完成"); });
$("runRulesBtn").addEventListener("click", () => {
  readAutomationForm();
  const result = simulateRules();
  result.accepted.forEach(job => { if (!state.queue.includes(job.id)) state.queue.push(job.id); });
  saveState();
  toast(`已生成 ${result.accepted.length} 个待确认任务`);
});
$("exportPlanBtn").addEventListener("click", () => {
  if (!state.lastSimulation) simulateRules();
  download(`投递执行计划_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state.lastSimulation, null, 2), "application/json;charset=utf-8");
});

$("exportBtn").addEventListener("click", () => {
  const rows = [["投递时间","职位","公司","平台","城市","薪资","状态"], ...state.records.map(r => [new Date(r.time).toLocaleString("zh-CN"), r.title, r.company, r.platform, r.city, r.salary, r.status])];
  const csv = "\ufeff" + rows.map(row => row.map(cell => `"${String(cell || "").replaceAll('"', '""')}"`).join(",")).join("\n");
  download(`投递记录_${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv;charset=utf-8");
});
$("backupBtn").addEventListener("click", () => download(`职投台备份_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state, null, 2), "application/json;charset=utf-8"));
$("clearRecords").addEventListener("click", () => {
  if (state.records.length && confirm("确定清除全部投递记录吗？")) { state.records = []; saveState(); renderRecords(); }
});

hydrate();
