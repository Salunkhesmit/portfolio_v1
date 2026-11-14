import { summarizeEvents, addCommitMessages, summarizeCalendar } from "./github-core.js";

const section = document.querySelector("#github");
const root = document.querySelector("#gh-root");
const USER = section?.dataset.user || "Salunkhesmit";
const PROFILE_URL = `https://github.com/${USER}`;
const DATA_URL = "assets/data/github.json";
const API = "https://api.github.com";
const CALENDAR_API = `https://github-contributions-api.jogruber.de/v4/${USER}?y=last`;
const CACHE_KEY = "gh-live-v2";
const CACHE_MS = 10 * 60 * 1000; // protects the 60 requests/hour public API limit on reloads
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* helpers */
const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);

export const safeUrl = (url) => (/^https:\/\//i.test(url || "") ? url : "#");

const safeColor = (color) => (/^#[0-9a-f]{3,8}$/i.test(color || "") ? color : "#8b8b94");
const formatNumber = (n) => Number(n).toLocaleString("en-US");

export function timeAgo(iso) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  const units = [["year", 31536000], ["month", 2592000], ["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [label, size] of units) {
    if (seconds >= size) {
      const n = Math.floor(seconds / size);
      return `${n} ${label}${n === 1 ? "" : "s"} ago`;
    }
  }
  return "just now";
}

const utcDate = (isoDate) => new Date(`${isoDate}T00:00:00Z`);
const formatDay = (isoDate) =>
  utcDate(isoDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const formatShortDay = (isoDate) => utcDate(isoDate).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const formatMonth = (isoDate) => utcDate(isoDate).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });

/* loading */
let cached;
export function getGithubData() {
  cached ??= Promise.race([load(), new Promise((resolve) => setTimeout(() => resolve(null), 20000))]);
  return cached;
}

async function load() {
  return (await loadSynced()) ?? (await loadLive());
}

async function loadSynced() {
  try {
    const res = await fetch(DATA_URL, { cache: "no-cache" });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.version >= 1 && data.user ? { ...data, source: "sync" } : null;
  } catch {
    return null;
  }
}

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
  if (!res.ok) throw new ApiError(`${url} -> ${res.status}`, res.status);
  return res.json();
}

const reasonOf = (error) => (error?.status === 403 || error?.status === 429 ? "rate" : "failed");

const LANGUAGE_COLORS = {
  JavaScript: "#f1e05a", HTML: "#e34c26", CSS: "#663399", Python: "#3572a5", Java: "#b07219", C: "#8a8a8a",
  "C++": "#f34b7d", TypeScript: "#3178c6", PHP: "#4f5d95", Shell: "#89e051", SCSS: "#c6538c",
};

async function languagesFromBytes(repoList) {
  const results = await Promise.allSettled(repoList.map((r) => getJson(`${API}/repos/${r.full_name}/languages`)));
  if (results.some((r) => r.status === "rejected")) return []; // a partial total would be wrong, so show nothing
  const totals = {};
  for (const { value } of results) for (const [name, size] of Object.entries(value)) totals[name] = (totals[name] || 0) + size;
  const top = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const sum = top.reduce((n, [, size]) => n + size, 0) || 1;
  return top.map(([name, size]) => ({ name, color: LANGUAGE_COLORS[name] || "#8b8b94", percent: Math.round((size / sum) * 10000) / 100 }));
}

