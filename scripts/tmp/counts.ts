import { galleryInput, loadCollections, loadGallery } from "@/lib/gallery.server";
import { NO_FILTER } from "@/lib/gallery";
const i = await galleryInput();
console.log("captures", i.captures.length, "changes", i.changes.length, "stamps", i.stamps.length, "patterns", i.patterns.length, "q sample", i.captures[0]?.quarter);
console.log(JSON.stringify(await loadCollections(), null, 0));
const g = await loadGallery(NO_FILTER); console.log("all", g.total, g.countLine, g.options.patterns.map(p => `${p.name}:${p.count}`).join(", "), g.tiles[0]?.frame?.boxes.length, g.tiles[0]?.label);
console.log(JSON.stringify(g.tiles[0]).length, JSON.stringify(g).length);
process.exit(0);
