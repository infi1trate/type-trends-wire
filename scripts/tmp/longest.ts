import * as R from "@/lib/read.server";
const fn = R.siteTraitIndex as any;
const idx = await fn();
const names = idx.map((s: any) => s.name ?? s.domain).sort((a: string, b: string) => b.length - a.length);
console.log(names.slice(0, 3));
process.exit(0);
