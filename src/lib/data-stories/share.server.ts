// Share image (/data/<slug>.png) and one-step embed (/data/embed/<slug>?step=) for live data stories. Both stay behind the site gate
// while DATA_STORIES_PUBLIC is false; neither is listed in OPEN_PATHS, and the embed keeps the site's default framing rules until launch.
import { createElement } from "react";
import { loadDataStory } from "./page.server";
import { dataStoryOgScene } from "./og";
import { embedHtml } from "./embed";
import { parseStep } from "./stepper";
import { capText } from "./text";

const nf = () => new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
export async function dataStoryImage(param: string) {
  const m = /^([a-z0-9-]{1,80})(?:\.(png|svg))?$/.exec(param);
  if (!m) return nf();
  const page = await loadDataStory(m[1]!).catch(() => null);
  if (!page || page.kind !== "live") return nf();
  const { respond } = await import("../digest/og.server");
  return respond(dataStoryOgScene(page.story), (m[2] as "png" | "svg" | undefined) ?? "png", `Data story ${page.story.number}: ${page.story.question} ${page.story.key.n} ${page.story.key.label}`);
}
export async function dataStoryEmbed(slug: string, rawStep: string | null) {
  const page = await loadDataStory(slug).catch(() => null);
  if (!page || page.kind !== "live") return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" } });
  const s = page.story, k = parseStep(rawStep, s.steps.length), st = s.steps[k]!, fig = s.figures[st.view.figure];
  const [{ renderToStaticMarkup }, { FigureView }, { activeCss }] = await Promise.all([import("react-dom/server"), import("@/components/data/Figures"), import("../theme")]);
  const figure = fig ? renderToStaticMarkup(createElement(FigureView, { fig, view: st.view })) : "";
  return new Response(embedHtml({ story: s, step: k, caption: capText(st.caption), figure, themeCss: activeCss() }), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, max-age=300", "X-Robots-Tag": "noindex", "X-Content-Type-Options": "nosniff" },
  });
}