async function loadLive() {
  try {
    const cache = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
    if (cache && Date.now() - cache.savedAt < CACHE_MS) return cache.data;
  } catch {
    /* storage unavailable: carry on */
  }

  const [userResult, reposResult, eventsResult, commitsResult, calendarResult] = await Promise.allSettled([
    getJson(`${API}/users/${USER}`),
    getJson(`${API}/users/${USER}/repos?sort=pushed&per_page=100&type=owner`),
    getJson(`${API}/users/${USER}/events/public?per_page=100`),
    getJson(`${API}/search/commits?q=author:${USER}&per_page=1`),
    fetch(CALENDAR_API).then((res) => {
      if (!res.ok) throw new ApiError("calendar", res.status);
      return res.json();
    }),
  ]);
  if ([userResult, reposResult, eventsResult, calendarResult].every((r) => r.status === "rejected")) return null;

  const errors = {};
  const user = userResult.status === "fulfilled" ? userResult.value : null;
  if (!user) errors.user = reasonOf(userResult.reason);

  let repos = [];
  if (reposResult.status === "fulfilled") {
    repos = reposResult.value.filter((r) => !r.fork && !r.archived);
  } else {
    errors.repos = reasonOf(reposResult.reason);
  }

  let activity = [];
  if (eventsResult.status === "fulfilled") {
    activity = summarizeEvents(eventsResult.value, 8);
    await addCommitMessages(activity, (path) => getJson(`${API}${path}`), 4);
  } else {
    errors.activity = reasonOf(eventsResult.reason);
  }

  let calendar = null;
  let summary = null;
  if (calendarResult.status === "fulfilled" && Array.isArray(calendarResult.value?.contributions)) {
    const days = calendarResult.value.contributions.map((d) => [d.date, d.count, d.level]);
    calendar = { from: days[0]?.[0], to: days.at(-1)?.[0], days };
    summary = summarizeCalendar(days);
  } else {
    errors.calendar = "failed";
  }

  const languages = reposResult.status === "fulfilled" ? await languagesFromBytes(reposResult.value.filter((r) => !r.fork)) : [];

  const data = {
    version: 2,
    source: "live",
    generatedAt: new Date().toISOString(),
    errors,
    user: {
      login: user?.login || USER,
      url: user?.html_url || PROFILE_URL,
      followers: user?.followers ?? null,
      following: user?.following ?? null,
      publicRepos: user?.public_repos ?? null,
      createdAt: user?.created_at ?? null,
    },
    stats: {
      contributionsLastYear: summary?.total,
      activeDays: summary?.activeDays,
      currentStreak: summary?.currentStreak,
      longestStreak: summary?.longestStreak,
      busiestDay: summary?.busiestDay,
      starsEarned: reposResult.status === "fulfilled" ? repos.reduce((n, r) => n + r.stargazers_count, 0) : null,
      totalCommits: commitsResult.status === "fulfilled" ? commitsResult.value.total_count ?? null : null,
    },
    calendar,
    languages,
    activity,
    repos: repos.slice(0, 6).map((r) => ({
      name: r.name, description: r.description, url: r.html_url, language: r.language, languageColor: LANGUAGE_COLORS[r.language] || null,
      stars: r.stargazers_count, forks: r.forks_count, pushedAt: r.pushed_at,
    })),
  };

  try {
    if (!Object.keys(errors).length) sessionStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    /* ignore */
  }
  return data;
}

/* rendering */
const profileLink = (label = "Open GitHub ↗") => `<a href="${PROFILE_URL}" target="_blank" rel="noopener">${label}</a>`;

function partMessage(kind, reason) {
  if (reason === "rate") return `GitHub's public API limit was reached, so ${kind} can't load right now. Try again in a little while.`;
  if (reason === "failed") return `Couldn't load ${kind} from GitHub right now.`;
  return null;
}

function renderHead({ user, source, generatedAt }) {
  const when = generatedAt ? timeAgo(generatedAt).toUpperCase() : "";
  const sync = source === "sync" ? `SYNCED ${when}` : `LIVE FROM GITHUB · ${when}`;
  return `
    <div class="gh-head">
      <span class="gh-user"><span class="led"></span> @${esc(user.login)}</span>
      <span class="gh-sync">${esc(sync)}</span>
      <a class="gh-profile" href="${esc(safeUrl(user.url))}?tab=achievements" target="_blank" rel="noopener">Achievements ↗</a>
      <a class="gh-profile" href="${esc(safeUrl(user.url))}" target="_blank" rel="noopener">View profile ↗</a>
    </div>`;
}

function renderStats({ user, stats = {} }) {
  const tiles = [
    ["Contributions", stats.contributionsLastYear, "last 12 months"],
    ["Current streak", stats.currentStreak, "days"],
    ["Longest streak", stats.longestStreak, "days"],
    ["Public repos", user.publicRepos, "on GitHub"],
    ["Stars earned", stats.starsEarned, "across repos"],
    ["Total commits", stats.totalCommits, user.createdAt ? `since ${new Date(user.createdAt).getUTCFullYear()}` : "all time"],
  ].filter(([, value]) => value !== undefined && value !== null);
  if (!tiles.length) return "";

  return `<div class="gh-stats">${tiles
    .map(
      ([label, value, sub]) => `
      <div class="gh-stat gh-card">
        <b class="gh-num" data-count="${esc(value)}">${formatNumber(value)}</b>
        <span class="gh-label">${esc(label)}</span>
        <span class="gh-sub-label">${esc(sub)}</span>
      </div>`,
    )
    .join("")}</div>`;
}

