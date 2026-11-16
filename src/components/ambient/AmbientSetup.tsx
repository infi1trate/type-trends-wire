import { line as voiced } from "@/lib/voice";
// /ambient/setup (Steady): the three URL settings as a small form that opens the board, kiosk mode in plain words, and whether this
// browser can keep the screen awake (checked in the browser, after hydration).
import { useEffect, useState } from "react";
import { DigestShell } from "@/components/digest/Editorial";
import { RuleBox, Raised } from "@/components/brand/Containers";
import { DWELL, SCENE_IDS, SCENE_NAME } from "@/lib/ambient/playlist";
import { wakeLockSupported } from "@/lib/ambient/board";
import { LENS_SECTORS } from "@/lib/sector-lens";
import { sectorName } from "@/lib/labels";

export function AmbientSetup() {
  const [wake, setWake] = useState<boolean | null>(null);
  useEffect(() => { setWake(wakeLockSupported(navigator as never)); }, []);
  return <DigestShell label="Studio board" section="live">
    <header className="ed-wrap pt-8 md:pt-12">
      <p className="ed-kicker">Live · studio board</p>
      <h1 className="ed-h1 mt-3">Put slug on the wall</h1>
      <p className="ed-standfirst mt-5 max-w-[62ch]">The board plays one scene at a time on a screen across the room and keeps itself current. Nobody needs to touch it. Choose how it runs below, then open it on the screen you want to use.</p>
    </header>
    <section aria-labelledby="setup-form" className="ed-wrap mt-10">
      <RuleBox className="p-5">
        <h2 id="setup-form" className="ed-h3">How it runs</h2>
        <form method="get" action="/ambient" className="mt-4 grid gap-6">
          <div className="grid gap-2"><label htmlFor="amb-dwell" className="ed-data">Seconds per scene ({DWELL.min} to {DWELL.max})</label>
            <input id="amb-dwell" name="dwell" type="number" min={DWELL.min} max={DWELL.max} defaultValue={DWELL.default} aria-describedby="amb-dwell-note" className="ed-data form-field min-h-[44px] w-32 bg-transparent px-3" />
            <p id="amb-dwell-note" className="ed-caption">Shown in the address as <code>?dwell=</code>. Anything outside the range is set to the nearest end.</p></div>
          <div className="grid gap-2"><label htmlFor="amb-sector" className="ed-data">Sector that leads</label>
            <select id="amb-sector" name="sector" defaultValue="all" aria-describedby="amb-sector-note" className="ed-data form-field min-h-[44px] w-64 bg-transparent px-3">{LENS_SECTORS.map(s => <option key={s} value={s}>{sectorName(s)}</option>)}</select>
            <p id="amb-sector-note" className="ed-caption">Shown as <code>?sector=</code>. Its stories come first; everything else still plays.</p></div>
          <fieldset className="grid gap-2"><legend className="ed-data">Scenes to play</legend>
            <p className="ed-caption" id="amb-scenes-note">Shown as <code>?scenes=</code>, a comma list in the order you want. A scene with nothing to show is skipped.</p>
            <ul className="grid gap-1 sm:grid-cols-2">{SCENE_IDS.map(id => <li key={id}><label className="inline-flex min-h-11 items-center gap-3"><input type="checkbox" name="scenes" value={id} defaultChecked aria-describedby="amb-scenes-note" className="h-5 w-5" />{SCENE_NAME[id]} <code className="ed-caption">{id}</code></label></li>)}</ul>
          </fieldset>
          <div><Raised type="submit">Open the board</Raised></div>
        </form>
      </RuleBox>
    </section>
    <section aria-labelledby="setup-keys" className="ed-wrap mt-10 max-w-[68ch]">
      <h2 id="setup-keys" className="ed-h3">When someone walks up</h2>
      <ul className="ed-body mt-3 list-disc pl-6">
        <li><kbd>Space</kbd> pauses and resumes. The arrow keys step back and forward.</li>
        <li><kbd>F</kbd> fills the screen. <kbd>Esc</kbd> leaves full screen, and pressed again goes to the front page.</li>
        <li>On a touch screen, a tap shows a small bar (pause, previous, next, full screen) for five seconds.</li>
        <li>The pointer hides after three seconds without moving.</li>
      </ul>
    </section>
    <section aria-labelledby="setup-kiosk" className="ed-wrap mt-10 max-w-[68ch]">
      <h2 id="setup-kiosk" className="ed-h3">Kiosk mode, in plain words</h2>
      <p className="ed-body mt-3">Kiosk mode is a way to start a browser so it opens one page full screen with no address bar or tabs, and stays there. Most browsers have it. In Chrome or Edge on the computer behind the screen, start the browser with the kiosk option and this board's address. On a smart TV or a streaming stick, open the address in its browser and press <kbd>F</kbd>. Sign in through the password page once on that screen; the board remembers it for 30 days.</p>
      <p className="ed-body mt-3">The board checks for new stories every minute and changes scene by itself. If the network drops it keeps showing what it has, marks the time it last heard (“as of 14:02 UTC”) and turns the red dot hollow until it hears again.</p>
    </section>
    <section aria-labelledby="setup-wake" className="ed-wrap mt-10 max-w-[68ch]">
      <h2 id="setup-wake" className="ed-h3">Keeping the screen awake</h2>
      <p className="ed-body mt-3" data-wake-lock={wake === null ? "unknown" : wake ? "yes" : "no"}>{wake === null ? voiced("ambient.wakeLock.checking") : wake ? "This browser can keep the screen awake: the board asks it to while it plays, and lets go when you leave." : "This browser can't keep the screen awake for a page. Set the screen's own sleep or power saving to never, or use a browser that can (recent Chrome, Edge and Safari can)."}</p>
      <p className="ed-body mt-3">To spare the panel, the whole board shifts by a few pixels at every scene and the mark swaps corner, so nothing bright sits in one place for long.</p>
    </section>
    <div className="pb-16" />
  </DigestShell>;
}
