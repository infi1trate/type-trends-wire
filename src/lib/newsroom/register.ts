// N1 · THE DOOR'S REGISTER: every action a desk can take through POST /api/public/desk, with its level of autonomy, in one place.
//   ships alone       content inside existing formats (the tape, stories, the Digest, corrections), data label and bug fixes: it runs.
//   ships to preview  anything that changes how a page looks or adds a format: recorded as a proposal, nothing live changes.
//   needs the owner   navigation and sections, brand and voice, new outside sources, deleting or rewriting stored data, spend over the
//                     cap, secrets, outbound posts: refused unless the actor is `owner` and the call carries the confirmation phrase.
// The phrase guards against an agent's mistake; it is not a security boundary (there is one editor key). Pure.
export const LEVELS = ["ships alone", "ships to preview", "needs the owner"] as const;
export type Level = (typeof LEVELS)[number];
export type SubjectKind = "story" | "study" | "pitch" | "edition" | "setting" | "switch" | "spend" | "week" | "none";
export type ActionDef = {
  id: string; level: Level; what: string;
  /** Reads change nothing (logged as "read"). */
  read: boolean;
  /** Costs money (a model call or build credits): refused while the weekly cap is reached. */
  costs: boolean;
  subject: SubjectKind;
  /** Since which phase the action exists (for the docs). */
  since: string;
};
const A = (id: string, level: Level, subject: SubjectKind, what: string, o: { read?: boolean; costs?: boolean; since: string }): ActionDef =>
  ({ id, level, what, read: o.read ?? false, costs: o.costs ?? false, subject, since: o.since });
export const REGISTER: readonly ActionDef[] = [
  A("check", "ships alone", "none", "Checks the editor key. Changes nothing.", { read: true, since: "E2a" }),
  A("staff", "ships alone", "none", "Loads a staff page's data (status, launch, welcome).", { read: true, since: "U3" }),
  A("queue", "ships alone", "story", "The story queue for the last seven days or one day, with scores, reasons, edits and each story's state history.", { read: true, since: "E2a" }),
  A("memory", "ships alone", "none", "Everything a desk session needs at its start, in one response: style and beats, this register, the board, 14 days of the desk log, today's queue with states, spend, golden scores, the design dry run and health.", { read: true, since: "N1" }),
  A("newsroom", "ships alone", "none", "The desk page's newsroom data: the desk log (optionally one desk), spend against the cap, this register, the board and the golden scores.", { read: true, since: "N1" }),
  A("pin", "ships alone", "story", "Holds a story in the lead until a time (at most seven days). Pinning a held story runs it.", { since: "E2a" }),
  A("kill", "ships alone", "story", "Takes a story down with a reason; its own page says it was taken down and why.", { since: "E2a" }),
  A("correct", "ships alone", "story", "Corrects a story's headline, deck or why line; the story shows “Corrected <date>”.", { since: "E2a" }),
  A("restore", "ships alone", "story", "Restores a killed story, or runs a held one anyway. A story waiting for review runs only when the editor in chief places it after standards passed it (or the owner runs it); a story standards held is released only by the editor in chief or the owner.", { since: "E2a" }),
  A("pitch", "ships alone", "pitch", "Asks the engine about a row; the engine's verdict is recorded. A pitch never publishes.", { since: "U4" }),
  A("assign", "ships alone", "pitch", "Puts a pitch on the board with the desk that holds it and its status.", { since: "N1" }),
  A("spend", "ships alone", "spend", "Records build spend in Lovable credits, with what it was for (the product cannot read its own build costs).", { since: "N1" }),
  A("hold", "ships alone", "story", "Puts a published or reviewed story back to held with a reason; its page says it is held and why in one line, and the desk shows the reason.", { since: "N2" }),
  A("copy_sweep", "ships alone", "none", "The copy desk's weekly sweep: records each page's reader-facing lines that fail the copy lints, with the page and the line. It fixes nothing.", { since: "N2" }),
  A("note", "ships alone", "none", "Leaves a dated note on a story, a study, a brand or a signal for the other desks. Shown on the desk and in the memory; never on a reader's page.", { since: "N2" }),
  A("propose", "ships to preview", "setting", "Proposes something that changes how a page looks or adds a format (a chart type, a study series, a layout, a signal, a design edition). Recorded; nothing live changes.", { since: "N1" }),
  A("living_approve", "needs the owner", "edition", "Approves a proposed design edition after the gate. Going live still means shipping its values in code.", { since: "L1" }),
  A("living_rollback", "needs the owner", "edition", "Rolls an approved or live design edition back to the previous edition's values exactly.", { since: "L1" }),
  A("wire_only", "needs the owner", "switch", "Turns “wire only” on or off: stories leave the front page; the tape, brands, signals, studies and the Digest stay as they are.", { since: "N1" }),
  A("spend_cap", "needs the owner", "spend", "Sets or clears the weekly cap (model dollars, build credits).", { since: "N1" }),
  A("proposal_status", "needs the owner", "setting", "Sets a proposal's status: open, accepted or declined. Accepting records the owner's yes; the change itself still ships to preview.", { since: "N2" }),
];
export const actionDef = (id: string): ActionDef | null => REGISTER.find(a => a.id === id) ?? null;
/** The phrase a `needs the owner` call must carry in `confirm`. */
export const confirmPhrase = (action: string) => `owner confirms ${action}`;