/* The calendar is an SVG (Sunday on top) */
const CELL = 11, STEP = 14, LEFT = 30, TOP = 20;

function renderCalendar(calendar, summary, stats) {
  const firstWeekday = utcDate(calendar.days[0][0]).getUTCDay();
  const weeks = Math.ceil((calendar.days.length + firstWeekday) / 7);
  const width = LEFT + weeks * STEP;
  const height = TOP + 7 * STEP;

  const monthLabels = [];
  let lastMonth = "", lastLabelWeek = -10;
  const cells = calendar.days.map(([date, count, level], i) => {
    const slot = i + firstWeekday;
    const week = Math.floor(slot / 7);
    const month = date.slice(0, 7);
    if (month !== lastMonth) {
      if (week - lastLabelWeek >= 3) {
        monthLabels.push(`<text class="gh-axis" x="${LEFT + week * STEP}" y="10">${formatMonth(date)}</text>`);
        lastLabelWeek = week;
      }
      lastMonth = month;
    }
    return `<rect class="gh-cell l${level}" x="${LEFT + week * STEP}" y="${TOP + (slot % 7) * STEP}" width="${CELL}" height="${CELL}" rx="2" data-date="${date}" data-count="${count}" style="--w:${week}"/>`;
  });

  const weekdayLabels = [[1, "Mon"], [3, "Wed"], [5, "Fri"]]
    .map(([row, name]) => `<text class="gh-axis" x="0" y="${TOP + row * STEP + 9}">${name}</text>`)
    .join("");

  const total = stats.contributionsLastYear ?? summary.total;
  const busiest = summary.busiestDay.count ? `Busiest day: ${formatDay(summary.busiestDay.date)} · ${summary.busiestDay.count}` : "";

  return `
    <div class="gh-graph-head">
      <p class="gh-title">CONTRIBUTIONS · LAST 12 MONTHS</p>
      <p class="gh-total"><b>${formatNumber(total)}</b> contributions</p>
    </div>
    <div class="gh-scroll" tabindex="0" aria-label="Contribution calendar, scrollable">
      <svg class="gh-graph" viewBox="0 0 ${width} ${height}" style="min-width:${width}px" role="img"
           aria-label="Contribution calendar: ${formatNumber(total)} contributions in the last 12 months">
        ${monthLabels.join("")}${weekdayLabels}${cells.join("")}
      </svg>
    </div>
    <div class="gh-graph-foot">
      <p class="gh-readout" id="gh-readout" aria-live="polite">${esc(busiest) || "Hover or tap a day for details."}</p>
      <div class="gh-legend" aria-hidden="true">Less
        <i class="gh-cell l0"></i><i class="gh-cell l1"></i><i class="gh-cell l2"></i><i class="gh-cell l3"></i><i class="gh-cell l4"></i> More
      </div>
    </div>`;
}

function renderInsights(summary, calendar) {
  const months = summary.months.slice(-12);
  const peak = Math.max(1, ...months.map((m) => m.total));
  const bars = months
    .map((m, i) => {
      const label = formatMonth(`${m.key}-01`);
      const scale = m.total === 0 ? 0.03 : Math.max(0.08, m.total / peak);
      return `<div class="gh-month" title="${label} ${m.key.slice(0, 4)} · ${formatNumber(m.total)} contributions" style="--i:${i}">
        <i style="--s:${scale.toFixed(3)}"></i><span>${label}</span></div>`;
    })
    .join("");

  const best = months.reduce((a, b) => (b.total > a.total ? b : a), months[0]);
  const weeks = Math.max(1, calendar.days.length / 7);
  const facts = [
    ["Active days", `${formatNumber(summary.activeDays)} <small>/ ${formatNumber(calendar.days.length)}</small>`],
    ["Busiest month", best.total ? `${formatMonth(`${best.key}-01`)} <small>· ${formatNumber(best.total)}</small>` : "—"],
    ["Best day", summary.busiestDay.count ? `${formatShortDay(summary.busiestDay.date)} <small>· ${summary.busiestDay.count}</small>` : "—"],
    ["Weekly average", formatNumber(Math.round((summary.total / weeks) * 10) / 10)],
  ];

  return `
    <div class="gh-insights">
      <div>
        <p class="gh-title">BY MONTH</p>
        <div class="gh-months" role="img" aria-label="Contributions per month">${bars}</div>
      </div>
      <dl class="gh-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
    </div>`;
}

