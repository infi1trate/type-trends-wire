// N1 · THE DOOR'S REGISTER: every action a desk can take through POST /api/public/desk, with its level of autonomy, in one place.
//   ships alone       content inside existing formats (the tape, stories, the Digest, corrections), data label and bug fixes: it runs.
//   ships to preview  anything that changes how a page looks or adds a format: recorded as a proposal, nothing live changes.
//   needs the owner   navigation and sections, brand and voice, new outside sources, deleting or rewriting stored data, spend over the
//                     cap, secrets, outbound posts: refused unless the actor is `owner` and the call carries the confirmation phrase.
// The phrase guards against an agent's mistake; it is not a security boundary (there is one editor key). Pure.
export const LEVELS = ["ships alone", "ships to preview", "needs the owner"] as const;
export type Level = (typeof LEVELS)[number];
export type SubjectKind = "story" | "study" | "pitch" | "edition" | "setting" | "switch" | "spend" | "week" | "none" | "wire" | "finding" | "review" | "queue";
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
  A("restore", "ships alone", "story", "Restores a killed story, or runs a held one anyway. A story waiting for review runs only when the editor in chief places it after standards passed it (or the owner runs it); a story standards held is released only by the editor in chief or the owner. N3: when every checklist item passed and only the second reader held it, standards may release it with a reason of at least 20 characters (a pass over its second reader); it then goes to the editor in chief. A checklist failure is released only by the owner.", { since: "E2a" }),
  A("pitch", "ships alone", "pitch", "Asks the engine about a row; the engine's verdict is recorded. A pitch never publishes.", { since: "U4" }),
  A("assign", "ships alone", "pitch", "Puts a pitch on the board with the desk that holds it and its status.", { since: "N1" }),
  A("spend", "ships alone", "spend", "Records build spend in Lovable credits, with what it was for (the product cannot read its own build costs). N4: may name the queue item it was for, so each item shows what it cost.", { since: "N1" }),
  A("hold", "ships alone", "story", "Puts a published or reviewed story back to held with a reason; its page says it is held and why in one line, and the desk shows the reason.", { since: "N2" }),
  A("copy_sweep", "ships alone", "none", "The copy desk's weekly sweep: records each page's reader-facing lines that fail the copy lints, with the page and the line. It fixes nothing.", { since: "N2" }),
  A("note", "ships alone", "none", "Leaves a dated note on a story, a study, a brand or a signal for the other desks. Shown on the desk and in the memory; never on a reader's page.", { since: "N2" }),
  A("wire_pick", "ships alone", "wire", "The news desk picks one outlet item from the wire with its subject (brand, web or type) and one line saying what it reports; at most five picks a day. Shown on the front page's THE WIRE block for 24 hours.", { since: "N3" }),
  A("wire_drop", "ships alone", "wire", "Drops a wire pick with a reason (news, standards or the editor in chief); it leaves the front page and stays in the log.", { since: "N3" }),
  A("picture", "ships alone", "story", "The graphics desk chooses a story's lead picture: a stored crop or before-and-after pair that passes the quality gate, no picture, or back to the rule's choice, with a reason. The caption is rebuilt by rule; no text changes.", { since: "N3" }),
  A("finding", "ships alone", "finding", "The data desk records a finding: wrong or contradictory data, with what was expected, what was found and the receipt. An open finding on a brand and measure holds a story that cites them.", { since: "N3" }),
  A("finding_close", "ships alone", "finding", "Closes a data finding with who and why (data, standards or the editor in chief).", { since: "N3" }),
  A("data_run", "ships alone", "none", "The data desk's daily checks, the weekly forecast backtest, the share-image check, the study chart check or one news desk pass: records what the run found (counts by kind). It fixes nothing.", { since: "N3" }),
  A("review", "ships alone", "review", "One page at one width from a review run (the outside browser job): its measures and an optional small picture, stored as sent; a missing measure is not measured, never zero. A test run is shown as a test and never counts toward budgets, breaches or the gate.", { since: "N4" }),
  A("queue_add", "ships alone", "queue", "Files a product change on the build queue: title, why, kind, what readers should see, its source and a stable key (the same key is not filed twice while open).", { since: "N4" }),
  A("queue_move", "ships alone", "queue", "Moves a queue item along (engineering; the owner may decline): queued, briefed, built, then a gate result, then live; or declined with a reason. Briefed and live for anything but a bug or a label need the owner's accepted proposal; live needs the newest gate result to be a pass.", { since: "N4" }),
  A("gate_result", "ships alone", "queue", "Records a build's gate (engineering): the commit, the test numbers and the before and after review runs. Code works out every check and the verdict; the door takes no verdict.", { since: "N4" }),
  A("job_hold", "ships alone", "none", "Holds a scheduled desk job (share, chart, picks, checks, health, design review, backtest or proposal) until a time at most seven days ahead, with a reason (engineering or the owner). A held job does not start; /desk shows who, why and until when. N5: also `review` (the review passes) and `stories` (the story build's publishing step), so content can be frozen around a gated deploy, and the publisher's and scout's weekly jobs (`package`, `drafts`, `candidates`).", { since: "N4b" }),
  A("job_release", "ships alone", "none", "Releases a held scheduled desk job before its time, with a reason (engineering or the owner).", { since: "N4b" }),
  A("audience", "ships alone", "week", "The week's audience numbers from the host's own analytics (the publisher's outside session, once a week): visitors, pageviews, at most 20 paths and 10 sources, counts only. A later entry for the same week replaces what is shown; the earlier one stays stored.", { since: "N5" }),
  A("source_note", "ships alone", "setting", "Appends a terms reading to a source in the sources register (the scout): status, date read, link, one line. It changes what the register shows and nothing else; reading a new source still needs the owner.", { since: "N5" }),
  A("candidate_status", "ships alone", "setting", "Moves a brand candidate: accepted or declined (the owner only), then added (engineering, once the crawler's seed list carries it, or the owner). Nothing is added to the library by the product.", { since: "N5" }),
  A("rewrite", "ships alone", "story", "Asks the story writer to rewrite a published story at its next allowance, first in its queue (standards, the copy desk or the editor in chief, with a reason). The new text goes through the writer's normal check; nothing is rewritten by hand and the story stays as it is until then.", { since: "L2b" }),
  A("propose", "ships to preview", "setting", "Proposes something that changes how a page looks or adds a format (a chart type, a study series, a layout, a signal, a design edition). Recorded; nothing live changes.", { since: "N1" }),
  A("living_approve", "needs the owner", "edition", "Approves a proposed design edition after the gate. Going live still means shipping its values in code.", { since: "L1" }),
  A("living_rollback", "needs the owner", "edition", "Rolls an approved or live design edition back to the previous edition's values exactly.", { since: "L1" }),
  A("wire_only", "needs the owner", "switch", "Turns “wire only” on or off: stories leave the front page; the tape, brands, signals, studies and the Digest stay as they are.", { since: "N1" }),
  A("spend_cap", "needs the owner", "spend", "Sets or clears the weekly cap (model dollars, build credits).", { since: "N1" }),
  A("draft_status", "needs the owner", "setting", "Sets a social draft's status: approved, posted or declined (from draft: approved or declined; from approved: posted or declined). There is no posting code: outbound posts stay the owner's.", { since: "N5" }),
  A("art_remove", "needs the owner", "setting", "Removes a museum work on request (W3a): the work stops showing everywhere, its stored thumbnail is deleted and the crawler can never store it again. The row keeps the date and the reason (3 to 300 characters).", { since: "W3a" }),
  A("proposal_status", "needs the owner", "setting", "Sets a proposal's status: open, accepted or declined. Accepting records the owner's yes; the change itself still ships to preview.", { since: "N2" }),
];
export const actionDef = (id: string): ActionDef | null => REGISTER.find(a => a.id === id) ?? null;
/** The phrase a `needs the owner` call must carry in `confirm`. */
export const confirmPhrase = (action: string) => `owner confirms ${action}`;
