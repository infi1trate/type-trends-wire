// C1b Part 1 · the page loaders' one call for their announced picture: on the server it reads the stored address (bounded); in the
// browser (a click from page to page) there is no first flush to announce in, so it answers nothing and loads nothing.
import { createIsomorphicFn } from "@tanstack/react-start";
import { NO_FIRST, type FirstKind, type FirstPaint } from "./first-paint";

export const firstPaint = createIsomorphicFn()
  .server(async (kind: FirstKind, id: string): Promise<FirstPaint> => (await import("./first-paint.server")).firstPaintFor(kind, id))
  .client(async (_kind: FirstKind, _id: string): Promise<FirstPaint> => NO_FIRST);
