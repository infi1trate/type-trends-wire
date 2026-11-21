// N1 · desk log row shapes (pure types, shared by the server and the desk page).
import type { Level, SubjectKind } from "./register";
export type LogRow = { actor: string; action: string; level: Level | null; subject_kind: SubjectKind | null; subject_id: string | null; decision: "done" | "proposed" | "refused" | "read" | "failed"; reason: string | null; edit_id?: number | null; detail?: Record<string, unknown> };
export type HistoryRow = { ref: string; at: string; actor: string; action: string; level: string | null; subject_kind: string | null; subject_id: string | null; decision: string; reason: string | null; source: "desk_log" | "story_edits" };