function renderContributions(data) {
  const { calendar, stats = {}, errors = {} } = data;
  if (!calendar?.days?.length) {
    const message = partMessage("the contribution calendar", errors.calendar) || "The contribution calendar isn't available yet. It appears after the next scheduled sync.";
    return `
      <div class="gh-graph-card gh-card">
        <p class="gh-title">CONTRIBUTIONS</p>
        <p class="gh-empty">&gt; ${esc(message)} ${profileLink("View it on GitHub ↗")}</p>
      </div>`;
  }
  const summary = summarizeCalendar(calendar.days);
  return `
    <div class="gh-graph-card gh-card">
      ${renderCalendar(calendar, summary, stats)}
      ${renderInsights(summary, calendar)}
    </div>`;
}

function renderLanguages({ languages, languagesBasis }) {
  if (!languages?.length) return "";
  const basis = languagesBasis === "repos" ? "BY REPOSITORY" : "BY CODE SIZE";
  const bar = languages
    .map((l) => `<i style="width:${l.percent}%;background:${safeColor(l.color)}" title="${esc(l.name)} ${l.percent}%"></i>`)
    .join("");
  const legend = languages
    .map((l) => `<li><i style="background:${safeColor(l.color)}"></i>${esc(l.name)} <span>${Number(l.percent).toFixed(2)}%</span></li>`)
    .join("");
  return `
    <div class="gh-lang gh-card">
      <p class="gh-title">TOP LANGUAGES · ${basis}</p>
      <div class="gh-lang-bar" role="img" aria-label="Language breakdown">${bar}</div>
      <ul class="gh-lang-legend">${legend}</ul>
    </div>`;
}

function renderRepos({ repos = [], errors = {} }) {
  let body;
  if (repos.length) {
    body = `<div class="gh-repos">${repos
      .map((r) => {
        const language = r.language
          ? `<span class="gh-meta-item"><i class="gh-dot" style="background:${safeColor(r.languageColor)}"></i>${esc(r.language)}</span>`
          : "";
        return `
        <a class="gh-repo gh-card" href="${esc(safeUrl(r.url))}" target="_blank" rel="noopener">
          <span class="gh-repo-name">${esc(r.name)} <em>↗</em></span>
          <span class="gh-repo-desc">${esc(r.description || "No description yet.")}</span>
          <span class="gh-meta">
            ${language}
            <span class="gh-meta-item" title="Stars">★ ${formatNumber(r.stars)}</span>
            <span class="gh-meta-item" title="Forks">⑂ ${formatNumber(r.forks)}</span>
            <span class="gh-meta-item gh-when" title="Last pushed">↻ ${esc(timeAgo(r.pushedAt))}</span>
          </span>
        </a>`;
      })
      .join("")}</div>`;
  } else {
    const message = partMessage("repositories", errors.repos) || "No public repositories to show yet.";
    body = `<p class="gh-empty gh-card gh-box">&gt; ${esc(message)} ${profileLink()}</p>`;
  }
  return `<div><p class="gh-subtitle">RECENT REPOSITORIES</p>${body}</div>`;
}

const EVENT_GLYPHS = { push: "↑", pr: "⇄", issue: "◎", comment: "✎", review: "✓", create: "+", release: "⚑", star: "★", fork: "⑂" };

