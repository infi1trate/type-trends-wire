// slug desk carrier: takes one desk action from a workflow run to the site's door (POST /api/public/desk).
// The editor key lives in GitHub's secrets and is read here only; no agent session ever holds it.
// Env: ACTOR (a desk name), BODY (the action as JSON, without the actor), CRAWL_SECRET (the editor key),
//      DESK_URL (default https://slug.global/api/public/desk), DRY_RUN=1 (validate and print, send nothing).
// What it will not carry: the owner's actions, and reads (their answers would land in a public run log).

export const DESKS = ["editor in chief", "copy desk", "standards", "news", "data", "graphics", "design review", "engineering", "publisher", "scout"];
/** Actions a desk may send through this workflow. Reads (queue, memory, newsroom, staff) and owner actions are left out on purpose. */
export const CARRIED = ["check", "pin", "hold", "kill", "correct", "restore", "note", "pitch", "assign", "spend", "propose", "wire_pick", "wire_drop", "picture", "finding", "finding_close", "data_run", "queue_add", "queue_move", "gate_result", "job_hold", "job_release", "audience", "source_note", "candidate_status", "rewrite"];

/** Pure: the request to send, or the reason it is refused here before anything leaves the runner. */
export function prepare(actor, bodyText) {
  const name = String(actor ?? "").trim().toLowerCase();
  if (!DESKS.includes(name)) return { error: `"${actor}" is not a desk (the owner acts from the desk page, not from here)` };
  let body;
  try { body = JSON.parse(bodyText); } catch { return { error: "the body is not JSON" }; }
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "the body must be one JSON object" };
  if (!CARRIED.includes(body.action)) return { error: `"${body.action}" is not carried from here (carried: ${CARRIED.join(", ")})` };
  if (["kill", "hold", "wire_drop", "picture", "finding_close", "job_hold", "job_release", "rewrite"].includes(body.action) && !String(body.reason ?? "").trim()) return { error: `a ${body.action} needs a reason` };
  const { confirm: _confirm, actor: _actor, ...rest } = body; // a confirmation phrase is the owner's alone; the actor comes from the input
  return { send: { ...rest, actor: name } };
}

/** Pure: what may be printed from the door's answer in a public log: the status and its short verdict fields, nothing else. */
export function summary(status, text) {
  let j = null;
  try { j = JSON.parse(text); } catch { /* not JSON */ }
  const pick = {};
  if (j && typeof j === "object") for (const k of ["ok", "error", "decision", "level", "reason", "id", "status"]) if (typeof j[k] !== "object" && j[k] !== undefined) pick[k] = String(j[k]).slice(0, 160);
  return `door answered ${status} ${JSON.stringify(pick)}`;
}

/** Pure: statuses with which the door answers "no" to a well-carried request. Not a failure of the carrier. */
export const isRefusal = (status) => status === 400 || status === 409 || status === 422;

if (import.meta.url === `file://${process.argv[1]}`) {
  const p = prepare(process.env.ACTOR, process.env.BODY ?? "");
  if (p.error) { console.error(`refused here: ${p.error}`); process.exit(2); }
  console.log(`${p.send.actor} → ${p.send.action}${p.send.id ? ` ${p.send.id}` : ""}`);
  if (process.env.DRY_RUN === "1") { console.log("dry run: nothing sent"); process.exit(0); }
  const key = process.env.CRAWL_SECRET;
  if (!key) { console.error("no key in this run"); process.exit(2); }
  const r = await fetch(process.env.DESK_URL ?? "https://slug.global/api/public/desk", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify(p.send) });
  const line = summary(r.status, await r.text());
  console.log(line);
  // 202 is a proposal recorded. A refusal is the door doing its job (an action out of order, an owner-only step, a
  // malformed request): the caller reads it from the line above, and the run ends green so nobody is emailed about it.
  // What still fails the run is the door being unreachable or the key being wrong.
  if (isRefusal(r.status)) console.log(`::notice title=The door said no::${line}`);
  process.exit(r.ok || isRefusal(r.status) ? 0 : 1);
}
