// Writer pass · the I/O (rules in writer-pass.ts). Reads the writer's queue (cheap print first: an empty queue is cached against it), takes
// the first story only, loads the build's input for its fact sheet (bases and continuity lines, as the build gives them) and writes it
// with the writer's normal checks, ledger and daily allowance, at most PASS_CALLS_MAX writer calls. A start and finish row in job_runs
// for every pass that had a story to write or stood down; none when the queue is empty. Service role only. Never throws.
import * as wp from "./writer-pass";
import type { FactStory } from "./writer-facts";
import type { WriteJob, WriterIO, WriteResult } from "./writer.server";

type Admin = import("@supabase/supabase-js").SupabaseClient;
export type WriterPassDeps = {
  print: () => Promise<wp.QueuePrint>;
  queue: () => Promise<FactStory[]>;
  guards: () => Promise<{ held: boolean; safeMode: boolean; buildRunning: boolean; passRunning: boolean; lastNoRoomAgoMs: number | null }>;
  /** The heavy part: the build's input, then the jobs for these stories. */
  jobs: (stories: FactStory[]) => Promise<{ jobs: WriteJob[]; known: import("./writer").Known }>;
  write: (jobs: WriteJob[], known: import("./writer").Known, o: { deadline: number; perBuild: number }) => Promise<Pick<WriteResult, "written" | "checked" | "calls" | "skipped" | "rows">>;
  start: (story: string) => Promise<{ finish: (ok: boolean, note: string, detail?: unknown) => Promise<void> }>;
};
export type WriterPassResult = { ran: boolean; note: string; story: string | null; calls: number };

let emptyCache: { print: wp.QueuePrint; at: number } | null = null;
export const resetWriterPassCache = () => { emptyCache = null; };

export async function runWriterPassWith(deps: WriterPassDeps, t0: number, now: () => number = Date.now): Promise<WriterPassResult> {
  const out: WriterPassResult = { ran: false, note: "queue empty", story: null, calls: 0 };
  try {
    const print = await deps.print();
    if (wp.emptyStillGood(emptyCache, print, now())) return out;
    const story = wp.firstOfQueue(await deps.queue());
    if (!story) { emptyCache = { print, at: now() }; return out; }
    emptyCache = null; out.story = story.id;
    const g = await deps.guards(), why = wp.passStandDown(g);
    const run = await deps.start(story.id);
    if (why) { out.note = wp.passNote({ skipped: why }); await run.finish(true, out.note); return out; }
    const end = wp.writeEnd(t0);
    if (wp.passCalls(end - now()) === 0) { out.note = wp.passNote({ skipped: "no time left in this pass" }); await run.finish(true, out.note); return out; }
    const { jobs, known } = await deps.jobs([story]);
    const perBuild = wp.passCalls(end - now());
    if (!perBuild || !jobs.length) { out.note = wp.passNote({ skipped: jobs.length ? wp.NO_ROOM : "no fact sheet" }); await run.finish(true, out.note); return out; }
    const r = await deps.write(jobs.slice(0, 1), known, { deadline: end, perBuild });
    out.ran = true; out.calls = r.calls;
    out.note = r.calls ? wp.passNote({ written: r.written, checked: r.checked, calls: r.calls }) : wp.passNote({ skipped: r.skipped ? "the writer skipped it (allowance or time)" : "no call made" });
    await run.finish(true, out.note, { story: story.id, texts: { written: r.written, checked: r.checked, calls: r.calls, skipped: r.skipped }, failures: r.rows.flatMap(x => x.failures).slice(0, 8) });
  } catch (e) { out.note = `writer pass · failed: ${e instanceof Error ? e.message.slice(0, 80) : "error"}`; console.error(out.note); }
  return out;
}

const newest = async (db: Admin, table: string, col = "id"): Promise<string> => {
  const { data, error } = await db.from(table).select(col).order(col, { ascending: false }).limit(1);
  if (error) throw new Error(`${table}_print_failed`);
  return String((data?.[0] as Record<string, unknown> | undefined)?.[col] ?? "");
};

export function writerPassDeps(db: Admin): WriterPassDeps {
  return {
    print: async () => {
      const [edits, asks, texts, stories] = await Promise.all([newest(db, "story_edits"), newest(db, "rewrite_requests"), newest(db, "story_texts", "created_at"), newest(db, "stories", "created_at")]);
      return { edits: Number(edits) || 0, asks: Number(asks) || 0, texts: Date.parse(texts) || 0, stories, day: new Date().toISOString().slice(0, 10) };
    },
    queue: async () => {
      const [{ storiesToWrite }, { writerIO }, { AI_MODELS }] = await Promise.all([import("./build.server"), import("./writer.server"), import("../ai-models")]);
      return storiesToWrite(db as never, [], 1, writerIO(db as never).runs(AI_MODELS.writer));
    },
    guards: async () => {
      const [{ isHeld }, { safeModeOn }, runs] = await Promise.all([import("../newsroom/passes.server"), import("../safe-mode.server"), import("../jobs/runs")]);
      const since = new Date(Date.now() - Math.max(runs.BUILD_ONE_AT_A_TIME_MS, wp.NO_ROOM_BACKOFF_MS)).toISOString();
      const { data, error } = await db.from("job_runs").select("id,at,job,phase,start_id,note").in("job", ["story-build", "writer-pass"]).gte("at", since).order("id", { ascending: false }).limit(200);
      // job_runs cannot be read: stand down (as the build does).
      if (error) return { held: false, safeMode: false, buildRunning: true, passRunning: false, lastNoRoomAgoMs: null };
      const rows = (data ?? []) as { id: number; at: string; job: string; phase: string; start_id: number | null; note: string | null }[];
      const done = new Set(rows.filter(r => r.phase === "finish").map(r => r.start_id));
      const openWithin = (job: string, ms: number) => rows.some(r => r.job === job && r.phase === "start" && !done.has(r.id) && Date.now() - Date.parse(r.at) < ms);
      const noRoom = rows.find(r => r.job === "writer-pass" && r.phase === "finish" && (r.note ?? "").includes(wp.NO_ROOM));
      const [held, safe] = await Promise.all([isHeld(db as never, "stories"), safeModeOn().then(x => x.on).catch(() => false)]);
      return { held, safeMode: safe, buildRunning: openWithin("story-build", runs.BUILD_ONE_AT_A_TIME_MS), passRunning: openWithin("writer-pass", wp.PASS_STALE_MS), lastNoRoomAgoMs: noRoom ? Date.now() - Date.parse(noRoom.at) : null };
    },
    jobs: async stories => {
      const b = await import("./build.server"), { allCandidates } = await import("./candidates"), { confirmedInput } = await import("./editor");
      const deps = b.dbDeps(db as never, true);
      const input = confirmedInput(await deps.load({ days: b.BUILD_DAYS, allRuns: false, realRunIds: [] })).input;
      const { ctx } = allCandidates(input);
      const { jobs, src } = await b.writerJobs(stories, input, ctx, deps);
      return { jobs, known: { names: src.known } as never };
    },
    write: async (jobs, known, o) => {
      const { writeStories, writerIO } = await import("./writer.server");
      return writeStories(jobs, writerIO(db as never) as WriterIO, known, o);
    },
    start: async story => (await import("../jobs/runs.server")).startRun("writer-pass", { db: db as never, note: story }),
  };
}

/** The pass inside a host handler that started at `t0`. */
export const runWriterPass = (db: Admin, t0: number) => runWriterPassWith(writerPassDeps(db), t0);
