import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { LiveItem } from "./FrontLive";
import { toFront } from "@/lib/front/front";
import { st, NOW } from "@/lib/front/fixtures";

describe("live column rows", () => {
  it("show the story's permanent number, linking to the story", () => {
    const s = toFront(st("a", { number: 48 }) as never);
    const { container } = render(<ul><LiveItem s={s} now={NOW} /></ul>);
    const n = container.querySelector("[data-story-number]");
    expect(n?.textContent).toBe("No. 48");
    expect(n?.closest("a")?.getAttribute("href")).toBe(s.href);
  });
  it("show a dot when a story has no number yet", () => {
    const { container } = render(<ul><LiveItem s={toFront(st("b", { number: null }) as never)} now={NOW} /></ul>);
    // S1: the dot sits in the figure's place with the "No." label held invisibly, so its title lines up with numbered rows.
    expect(container.querySelector("[data-story-number] .ledger-no-fig")?.textContent).toBe("·");
    expect(container.querySelector<HTMLElement>("[data-story-number] .ledger-no-label")?.style.visibility).toBe("hidden");
  });
});
