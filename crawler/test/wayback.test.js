import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { quarters, passOf, parseCdx, pickCapture, pickCaptures, blankArchive, buildQueue, archiveGaps, tsFromArchiveUrl, tsToDate, archiveUrl } from "../src/wayback-lib.js";
const run = promisify(execFile);

test("quarters stop before the current one", () => {
  const qs = quarters(new Date("2026-11-12T00:00:00Z"));
  assert.equal(qs[0], "2021Q1");
  assert.equal(qs.at(-1), "2026Q3");
  assert.equal(qs.length, 23);
  assert.deepEqual(["2023Q1", "2023Q3", "2023Q2", "2023Q4"].map(passOf), [1, 2, 3, 3]);
});

test("cdx parsing and capture picking", () => {
  const rows = [["timestamp", "statuscode", "mimetype"], ["20230101120000", "200", "text/html"], ["20230214090000", "200", "text/html"], ["20230301000000", "301", "text/html"], ["20230420000000", "200", "text/html"], ["bad", "200", "text/html"]];
  const ts = parseCdx(rows);
  assert.deepEqual(ts, ["20230101120000", "20230214090000", "20230420000000"]);
  assert.equal(pickCapture(ts, "2023Q1"), "20230214090000"); // closest to Feb 15
  assert.equal(pickCapture(ts, "2023Q2"), "20230420000000");
  assert.equal(pickCapture(ts, "2023Q3"), null);
  assert.deepEqual(pickCaptures(["20230214090000", "20230220000000", "20230110000000", "20230330000000"], "2023Q1"), ["20230214090000", "20230110000000", "20230330000000"]);
  assert.equal(blankArchive({ composition: { text_chars_fold: 0 }, skeleton: [{ kind: "section" }] }), true);
  assert.equal(blankArchive({ composition: { text_chars_fold: 300 }, skeleton: [] }), false);
  assert.equal(tsFromArchiveUrl("https://web.archive.org/web/20230214090000if_/https://x.com/"), "20230214090000");
  assert.equal(tsToDate("20230214090000").toISOString(), "2023-02-14T09:00:00.000Z");
  assert.equal(archiveUrl("20230214090000", "x.com"), "https://web.archive.org/web/20230214090000if_/https://x.com/");
});

test("queue is coarse-first, sector-interleaved, and skips what exists", () => {
  const sites = [{ domain: "a.com", sector: "ai" }, { domain: "b.com", sector: "ai" }, { domain: "c.com", sector: "media" }];
  const have = new Map([["a.com", new Set(["2021Q1"])]]);
  const q = buildQueue(sites, have, ["2021Q1", "2021Q2", "2021Q3"], 3);
  assert.deepEqual(q.map((i) => `${i.domain}:${i.quarter}`), ["b.com:2021Q1", "c.com:2021Q1", "a.com:2021Q3", "c.com:2021Q3", "b.com:2021Q3", "a.com:2021Q2", "c.com:2021Q2", "b.com:2021Q2"]);
  assert.equal(buildQueue(sites, have, ["2021Q1", "2021Q2", "2021Q3"], 1).length, 2);
});

test("archive gaps: only what the index or two failed renders say, never a stored quarter", () => {
  const sites = [{ domain: "a.com", sector: "ai" }, { domain: "b.com", sector: "ai" }, { domain: "c.com", sector: "ai" }];
  const have = new Map([["a.com", new Set(["2021Q1"])]]);
  const cache = { cdx: { "a.com": { picks: { "2021Q1": ["20210215000000"], "2021Q3": ["20210815000000"] } }, "b.com": { picks: { "2021Q2": ["20210515000000"] } } }, failed: { "a.com|2021Q3": 2, "b.com|2021Q2": 1 } };
  assert.deepEqual(archiveGaps(sites, have, ["2021Q1", "2021Q2", "2021Q3"], cache, 2), [
    { domain: "a.com", quarter: "2021Q2", reason: "no_capture" },
    { domain: "a.com", quarter: "2021Q3", reason: "unreadable" },
    { domain: "b.com", quarter: "2021Q1", reason: "no_capture" },
    { domain: "b.com", quarter: "2021Q3", reason: "no_capture" },
  ]); // c.com: the index was never asked, so nothing is claimed; b.com 2021Q2 failed once and is still to try
});

