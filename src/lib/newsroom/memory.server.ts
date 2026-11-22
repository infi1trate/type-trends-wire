// N1 · loads the newsroom memory: the repo's newsroom files, the action register, the board, 14 days of the desk history, today's
// queue with each story's states, spend against the cap, golden scores, the design dry run and health. Called only by the desk
// endpoint after the editor key; reads only.
import style from "../../../newsroom/style.md?raw";
import beats from "../../../newsroom/beats.md?raw";
import readme from "../../../newsroom/README.md?raw";
import { ACTORS, DESKS, OWNER, PIPELINE } from "./desks";
import { LEVELS, REGISTER, confirmPhrase } from "./register";
import { MEMORY_LOG_DAYS, fitMemory, slimQueueItem } from "./memory";
import { STORY_STATES } from "./states";

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];
export const registerView = () => ({
  levels: LEVELS, actors: ACTORS, desks: DESKS, owner: OWNER, pipeline: PIPELINE,
  confirm: `A needs-the-owner call carries "confirm": "${confirmPhrase("<action>")}" with the action's id.`,
  actions: REGISTER.map(a => ({ ...a, ...(a.level === "needs the owner" ? { confirm: confirmPhrase(a.id) } : {}) })),
});
export async function goldenView() {
  const [{ scoreSet }, set, { VERSIONS, currentVersion, WRITERS, DESK_PROMPTS, DESK_VERSIONS, currentDeskVersion, deskPromptHash }, { GOLDEN_CASES, SKIPPED }] = await Promise.all([
    import("./golden/score"), import("./golden/__fixtures__/writing-set.json").then(m => m.default as unknown as import("./golden/score").WritingSet),
    import("./golden/versions"), import("../stories/golden/skipped"),
  ]);
  const s = scoreSet(set);
  return {
    calls: { cases: GOLDEN_CASES, skipped: Object.entries(SKIPPED).map(([name, why]) => ({ name, why })) },
    writing_set: { frozen_at: set.frozen_at, mean: s.mean, passed: s.passed, total: s.total, items: s.items.map(i => ({ number: i.number, id: i.id, score: i.score, failures: i.failures })) },
    versions: WRITERS.map(w => ({ writer: w, current: currentVersion(w)?.version ?? null, recorded: VERSIONS.filter(v => v.writer === w).map(v => ({ version: v.version, prompt_hash: v.prompt_hash, template: v.template, models: v.models, score_file: v.score_file, note: v.note })) })),
    // N2 · the desks' prompts under the same rule: the recorded versions and whether the live prompt matches one.
    desks: DESK_PROMPTS.map(d => ({ desk: d, current: currentDeskVersion(d)?.version ?? null, prompt_hash: deskPromptHash(d), recorded: DESK_VERSIONS.filter(v => v.desk === d).map(v => ({ version: v.version, prompt_hash: v.prompt_hash, score_file: v.score_file, note: v.note })) })),
  };
}
export async function loadMemory(db: Admin) {
  const [{ loadBoard, loadHistory, spendStatus, statesFor, wireOnlyOn, loadNotes, loadProposals, deskCaps, reviewsFor }, { loadQueue }, { healthPayload }, { loadColophon }, { capLine, capReached, spendSplit }] = await Promise.all([
    import("./newsroom.server"), import("../stories/page.server"), import("../health.server"), import("../living/living.server"), import("./spend"),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const [board, log, q, spend, golden, health, colophon, wireOnly] = await Promise.all([
    loadBoard(db).catch(() => null), loadHistory(db, { days: MEMORY_LOG_DAYS, limit: 1000 }), loadQueue(today, true), spendStatus(db).catch(() => null),
    goldenView(), healthPayload().catch(() => null), loadColophon().catch(() => null), wireOnlyOn(),
  ]);
  const items = [...q.published, ...q.held, ...q.killed] as unknown as Record<string, unknown>[];
  const ids = items.map(i => String(i["id"]));
  const [states, notes, proposals, caps, reviews, n3] = await Promise.all([statesFor(db, ids).catch(() => new Map()), loadNotes(db).catch(() => []), loadProposals(db).catch(() => []), deskCaps(db).catch(() => null), reviewsFor(db, ids).catch(() => new Map()),
    import("./panels.server").then(m => m.n3Panels(db)).catch(() => null)]);
  return fitMemory({
    read_at: new Date().toISOString(),
    files: { "newsroom/README.md": readme, "newsroom/style.md": style, "newsroom/beats.md": beats },
    register: registerView(), story_states: STORY_STATES,
    switches: { wire_only: wireOnly },
    board,
    queue: { day: today, items: items.map(i => ({ ...slimQueueItem(i), states: states.get(String(i["id"])) ?? [], review: reviews.get(String(i["id"])) ?? null })) },
    // N2 · the desks' caps today, their notes (14 days) and the proposals with the owner's status.
    desks: caps, notes, proposals,
    // N3 · the news, graphics and data desks: the same facts /desk shows (picks, drops, picture changes, share failures, findings,
    // backtest, proposals, calls against limits, and which log rows are tests).
    newsroom_desks: n3,
    spend: spend ? { ...spend, split: spendSplit(spend), reached: capReached(spend), line: capLine(spend) } : null,
    golden,
    design: colophon ? { live_edition: colophon.live, editions: colophon.editions.map(e => ({ number: e.number, dated: e.dated, status: e.statuses[e.statuses.length - 1]?.status ?? null, moves: e.moves.length })), dry_run: colophon.dry } : null,
    health,
    log,
  });
}
