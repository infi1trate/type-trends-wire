// L1 · the colophon's one read, as a server function (wrapped by colophonQuery in data.ts).
import { createServerFn } from "@tanstack/react-start";

export const getColophon = createServerFn({ method: "GET" }).handler(async () => {
  const { loadColophon } = await import("./living.server");
  return loadColophon();
});
