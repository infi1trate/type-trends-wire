import { describe, expect, it } from "vitest";
import { AUDIT_TEXT, WATCH_TEXT, auditErrors, watchErrors } from "./forms";

describe("audit form", () => {
  it("needs 2 to 6 web addresses, in plain words", () => {
    expect(auditErrors("")).toEqual({ sites: "Add the sites to compare: at least 2, separated by commas." });
    expect(auditErrors("linear.app")).toEqual({ sites: "Add 1 more site: an audit compares at least 2." });
    expect(auditErrors("linear.app, linear.app")).toEqual({ sites: AUDIT_TEXT.tooFew(1) });
    expect(auditErrors("a.com,b.com,c.com,d.com,e.com,f.com,g.com")).toEqual({ sites: "Remove 1 site: an audit compares at most 6." });
    expect(auditErrors("linear.app, not_a_site")).toEqual({ sites: "“not_a_site” isn't a web address. Use the domain, like linear.app." });
    expect(auditErrors("linear.app, vercel.com")).toEqual({});
  });
});
describe("watch form", () => {
  it("needs a name; sites and signal keys must parse and stay within limits", () => {
    expect(watchErrors("", "")).toEqual({ name: WATCH_TEXT.name });
    expect(watchErrors("x".repeat(200), "").name).toBe(WATCH_TEXT.long);
    expect(watchErrors("Rivals", "linear.app, css:subgrid")).toEqual({});
    expect(watchErrors("Rivals", "not_a_site").targets).toBe("“not_a_site” is neither a domain nor a signal key. Use linear.app or css:subgrid.");
    const many = Array.from({ length: 26 }, (_, k) => `s${k}.com`).join(",");
    expect(watchErrors("Rivals", many).targets).toBe(WATCH_TEXT.sites(26));
  });
});
