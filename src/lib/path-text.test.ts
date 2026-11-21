import { describe, expect, it } from "vitest";
import { readablePath } from "./path-text";

// U3 Part 0 · the print footer (and every link built from the path) must be the same text on the server, which sees the decoded path,
// and in the browser, which sees it percent-encoded.
describe("readablePath", () => {
  const server = "/stories/brand:coinbase.com:2026-11-20", client = "/stories/brand%3Acoinbase.com%3A2026-11-20";
  it("an id with ':' reads the same from the server's and the browser's path", () => {
    expect(readablePath(server)).toBe(server);
    expect(readablePath(client)).toBe(server);
  });
  it("same for brand, signal, pattern, study and Digest addresses", () => {
    for (const [a, b] of ([["/brands/coinbase.com", "/brands/coinbase.com"], ["/signals/font:serif", "/signals/font%3Aserif"], ["/patterns/layout:bento", "/patterns/layout%3Abento"], ["/data/who-went-big-first", "/data/who-went-big-first"], ["/digest/2026-W46", "/digest/2026-W46"]] as const))
      expect(readablePath(b)).toBe(readablePath(a));
  });
  it("never turns an encoded slash, question mark, hash or percent into one that changes the address", () => {
    expect(readablePath("/a/b%2Fc")).toBe("/a/b%2Fc");
    expect(readablePath("/a/x%3Fy%23z%25")).toBe("/a/x%3Fy%23z%25");
    expect(readablePath("/a/%E0%A4%A")).toBe("/a/%E0%A4%A");
  });
});
