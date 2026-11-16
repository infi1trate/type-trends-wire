import { createServerFn } from "@tanstack/react-start";
// The brand kit's file list for /brand/downloads (names, sizes, purposes). Reads bundled kit files only; nothing from the database.
export const getKitFiles = createServerFn({ method: "GET" }).handler(async () => {
  const { kitFiles } = await import("./brand-files.server");
  return kitFiles();
});
