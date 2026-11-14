#!/usr/bin/env node
/**
 * Fetches public GitHub activity and writes it to assets/data/github.json.
 * The portfolio reads that file, so visitors never call the GitHub API for the graph
 * and no token ever reaches the browser.
 *
 * Runs in GitHub Actions (see .github/workflows/github-activity.yml). Locally:
 *   GITHUB_TOKEN=ghp_xxx node scripts/fetch-github-activity.mjs [username]
 *
 * Environment:
 *   GH_STATS_TOKEN   optional personal token (read:user). If set it is preferred, and
 *                    the contribution graph then also counts private contributions
 *                    (counts only, no private repo names are ever written out).
 *   GITHUB_TOKEN     the token Actions provides. Enough for all public data.
 *   GH_USER          username override (otherwise argv[2], then "Salunkhesmit").
 *   GITHUB_API_URL / GITHUB_GRAPHQL_URL   set by Actions; override for local testing.
 *
 * Requires Node 18+ (built-in fetch). No dependencies.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { summarizeEvents, addCommitMessages, summarizeCalendar } from "../assets/js/github-core.js";

const USER = process.argv[2] || process.env.GH_USER || "Salunkhesmit";
const TOKEN = process.env.GH_STATS_TOKEN || process.env.GITHUB_TOKEN || "";
const REST = (process.env.GITHUB_API_URL || "https://api.github.com").replace(/\/$/, "");
const GRAPHQL = process.env.GITHUB_GRAPHQL_URL || `${REST}/graphql`;
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../assets/data/github.json");

const MAX_REPOS = 6;
const MAX_EVENTS = 8;
const MAX_LANGUAGES = 6;

/* GraphQL contribution levels -> 0..4 */
const LEVELS = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": `${USER}-portfolio-activity`,
  "X-GitHub-Api-Version": "2022-11-28",
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

async function rest(path) {
  const res = await fetch(`${REST}${path}`, { headers });
  if (!res.ok) throw new Error(`REST ${path} -> ${res.status} ${res.statusText}`);
  return res.json();
}

async function graphql(query, variables) {
  if (!TOKEN) throw new Error("A token is required for the GraphQL API (set GITHUB_TOKEN).");
  const res = await fetch(GRAPHQL, { method: "POST", headers, body: JSON.stringify({ query, variables }) });
  if (!res.ok) throw new Error(`GraphQL -> ${res.status} ${res.statusText}`);
  const body = await res.json();
  if (body.errors?.length) throw new Error(`GraphQL: ${body.errors.map((e) => e.message).join("; ")}`);
  return body.data;
}

const QUERY = /* GraphQL */ `
  query ($login: String!) {
    user(login: $login) {
      login
      name
      bio
      url
      avatarUrl
      createdAt
      followers { totalCount }
      following { totalCount }
      contributionsCollection {
        totalCommitContributions
        totalPullRequestContributions
        totalIssueContributions
        totalPullRequestReviewContributions
        contributionCalendar {
          totalContributions
          weeks { contributionDays { date contributionCount contributionLevel } }
        }
      }
      repositories(first: 100, privacy: PUBLIC, ownerAffiliations: OWNER, isFork: false, orderBy: { field: PUSHED_AT, direction: DESC }) {
        totalCount
        nodes {
          name
          description
          url
          homepageUrl
          stargazerCount
          forkCount
          pushedAt
          isArchived
          primaryLanguage { name color }
          languages(first: 10, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name color } } }
          repositoryTopics(first: 5) { nodes { topic { name } } }
        }
      }
    }
  }`;

function languageShares(repos) {
  const totals = new Map();
  for (const repo of repos) {
    for (const { size, node } of repo.languages.edges) {
      const entry = totals.get(node.name) || { name: node.name, color: node.color, size: 0 };
      entry.size += size;
      totals.set(node.name, entry);
    }
  }
  const all = [...totals.values()].sort((a, b) => b.size - a.size);

  // Same method as the GPRM card
  const top = all.slice(0, MAX_LANGUAGES);
  const sum = top.reduce((n, l) => n + l.size, 0) || 1;
  return top.map((l) => ({
    name: l.name,
    color: l.color || "#8b8b94",
    percent: Math.round((l.size / sum) * 10000) / 100,
  }));
}

