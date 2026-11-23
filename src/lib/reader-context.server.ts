// D1 Part 5/7 · whether the code is running for a reader (a page render or a page's server function) rather than a job (every job
// and crawler post comes in under /api/). Readers may be given an old stored copy; jobs never are. Outside a request (tests, scripts):
// not a reader.
import { getRequest } from "@tanstack/react-start/server";
export function readerNow(): boolean {
  try { return !new URL(getRequest().url).pathname.startsWith("/api/"); } catch { return false; }
}
