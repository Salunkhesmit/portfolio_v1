/*
 * Pure GitHub-data helpers shared by:
 *   - scripts/fetch-github-activity.mjs
 *   - assets/js/github.js
*/
const firstLine = (text = "", max = 90) => String(text).split("\n")[0].trim().slice(0, max);
const repoUrl = (name) => `https://github.com/${name}`;

/* public events -> display items */

export function describeEvent(e) {
  const repo = e.repo?.name || "";
  const p = e.payload || {};
  const base = { repo, url: repoUrl(repo), at: e.created_at, detail: null };

  switch (e.type) {
    case "PushEvent": {
      const head = p.head || null;
      const lastCommit = p.commits?.[p.commits.length - 1];
      return {
        ...base,
        type: "push",
        branch: (p.ref || "").replace("refs/heads/", "") || null,
        commits: p.size ?? p.commits?.length ?? null,
        pushes: 1,
        head,
        detail: lastCommit ? firstLine(lastCommit.message) : null,
        url: head ? `${repoUrl(repo)}/commit/${head}` : base.url,
      };
    }
    case "CreateEvent":
      if (p.ref_type === "repository") return { ...base, type: "create", action: "created repository" };
      if (p.ref_type === "tag") return { ...base, type: "create", action: `tagged ${p.ref}` };
      return null; // new branches are noise
    case "PullRequestEvent": {
      const pr = p.pull_request || {};
      const verb = pr.merged ? "merged" : p.action;
      return { ...base, type: "pr", action: `${verb} pull request #${pr.number ?? p.number ?? ""}`.trim(), detail: firstLine(pr.title) || null, url: pr.html_url || base.url };
    }
    case "IssuesEvent":
      return { ...base, type: "issue", action: `${p.action} issue #${p.issue?.number ?? ""}`.trim(), detail: firstLine(p.issue?.title) || null, url: p.issue?.html_url || base.url };
    case "IssueCommentEvent":
      return { ...base, type: "comment", action: `commented on #${p.issue?.number ?? ""}`.trim(), detail: firstLine(p.issue?.title) || null, url: p.comment?.html_url || base.url };
    case "PullRequestReviewEvent":
      return { ...base, type: "review", action: "reviewed a pull request", detail: firstLine(p.pull_request?.title) || null, url: p.pull_request?.html_url || base.url };
    case "ReleaseEvent":
      return { ...base, type: "release", action: `released ${p.release?.tag_name || "a version"}`, url: p.release?.html_url || base.url };
    case "WatchEvent":
      return { ...base, type: "star", action: "starred" };
    case "ForkEvent":
      return { ...base, type: "fork", action: "forked" };
    default:
      return null;
  }
}

function pushAction({ commits, pushes, branch }) {
  const where = branch ? ` to ${branch}` : "";
  if (commits != null) return `pushed ${commits} commit${commits === 1 ? "" : "s"}${where}`;
  return pushes > 1 ? `pushed ${pushes} times${where}` : `pushed${where}`;
}

/* Raw events (newest first) */
export function summarizeEvents(rawEvents, max = 8) {
  const grouped = [];
  for (const item of rawEvents.map(describeEvent).filter(Boolean)) {
    const same =
      item.type === "push" &&
      grouped.find((g) => g.type === "push" && g.repo === item.repo && g.branch === item.branch && g.at.slice(0, 10) === item.at.slice(0, 10));
    if (same) {
      same.pushes += 1;
      same.commits = same.commits != null && item.commits != null ? same.commits + item.commits : null;
    } else {
      grouped.push(item);
    }
  }
  return grouped.slice(0, max).map((item) => ({ ...item, action: item.type === "push" ? pushAction(item) : item.action }));
}

export async function addCommitMessages(items, getJson, max = 5) {
  const targets = items.filter((i) => i.type === "push" && !i.detail && i.head).slice(0, max);
  await Promise.allSettled(
    targets.map(async (item) => {
      const commit = await getJson(`/repos/${item.repo}/commits/${item.head}`);
      item.detail = firstLine(commit?.commit?.message) || null;
    }),
  );
  return items;
}

/* contribution calendar */
export function summarizeCalendar(days) {
  let longest = 0;
  let run = 0;
  let activeDays = 0;
  let total = 0;
  let busiestDay = { date: "", count: 0 };
  const months = new Map();

  for (const [date, count] of days) {
    total += count;
    if (count > 0) activeDays++;
    run = count > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
    if (count > busiestDay.count) busiestDay = { date, count };
    const key = date.slice(0, 7);
    months.set(key, (months.get(key) || 0) + count);
  }

  // Today may not have contributions yet, so it must not break a live streak.
  let i = days.length - 1;
  if (i >= 0 && days[i][1] === 0) i--;
  let current = 0;
  for (; i >= 0 && days[i][1] > 0; i--) current++;

  return {
    total,
    activeDays,
    currentStreak: current,
    longestStreak: longest,
    busiestDay,
    months: [...months].map(([key, sum]) => ({ key, total: sum })),
  };
}
