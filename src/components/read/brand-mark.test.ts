import { describe, expect, it } from "vitest";
import { usableMark } from "./BrandMark";
import { pictureIndex } from "@/lib/pictures";
const pic = (width: number, height = width, src = "/icon.webp") => ({ src, width, height, at: "2026-11-25" });
describe("A1 mark eligibility", () => {
  it("a 32px favicon cannot fill a 72px mark", () => { expect(usableMark(pic(32), 72)).toBe(false); expect(usableMark(pic(48), 72)).toBe(true); });
  it("both dimensions must meet the two-thirds floor", () => { expect(usableMark(pic(72, 47), 72)).toBe(false); });
  it("vectors remain usable at any tile size", () => { expect(usableMark(pic(0, 0, "/icon.svg"), 72)).toBe(true); });
  it("the largest stored icon wins over a newer favicon", () => {
    const rows = [{ domain: "a.com", kind: "icon", path: "touch.webp", width: 180, height: 180, captured_at: "2026-11-24" }, { domain: "a.com", kind: "icon", path: "favicon.webp", width: 32, height: 32, captured_at: "2026-11-25" }];
    expect(pictureIndex(rows).get("a.com")?.icon?.width).toBe(180);
  });
});