/** All-time commit count */
async function fetchTotalCommits(login, createdAt) {
  try {
    const first = new Date(createdAt).getUTCFullYear();
    const last = new Date().getUTCFullYear();
    const years = Array.from({ length: last - first + 1 }, (_, i) => first + i);
    const fields = years
      .map((y) => {
        const to = y === last ? new Date().toISOString() : `${y}-12-31T23:59:59Z`;
        return `y${y}: contributionsCollection(from: "${y}-01-01T00:00:00Z", to: "${to}") { totalCommitContributions }`;
      })
      .join("\n");
    const data = await graphql(`query ($login: String!) { user(login: $login) { ${fields} } }`, { login });
    return years.reduce((sum, y) => sum + data.user[`y${y}`].totalCommitContributions, 0);
  } catch (err) {
    console.warn(`Total commits unavailable, continuing without it: ${err.message}`);
    return null;
  }
}

async function build() {
  const [{ user }, events] = await Promise.all([
    graphql(QUERY, { login: USER }),
    rest(`/users/${encodeURIComponent(USER)}/events/public?per_page=100`).catch((err) => {
      console.warn(`Events unavailable, continuing without them: ${err.message}`);
      return [];
    }),
  ]);
  if (!user) throw new Error(`User "${USER}" not found.`);

  const days = user.contributionsCollection.contributionCalendar.weeks
    .flatMap((w) => w.contributionDays)
    .map((d) => [d.date, d.contributionCount, LEVELS[d.contributionLevel] ?? 0]);

  const repos = user.repositories.nodes.filter((r) => !r.isArchived);
  const summary = summarizeCalendar(days);
  const activity = await addCommitMessages(summarizeEvents(events, MAX_EVENTS), rest, MAX_EVENTS);
  const cc = user.contributionsCollection;
  const totalCommits = await fetchTotalCommits(user.login, user.createdAt);

  return {
    version: 2,
    generatedAt: new Date().toISOString(),
    user: {
      login: user.login,
      name: user.name,
      bio: user.bio,
      url: user.url,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      followers: user.followers.totalCount,
      following: user.following.totalCount,
      publicRepos: user.repositories.totalCount,
    },
    stats: {
      contributionsLastYear: cc.contributionCalendar.totalContributions,
      commits: cc.totalCommitContributions,
      pullRequests: cc.totalPullRequestContributions,
      issues: cc.totalIssueContributions,
      reviews: cc.totalPullRequestReviewContributions,
      starsEarned: user.repositories.nodes.reduce((n, r) => n + r.stargazerCount, 0),
      totalCommits,
      activeDays: summary.activeDays,
      currentStreak: summary.currentStreak,
      longestStreak: summary.longestStreak,
      busiestDay: summary.busiestDay,
    },
    calendar: { from: days[0]?.[0] ?? null, to: days.at(-1)?.[0] ?? null, days },
    languages: languageShares(user.repositories.nodes),
    repos: repos.slice(0, MAX_REPOS).map((r) => ({
      name: r.name,
      description: r.description,
      url: r.url,
      homepage: r.homepageUrl || null,
      language: r.primaryLanguage?.name ?? null,
      languageColor: r.primaryLanguage?.color ?? null,
      stars: r.stargazerCount,
      forks: r.forkCount,
      pushedAt: r.pushedAt,
      topics: r.repositoryTopics.nodes.map((t) => t.topic.name),
    })),
    activity,
  };
}

const stable = (d) => JSON.stringify({ ...d, generatedAt: null });

const data = await build();

let previous = null;
try {
  previous = JSON.parse(await readFile(OUT, "utf8"));
} catch {
  /* first run */
}

if (previous && stable(previous) === stable(data)) {
  console.log("No changes since the last sync; leaving github.json untouched.");
} else {
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(data) + "\n");
  console.log(`Wrote ${OUT} (${data.calendar.days.length} days, ${data.repos.length} repos, ${data.activity.length} events).`);
}
