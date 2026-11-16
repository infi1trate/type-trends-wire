import { createServerFn } from "@tanstack/react-start";
// Latest forecast rows for the signal view model; tiers, Momentum and Confidence are computed by the same pure code on the client.
export const getSignalSnapshot = createServerFn({ method: "GET" }).handler(async () => {
  const [{ loadSignalSnapshot }, { packSnapshot }] = await Promise.all([import("./signals.server"), import("./signal-pack")]);
  return packSnapshot(await loadSignalSnapshot());
});
