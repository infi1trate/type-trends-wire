import { BRAND_NAME } from "@/lib/brand";
import { say, type VoiceId } from "@/lib/voice";
import { StateSteps } from "@/components/read/StateSteps";
import { DigestShell } from "./Editorial";
import type { SectionId } from "@/lib/ia";
/** A Read page's not-found, failed or empty state, in the words of lib/voice.ts. */
export function DigestNotFound({ v, vars, kicker = BRAND_NAME, section, bare = false }: { v: VoiceId; vars?: Record<string, string | number>; kicker?: string; section?: SectionId; bare?: boolean }) {
  const s = say(v, vars);
  // `bare`: inside a page frame already drawn (a streamed slot), the state alone.
  const body = <section className="ed-wrap py-16 md:py-20" data-state={s.kind}>
      <p className="ed-kicker">{kicker}</p>
      <h1 className="ed-cover mt-3" {...(s.kind === "failed" ? { role: "alert" } : {})}>{s.title}</h1>
      <p className="ed-standfirst mt-5 max-w-[60ch]">{s.text}</p>
      <StateSteps steps={s.next} />
    </section>;
  return bare ? body : <DigestShell label={s.kind === "failed" ? "Didn't load" : s.kind === "notFound" ? "Not found" : "Empty"} {...(section ? { section } : {})}>{body}</DigestShell>;
}
