// I3b · measure the stored section crops that have no crop_quality row yet (the same path the scheduled sweep takes), without its time cap.
// Usage: bun scripts/i3b-crop-sweep.ts [look]
const look = Number(process.argv[2] ?? 3000);
const { measurePendingCrops } = await import("../src/lib/crop-measure.server");
console.log(JSON.stringify(await measurePendingCrops({ limitMs: 240_000, look })));
process.exit(0);