function renderFeed({ activity = [], user, errors = {} }) {
  const own = `${user.login}/`.toLowerCase();
  let body;
  if (activity.length) {
    body = `<ol class="gh-log">${activity
      .map((e) => {
        const name = e.repo.toLowerCase().startsWith(own) ? e.repo.slice(own.length) : e.repo;
        const when = new Date(e.at);
        return `
        <li class="gh-ev gh-ev--${esc(e.type)}">
          <span class="gh-ev-ico" aria-hidden="true">${EVENT_GLYPHS[e.type] || "•"}</span>
          <div class="gh-ev-body">
            <p class="gh-ev-line"><a class="gh-ev-repo" href="https://github.com/${esc(e.repo)}" target="_blank" rel="noopener">${esc(name)}</a>
              <a class="gh-ev-act" href="${esc(safeUrl(e.url))}" target="_blank" rel="noopener">${esc(e.action || e.text || "")}</a></p>
            ${e.detail ? `<p class="gh-ev-detail">${esc(e.detail)}</p>` : ""}
          </div>
          <time datetime="${esc(e.at)}" title="${esc(when.toLocaleString())}">${esc(timeAgo(e.at))}</time>
        </li>`;
      })
      .join("")}</ol>`;
  } else {
    const message = partMessage("recent activity", errors.activity) || "No public activity in the last 90 days.";
    body = `<p class="gh-empty gh-log">&gt; ${esc(message)} ${profileLink()}</p>`;
  }
  return `
    <div>
      <p class="gh-subtitle">LATEST ACTIVITY</p>
      <div class="gh-feed gh-card">
        <div class="tm-bar"><i></i><i></i><i></i><span>activity.log · public events</span></div>
        ${body}
        ${activity.length ? `<p class="gh-feed-foot">${profileLink("All activity on GitHub ↗")}</p>` : ""}
      </div>
    </div>`;
}

function renderNote({ source, errors = {} }) {
  const note =
    source === "sync"
      ? "Public data only, refreshed automatically by a scheduled GitHub Action."
      : "Public data only, fetched live from GitHub's API. The contribution calendar comes from a community API until the scheduled sync has run.";
  return `<p class="note">${note}${Object.keys(errors).length ? " Some parts couldn't be loaded." : ""}</p>`;
}

function render(data) {
  root.innerHTML = [
    renderHead(data),
    renderStats(data),
    renderContributions(data),
    renderLanguages(data),
    `<div class="gh-cols">${renderRepos(data)}${renderFeed(data)}</div>`,
    renderNote(data),
  ].join("");
  root.removeAttribute("aria-busy");
  enhance();
}

/* behaviour */
function enhance() {
  const scroller = root.querySelector(".gh-scroll");
  if (scroller) scroller.scrollLeft = scroller.scrollWidth;

  showReadoutOnHover();

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        entry.target.classList.add("in");
        entry.target.querySelector(".gh-graph")?.classList.add("in");
        if (entry.target.classList.contains("gh-stat")) countUp(entry.target.querySelector(".gh-num"));
      }
    },
    { threshold: 0.15 },
  );
  root.querySelectorAll(".gh-scroll, .gh-insights, .gh-stat").forEach((el) => {
    if (el.classList.contains("gh-stat") && !reduce) el.querySelector(".gh-num").textContent = "0";
    observer.observe(el);
  });
}

function showReadoutOnHover() {
  const svg = root.querySelector(".gh-graph");
  const readout = root.querySelector("#gh-readout");
  if (!svg || !readout) return;
  const idle = readout.textContent;
  const show = (e) => {
    const cell = e.target.closest(".gh-cell");
    if (!cell) return;
    const n = Number(cell.dataset.count);
    readout.textContent = `${formatDay(cell.dataset.date)} · ${n === 0 ? "no contributions" : `${n} contribution${n === 1 ? "" : "s"}`}`;
  };
  svg.addEventListener("pointerover", show);
  svg.addEventListener("click", show); // touch devices
  svg.addEventListener("pointerleave", () => (readout.textContent = idle));
}

function countUp(el) {
  const target = Number(el.dataset.count);
  if (reduce || !Number.isFinite(target)) {
    el.textContent = formatNumber(target);
    return;
  }
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - start) / 900);
    el.textContent = formatNumber(Math.round(target * (1 - Math.pow(1 - t, 3))));
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

if (root) {
  const showUnavailable = () => {
    root.innerHTML = `<p class="gh-state">&gt; GitHub activity is unavailable right now. ${profileLink()}</p>`;
    root.removeAttribute("aria-busy");
  };
  getGithubData()
    .then((data) => (data ? render(data) : showUnavailable()))
    .catch((err) => {
      console.error("GitHub activity failed:", err);
      showUnavailable();
    });
}