test("wayback dry run against a fake archive", { timeout: 180000 }, async () => {
  let hang = false;
  const cacheFile = "/tmp/wbtest-cache.json";
  rmSync(cacheFile, { force: true });
  const page = readFileSync("test/fixtures/lib/index.html", "utf8");
  let asked = 0;
  const server = http.createServer((req, res) => {
    if (req.url.startsWith("/cdx/")) {
      asked++;
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify([["timestamp", "statuscode", "mimetype"], ["20210210000000", "200", "text/html"], ["20220212000000", "200", "text/html"], ["20220815000000", "200", "text/html"]]));
    }
    if (/^\/web\/20220815\d{6}if_\//.test(req.url) && hang) return; // never answers: a page that hangs
    if (/^\/web\/\d{14}if_\//.test(req.url)) { res.writeHead(200, { "content-type": "text/html" }); return res.end(page); }
    res.writeHead(404); res.end();
  });
  await new Promise((r) => server.listen(4831, r));
  writeFileSync("/tmp/wb.csv", "domain,sector\nexample.com,dev-tools\n");
  writeFileSync("/tmp/wbstate.json", JSON.stringify({ sites: [{ domain: "example.com", wayback: [{ quarter: "2022Q1", captured_at: "2022-02-12T00:00:00Z" }] }] }));
  rmSync("out", { recursive: true, force: true });
  try {
    await run("node", ["src/wayback.js"], { env: { ...process.env, DRY_RUN: "1", RUN_ID: "wbtest", LIBRARY_FILE: "/tmp/wb.csv", STATE_FILE: "/tmp/wbstate.json", WB_ARCHIVE_BASE: "http://localhost:4831", WB_CONCURRENCY: "2", WB_CACHE_FILE: cacheFile } });
    const sum = JSON.parse(readFileSync("out/wbtest.summary.json", "utf8"));
    assert.equal(sum.captured, 2);           // 2021Q1 + 2022Q3; 2022Q1 already in state
    assert.ok(sum.no_capture > 10);          // quarters with no archive capture are skipped without rendering
    const snaps = readFileSync("out/wbtest.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((l) => l.kind === "library_snapshots").flatMap((l) => l.snapshots);
    assert.deepEqual(snaps.map((s) => s.signals.archive.quarter).sort(), ["2021Q1", "2022Q3"]);
    const s = snaps.find((x) => x.signals.archive.quarter === "2021Q1");
    assert.equal(s.source, "wayback");
    assert.equal(s.url, "https://example.com/");
    assert.equal(s.captured_at, "2021-02-10T00:00:00.000Z");
    assert.equal(s.signals.lexicon.h1, "Software that stays out of the way");
    assert.equal(s.raw_text, undefined);
    assert.ok(s.signals.skeleton.length <= 250);
    assert.ok(s.signals.nav.every((n) => !/\/web\/\d/.test(n.href)));
    const tags = readFileSync("out/wbtest.tags.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l));
    assert.equal(tags.length, 2);
    assert.ok(tags.every((t) => t.source === "wayback" && t.images.fold > 1000));

    // A second run with the file from the first: the Archive's index is not asked again, quarters known to be empty are
    // not queued, and a page that never answers is given up at the deadline, its browser killed, and counted against it.
    assert.equal(asked, 1);
    const kept = JSON.parse(readFileSync(cacheFile, "utf8"));
    assert.deepEqual(Object.keys(kept.cdx["example.com"].picks).sort(), ["2021Q1", "2022Q1", "2022Q3"]);
    hang = true;
    await run("node", ["src/wayback.js"], { env: { ...process.env, DRY_RUN: "1", RUN_ID: "wbtest2", LIBRARY_FILE: "/tmp/wb.csv", STATE_FILE: "/tmp/wbstate.json", WB_ARCHIVE_BASE: "http://localhost:4831", WB_CONCURRENCY: "2", WB_CACHE_FILE: cacheFile, WB_RENDER_DEADLINE_S: "4" } });
    const sum2 = JSON.parse(readFileSync("out/wbtest2.summary.json", "utf8"));
    assert.equal(asked, 1);
    assert.equal(sum2.queue, 2); assert.equal(sum2.no_capture, 0);
    assert.equal(sum2.captured, 1); assert.equal(sum2.killed, 1);
    assert.deepEqual(sum2.errors, { render_deadline: 1 });
    assert.equal(JSON.parse(readFileSync(cacheFile, "utf8")).failed["example.com|2022Q3"], 1);
  } finally { server.closeAllConnections?.(); server.close(); }
});
