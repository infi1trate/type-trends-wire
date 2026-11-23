import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AI_MODELS, STEP_MODELS } from "../ai-models";
import { DESK_VERSIONS, deskGatePasses, deskModels, deskScoreOf } from "./golden/versions";

describe("T2 · a story step changes model only when it passes its frozen set", () => {
  const score = (f: string) => deskScoreOf(JSON.parse(readFileSync(f, "utf8")));
  it("the standards second reader runs on the cheaper model, whose score passes the gate against v3", () => {
    expect(STEP_MODELS.standards).toBe("openai/gpt-6-luna");
    expect(deskModels("standards")[0]).toBe(STEP_MODELS.standards);
    const v3 = DESK_VERSIONS.find(v => v.desk === "standards" && v.version === "v3")!, v4 = DESK_VERSIONS.find(v => v.desk === "standards" && v.version === "v4")!;
    expect(deskGatePasses(score(v3.score_file), score(v4.score_file)).ok).toBe(true);
  });
  it("the editor in chief and the story writer, which no cheaper model matched, stay on the writer model", () => {
    expect(deskModels("editor in chief")[0]).toBe(AI_MODELS.writer);
    expect(AI_MODELS.writer).toBe("openai/gpt-6.2-astra");
    for (const f of ["chief-gpt-6-luna-2026-11-23", "chief-gemini-3.1-flash-lite-2026-11-23", "chief-gpt-5.6-luna-2026-11-23", "chief-gpt-6.1-terra-2026-11-23"])
      expect(JSON.parse(readFileSync(`newsroom/scores/${f}.json`, "utf8")).gate.ok).toBe(false);
  });
});
