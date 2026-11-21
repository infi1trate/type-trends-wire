// N1 · who acts in the newsroom. The desks are the agent sessions of the roadmap (none is switched on in N1); `owner` is the person
// holding the editor key. The pipeline names (engine and the three writers) appear in the state history and the log, never as callers.
export const DESKS = ["editor in chief", "copy desk", "standards", "news", "data", "graphics", "design review", "engineering", "publisher", "scout"] as const;
export type Desk = (typeof DESKS)[number];
export const OWNER = "owner" as const;
/** Who may call the door: one of the desks, or the owner. */
export const ACTORS = [...DESKS, OWNER] as const;
export type Actor = (typeof ACTORS)[number];
export const isActor = (x: unknown): x is Actor => typeof x === "string" && (ACTORS as readonly string[]).includes(x);
/** Names the pipeline records under (story states, desk history). */
export const PIPELINE = ["engine", "story writer", "study writer", "digest writer", "editor"] as const;
export type PipelineActor = (typeof PIPELINE)[number];
