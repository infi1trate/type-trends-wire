import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { Stepper, StepSequence } from "./DataStoryView";
import { FigureView } from "./Figures";
import { fxInput, fxCapture } from "@/lib/data-stories/fixtures";
import { bigTypeStory, whereYouSit, type Meta } from "@/lib/data-stories/stories";
import { beforeAfter, strip } from "@/lib/data-stories/templates/frames";
import { capText } from "@/lib/data-stories/text";
import { EMBED_UTILITIES } from "@/lib/data-stories/embed";
import { readFileSync } from "node:fs";
import type { CropRow } from "@/lib/crops";

const meta: Meta = { slug: "who-went-big-first", number: 2, question: "Who went big first?", deck: "D", template: "Adoption timeline", collection: { label: "C", href: "/c" }, related: [] };
const s = bigTypeStory(fxInput(), new Map(), meta);
function Harness({ start = 0 }: { start?: number }) { const [k, setK] = useState(start); return <Stepper s={s} step={k} onStep={setK} />; }

describe("<Stepper>", () => {
  it("steps with keys and buttons, clamps, and shows “k of n”", () => {
    render(<Harness />);
    const n = s.steps.length, c = () => document.querySelector("[data-counter]")!.textContent;
    expect(c()).toBe(`1 of ${n}`);
    expect(screen.getByRole("button", { name: "Previous step" })).toBeDisabled();
    fireEvent.keyDown(document.body, { key: "ArrowRight" }); expect(c()).toBe(`2 of ${n}`);
    fireEvent.keyDown(document.body, { key: "j" }); expect(c()).toBe(`3 of ${n}`);
    fireEvent.keyDown(document.body, { key: "K" }); expect(c()).toBe(`2 of ${n}`);
    fireEvent.keyDown(document.body, { key: "End" }); expect(c()).toBe(`${n} of ${n}`);
    fireEvent.keyDown(document.body, { key: "ArrowDown" }); expect(c()).toBe(`${n} of ${n}`);
    fireEvent.keyDown(document.body, { key: "Home" }); expect(c()).toBe(`1 of ${n}`);
    fireEvent.click(screen.getByRole("button", { name: "Next step" })); expect(c()).toBe(`2 of ${n}`);
    expect(document.querySelector('[aria-current="step"]')?.getAttribute("data-step")).toBe("2");
  });
  it("announces each change once in a polite live region with the caption", () => {
    render(<Harness />);
    const live = document.querySelector("[data-announce]")!;
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live.textContent).toBe("");
    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    expect(live.textContent).toBe(`Step 2 of ${s.steps.length}. ${capText(s.steps[1]!.caption)}`);
    fireEvent.keyDown(document.body, { key: "Home" }); fireEvent.keyDown(document.body, { key: "Home" });
    expect(live.textContent).toBe(`Step 1 of ${s.steps.length}. ${capText(s.steps[0]!.caption)}`);
  });
  it("under reduced motion it jumps instead of scrolling smoothly", () => {
    const spy = vi.fn();
    Element.prototype.scrollIntoView = spy;
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as never;
    render(<Harness />);
    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    expect(spy).toHaveBeenCalledWith({ behavior: "auto", block: "center" });
    (window.matchMedia as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ matches: false });
    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    expect(spy).toHaveBeenLastCalledWith({ behavior: "smooth", block: "center" });
  });
  it("ignores keys typed into a field", () => {
    render(<><input aria-label="field" /><Harness /></>);
    fireEvent.keyDown(screen.getByLabelText("field"), { key: "j" });
    expect(document.querySelector("[data-counter]")!.textContent).toBe(`1 of ${s.steps.length}`);
  });
});

describe("without JavaScript", () => {
  it("every step renders as figure plus caption, with no controls (the first step drawn; the rest link to ?figures=all, which draws all)", () => {
    const first = new DOMParser().parseFromString(renderToStaticMarkup(<StepSequence s={s} />), "text/html");
    expect(first.querySelector("[data-sequence] > li [data-figure]")).not.toBeNull();
    first.querySelectorAll("[data-sequence] > li [data-deferred] noscript").forEach(n => expect(n.innerHTML).toContain("?figures=all#step-"));
    const html = renderToStaticMarkup(<StepSequence s={s} full />);
    const doc = new DOMParser().parseFromString(html, "text/html");
    const items = doc.querySelectorAll("[data-sequence] > li");
    expect(items).toHaveLength(s.steps.length);
    items.forEach((li, k) => { expect(li.querySelector("[data-figure]")).not.toBeNull(); expect(li.textContent).toContain(capText(s.steps[k]!.caption)); });
    expect(doc.querySelectorAll("button")).toHaveLength(0);
  });
});

