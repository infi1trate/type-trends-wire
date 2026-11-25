# R2a-2 · Room for 1,000 — job budget (measured, not yet acted on)

Measured from `job_runs` over the 14 days to 25 Nov 2026 (about 300 panel brands). Projection is linear in brands (× 3.33) and is an estimate.

| Job | Runs | Mean s | Max s | Projected max at 1,000 | Over 60 s? |
|---|---|---|---|---|---|
| crawl-ingest | 176 | 7.7 | 151.1 | per post, not per brand (outlier) | — |
| wire-followups (weekly structure, kit, lead-lag, evidence steps ride here) | 239 | 15.2 | 51.0 | ~170 | yes |
| story-build | 233 | 7.4 | 36.1 | ~120 | yes |
| records-refresh | 244 | 8.8 | 24.5 | ~82 | yes |
| ai-worker | 865 | 1.8 | 25.0 | queue-bounded (≤60 s by design) | no |
| review-passes / desk-jobs | — | <1 | ~25 | not per brand | no |

Not done in this brief: no job has been moved to resumable cursor chunks yet (worst is wire-followups), and archive AI reading has no separate weekly sub-allowance yet.
