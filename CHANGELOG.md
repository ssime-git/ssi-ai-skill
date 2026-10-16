# Changelog

## 0.2.0 - 2026-10-16
- ssi record rejects unknown options; review and CI passes require a note.
- Every phase now ends in a stop when it keeps failing (new analysisRetries, planRetries, implementRetries thresholds, default 3). Before, analyze, confirm, plan and implement could loop forever.

## 0.1.0
- First public release: single-entry loop from request to reviewed draft PR, engine tests, CI on Node 20 and 22.