describe("before / after and the strip", () => {
  const a = fxCapture(1, "2021-02-10T00:00:00Z"), b = fxCapture(2, "2026-11-14T00:00:00Z", { bg: "#0A0A0A", source: "live" });
  const crop: CropRow = { domain: "x.example", section: "hero", viewport: "desktop", captured_at: "2026-11-15T00:00:00Z", first_seen_at: "2026-11-15T00:00:00Z", last_seen_at: "2026-11-15T00:00:00Z", path: "x.example/hero/2026-11-15-abcdef12.webp", width: 1280, height: 800, bytes: 1000, hash: "abcdef1234" };
  it("with zero crops both sides redraw skeletons; the two labelled buttons move the slider", () => {
    const f = beforeAfter({ title: "t", note: "n", domain: "x.example", name: "X", a, b, crops: [] });
    const { container } = render(<FigureView fig={f} view={{ figure: "ba", highlight: [], side: "split" }} live />);
    expect(container.querySelectorAll('[data-frame="skeleton"]')).toHaveLength(2);
    expect(container.querySelector('[data-frame="crop"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Before/ }));
    expect(container.querySelector("[data-pos]")!.getAttribute("data-pos")).toBe("100");
    fireEvent.click(screen.getByRole("button", { name: /^After/ }));
    expect(container.querySelector("[data-pos]")!.getAttribute("data-pos")).toBe("0");
    fireEvent.change(screen.getByLabelText("Slide between before and after"), { target: { value: "35" } });
    expect(container.querySelector("[data-pos]")!.getAttribute("data-pos")).toBe("35");
  });
  it("uses the crop when one exists", () => {
    const f = beforeAfter({ title: "t", note: "n", domain: "x.example", name: "X", a, b, crops: [crop] });
    const { container } = render(<FigureView fig={f} view={{ figure: "ba", highlight: [], side: "after" }} />);
    expect(container.querySelector('[data-frame="crop"]')?.getAttribute("src")).toBe("/crops/x.example/hero/2026-11-15-abcdef12.webp");
  });
  it("the strip plays, pauses and steps", () => {
    vi.useFakeTimers();
    const f = strip({ title: "t", note: "n", domain: "x.example", name: "X", captures: [a, fxCapture(3, "2023-02-10T00:00:00Z"), b], events: [], crops: [] });
    const { container } = render(<FigureView fig={f} view={{ figure: "s", highlight: [], focus: "1" }} live />);
    const at = () => container.querySelector("[data-frame-index]")!.getAttribute("data-frame-index");
    expect(at()).toBe("0");
    fireEvent.click(screen.getByRole("button", { name: "Later →" })); expect(at()).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "← Earlier" })); expect(at()).toBe("0");
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    act(() => { vi.advanceTimersByTime(1500); }); expect(at()).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    act(() => { vi.advanceTimersByTime(5000); }); expect(at()).toBe("1");
    vi.useRealTimers();
  });
  it("where-you-sit renders its field and strip from skeletons", () => {
    const w = whereYouSit(fxInput(), "b00.example", [a, b], { ...meta, slug: "where-you-sit" })!;
    expect(Object.keys(w.figures).sort()).toEqual(["field", "strip"]);
  });
});

describe("embed", () => {
  it("covers every utility class the figures use", () => {
    const src = ["src/components/data/Figures.tsx", "src/components/chartkit/Frame.tsx", "src/components/chartkit/Multiples.tsx", "src/components/chartkit/BeforeAfter.tsx"].map(f => readFileSync(f, "utf8")).join("\n");
    const classes = [...src.matchAll(/className=(?:\{`([^`]*)`|"([^"]*)")/g)].flatMap(m => (m[1] ?? m[2] ?? "").replace(/\$\{[^}]*\}/g, " ").split(/\s+/)).filter(c => c && !/^(tk-|ed-)/.test(c) && /^[a-z]/.test(c) && !c.includes("?"));
    const known = new Set([...Object.keys(EMBED_UTILITIES), "sm:grid-cols-2", "sm:grid-cols-3", "xl:grid-cols-4", "hover:underline", "strip-current"]);
    expect([...new Set(classes)].filter(c => !known.has(c))).toEqual([]);
  });
});
