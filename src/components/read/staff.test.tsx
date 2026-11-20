// Phase E0 · staff pages: /desk, /status, /status/launch, /welcome and /kit show nothing without the editor key, and the endpoint
// that feeds them checks the key before anything else.
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { StaffGate } from "./StaffGate";
import { setStaffKey, staffKey, STAFF_HREFS } from "@/lib/staff-key";
import { handleDesk, type DeskDeps } from "@/lib/stories/desk.server";
import { Route as WelcomeRoute } from "@/routes/welcome";
import { Route as KitRoute } from "@/routes/kit";

const SECRET = "Story queue: lucidmotors.com changed its headline font · score 61 · health ok · pre-flight";
const page = () => createElement(StaffGate, { page: "System status", children: () => createElement("p", null, SECRET) });
async function ssr() {
  const root = createRootRoute({ component: page });
  const router = createRouter({ routeTree: root, history: createMemoryHistory({ initialEntries: ["/status"] }) });
  await router.load();
  return renderToString(createElement(RouterProvider, { router } as never));
}
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => setStaffKey(null));

describe("staff pages", () => {
  it("without the key the HTML has the page name, Staff only and the key field, and no data", async () => {
    const html = await ssr();
    expect(html).toContain("System status"); expect(html).toContain("Staff only"); expect(html).toContain('id="staff-key"');
    expect(html).not.toContain(SECRET);
  });
  it("server render never holds a key, even after one was accepted in a tab", async () => {
    setStaffKey("k");
    expect(await ssr()).not.toContain(SECRET);
  });
  it("with the key accepted, the page renders its content", async () => {
    const root = createRootRoute({ component: page });
    const router = createRouter({ routeTree: root, history: createMemoryHistory({ initialEntries: ["/status"] }) });
    await router.load();
    const el = document.createElement("div"); document.body.append(el);
    const r = createRoot(el);
    await act(async () => { r.render(createElement(RouterProvider, { router } as never)); });
    expect(el.textContent).toContain("Staff only");
    await act(async () => { setStaffKey("k"); });
    expect(el.textContent).toContain(SECRET); expect(el.textContent).not.toContain("Staff only");
    await act(async () => { setStaffKey(null); });
    expect(el.textContent).not.toContain(SECRET);
    r.unmount(); el.remove();
  });
  it("/welcome and /kit answer not found without the key", () => {
    expect(staffKey()).toBeNull();
    for (const R of [WelcomeRoute, KitRoute]) {
      const before = (R.options as { beforeLoad?: () => void }).beforeLoad!;
      expect(() => before()).toThrow();
      setStaffKey("k"); expect(() => before()).not.toThrow(); setStaffKey(null);
    }
  });
  it("staff links are the five staff pages", () => {
    expect([...STAFF_HREFS].sort()).toEqual(["/desk", "/kit", "/status", "/status/launch", "/welcome"]);
  });
});

describe("the endpoint behind the staff pages", () => {
  const d: DeskDeps = { authorize: async r => r.headers.get("authorization") === "Bearer good", allow: () => true, now: () => 0,
    store: { exists: async () => true, insertEdit: async e => ({ id: 1, at: "", ...e }), queue: async () => ({ q: 1 }), staff: async p => ({ page: p, checks: ["pre-flight"] }) } };
  const post = (body: unknown, auth: string) => new Request("https://site.test/api/public/desk", { method: "POST", headers: { "content-type": "application/json", authorization: auth }, body: JSON.stringify(body) });
  it("checks the key before returning any staff page data", async () => {
    for (const body of [{ action: "check" }, { action: "staff", page: "launch" }, { action: "staff", page: "welcome" }, { action: "queue" }]) {
      const bad = await handleDesk(post(body, "Bearer bad"), d);
      expect(bad.status).toBe(401); expect(await bad.text()).not.toContain("pre-flight");
    }
    const ok = await handleDesk(post({ action: "staff", page: "launch" }, "Bearer good"), d);
    expect(ok.status).toBe(200); expect(await ok.json()).toEqual({ page: "launch", checks: ["pre-flight"] });
    expect((await handleDesk(post({ action: "check" }, "Bearer good"), d)).status).toBe(200);
  });
});
