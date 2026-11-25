// slug watchdog: turns failures into GitHub issues and closes them on recovery.
// Two modes (WATCH_MODE):
//   health   — poll the terminal's public /api/public/health; one open issue labelled `health` while it's not ok.
//   workflow — called from workflow_run: one open issue per failing workflow (label `workflow-failure`), closed on success.
// Env: GITHUB_TOKEN, GITHUB_REPOSITORY, HEALTH_URL (health mode), RUN_NAME, RUN_CONCLUSION, RUN_URL (workflow mode),
//      DRY_RUN=1 (print the action instead of calling GitHub).
const API = "https://api.github.com";
const REPO = process.env.GITHUB_REPOSITORY;
const TOKEN = process.env.GITHUB_TOKEN;
const DRY = process.env.DRY_RUN === "1";

export const HEALTH_TITLE = "slug health check failing";
export const workflowTitle = (name) => `Workflow failing: ${name}`;

/** Pure: health payload (or fetch failure) → {state:'ok'|'alert'|'skip', body?}. */
export function healthVerdict(httpStatus, payload, checkedAt = new Date().toISOString()) {
  if (httpStatus === 404) return { state: "skip", reason: "health endpoint not deployed yet" };
  if (httpStatus !== 200 || !payload || typeof payload.status !== "string") {
    return { state: "alert", status: "unreachable", body: `The health endpoint did not answer (HTTP ${httpStatus || "network error"}) at ${checkedAt}.` };
  }
  if (payload.status === "ok") return { state: "ok", status: "ok" };
  const bad = (payload.jobs ?? []).filter((j) => j.stale || j.last_status === "error" || (j.consecutive_failures ?? 0) > 0);
  // A server that has just woken answers "starting" before it has looked at any job. That is no news either way:
  // ask again in a moment, and if it is still waking, leave the issue as it is.
  if (payload.status === "starting" && !bad.length) return { state: "wait", status: "starting" };
  const rows = bad.map((j) => `| ${j.job} | ${j.last_status ?? "—"} | ${j.last_ok_at ?? "never"} | ${j.expected_every ?? "—"} | ${j.consecutive_failures ?? 0} | ${(j.note ?? "").replace(/\|/g, "/")} |`);
  const body = [
    `Overall: **${payload.status.toUpperCase()}** (checked ${payload.checked_at ?? checkedAt})`,
    "",
    "| job | last status | last ok | expected | failures | note |",
    "|---|---|---|---|---|---|",
    ...(rows.length ? rows : ["| (no job flagged) | | | | | |"]),
    "",
    "This issue closes itself when the health check is ok again.",
  ].join("\n");
  return { state: "alert", status: payload.status, body };
}

