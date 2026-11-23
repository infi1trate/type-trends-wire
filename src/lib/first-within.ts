// C1 · wait for a read up to a limit, never longer and never failing: a page's first part is sent with the first HTML when it is ready
// in time, and otherwise streams into its slot as before (the read keeps running). Pure.

/** How long the brand page waits for its identity card before sending the first bytes (it is one stored row, the site row and the
 *  brand's pictures: on a cold server they answer in about half a second; the first byte's target is 800 ms). */
export const BRAND_CARD_FIRST_MS = 450;

export function firstWithin(p: Promise<unknown>, ms: number): Promise<void> {
  let t: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([p.then(() => undefined, () => undefined), new Promise<void>(r => { t = setTimeout(r, ms); })]).finally(() => clearTimeout(t));
}
