// The page a gallery or collection shows when its stored captures couldn't be read: the Patterns shell (not the Digest's), what happened
// in the house voice (lib/voice.ts), and one Raised "Try again" that re-runs the read (a plain link to the same address without JavaScript).
import { say, type VoiceId } from "@/lib/voice";
import { DigestShell } from "@/components/digest/Editorial";
import { StateSteps } from "./StateSteps";

export function GalleryUnavailable({ v }: { v: VoiceId }) {
  const s = say(v);
  return <DigestShell label="Patterns" section="patterns">
    <section className="ed-wrap py-16 md:py-20" data-unavailable="" data-state={s.kind}>
      <p className="ed-kicker">Patterns</p>
      <h1 className="ed-cover mt-3" role="alert">{s.title}</h1>
      <p className="ed-standfirst mt-5 max-w-[60ch]">{s.text}</p>
      <StateSteps steps={s.next} className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4 ed-data" />
    </section>
  </DigestShell>;
}