/** Pure: GitHub itself being briefly unavailable. Asked again for reads and edits; never a reason to email anyone. */
export const githubBusy = (status) => status === 0 || status >= 500;
export class GithubBusy extends Error {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gh(path, init = {}) {
  if (DRY) { console.log("DRY", init.method ?? "GET", path, init.body ? JSON.parse(init.body).title ?? "" : ""); return init.method ? {} : []; }
  const method = init.method ?? "GET", again = method === "GET" || method === "PATCH" ? 3 : 1; // a repeated POST could open two issues
  for (let attempt = 1; ; attempt++) {
    let status = 0, text = "";
    try {
      const r = await fetch(`${API}${path}`, { ...init, headers: { authorization: `Bearer ${TOKEN}`, accept: "application/vnd.github+json", "content-type": "application/json", ...(init.headers ?? {}) }, signal: AbortSignal.timeout(20000) });
      if (r.ok) return r.status === 204 ? {} : r.json();
      status = r.status; text = (await r.text()).slice(0, 200);
    } catch (e) { text = String(e?.message ?? e).slice(0, 200); }
    if (githubBusy(status) && attempt < again) { await sleep(4000 * attempt * attempt); continue; }
    throw new (githubBusy(status) ? GithubBusy : Error)(`GitHub ${method} ${path} → ${status || "network error"}: ${text}`);
  }
}

async function findOpen(label, title) {
  const issues = await gh(`/repos/${REPO}/issues?state=open&labels=${encodeURIComponent(label)}&per_page=50`);
  return issues.find((i) => i.title === title && !i.pull_request) ?? null;
}

/** Open (or comment on) the issue for `title`; close it with a note when recovered. */
export async function reconcile({ label, title, failing, body }) {
  const open = await findOpen(label, title);
  if (failing && !open) { await gh(`/repos/${REPO}/issues`, { method: "POST", body: JSON.stringify({ title, body, labels: [label] }) }); return "opened"; }
  if (failing && open) {
    // Comment only when the content changed, so an hourly poll doesn't spam the thread.
    if ((open.body ?? "").trim() !== body.trim()) {
      await gh(`/repos/${REPO}/issues/${open.number}`, { method: "PATCH", body: JSON.stringify({ body }) });
      await gh(`/repos/${REPO}/issues/${open.number}/comments`, { method: "POST", body: JSON.stringify({ body: "Still failing — details updated above." }) });
      return "updated";
    }
    return "unchanged";
  }
  if (!failing && open) {
    await gh(`/repos/${REPO}/issues/${open.number}/comments`, { method: "POST", body: JSON.stringify({ body: `Recovered at ${new Date().toISOString()}.` }) });
    await gh(`/repos/${REPO}/issues/${open.number}`, { method: "PATCH", body: JSON.stringify({ state: "closed", state_reason: "completed" }) });
    return "closed";
  }
  return "nothing";
}

async function main() {
  if (!DRY && (!REPO || !TOKEN)) throw new Error("Set GITHUB_TOKEN and GITHUB_REPOSITORY");
  const mode = process.env.WATCH_MODE ?? "health";
  if (mode === "health") {
    let v;
    for (let attempt = 1; attempt <= 4; attempt++) {
      let status = 0, payload = null;
      try {
        const r = await fetch(process.env.HEALTH_URL ?? "https://slug.global/api/public/health", { signal: AbortSignal.timeout(20000) });
        status = r.status; payload = r.ok ? await r.json().catch(() => null) : null;
      } catch { status = 0; }
      v = healthVerdict(status, payload);
      // One slow answer or a waking server is not a failure: ask again before saying anything.
      if (!(v.state === "wait" || v.status === "unreachable") || attempt === 4 || DRY) break;
      await sleep(20000);
    }
    if (v.state === "skip") { console.log(v.reason); return; }
    if (v.state === "wait") { console.log("health: the server is still starting after four tries; the issue is left as it is"); return; }
    console.log(`health: ${v.status} →`, await reconcile({ label: "health", title: HEALTH_TITLE, failing: v.state === "alert", body: v.body ?? "" }));
    return;
  }
  const name = process.env.RUN_NAME, conclusion = process.env.RUN_CONCLUSION, url = process.env.RUN_URL;
  if (!name || !conclusion) throw new Error("Set RUN_NAME and RUN_CONCLUSION");
  if (["cancelled", "skipped", "neutral"].includes(conclusion)) { console.log(`${name}: ${conclusion}, ignored`); return; }
  const failing = conclusion !== "success";
  const body = `The **${name}** workflow finished with \`${conclusion}\`.\n\nRun: ${url ?? "(no link)"}\n\nThis issue closes itself when the next run of ${name} succeeds.`;
  console.log(`${name}: ${conclusion} →`, await reconcile({ label: "workflow-failure", title: workflowTitle(name), failing, body }));
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => {
  // GitHub's own API being down is not something this repo can fix, and the next run reconciles the issues.
  if (e instanceof GithubBusy) { console.log(`::warning title=GitHub was busy::${e.message.slice(0, 200)}`); process.exit(0); }
  console.error(e); process.exit(1);
});
