# Tasks: Pragmatic Auto-Verification

**Input**: Design documents from `/specs/014-auto-verification/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-contract.md, quickstart.md

**Tests**: Not requested in the feature specification. No test tasks included.

**Organization**: Tasks grouped by user story. US4 (harvest classification) is foundational for US1 (import auto-verify) and US2 (re-scoring). US3 (batch verify UI) is independent.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US2, US3, US4)
- Exact file paths included in every task description

---

## Phase 1: Setup

**Purpose**: Schema migration — add new fields to Judge model

- [X] T001 Add `rosterUrl` (String?) and `extractionMethod` (String?) fields to Judge model in prisma/schema.prisma
- [X] T002 Run Prisma migration `add_roster_url_and_extraction_method` to apply schema changes

**Checkpoint**: Database has new nullable columns. No data migration needed — existing records get NULL.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared utilities that multiple user stories depend on

**⚠️ CRITICAL**: US4, US1, and US2 all depend on the source classifier. Must complete before story phases.

- [X] T003 [P] Create `classifySourceAuthority(url, stateConfigs)` function in scripts/harvest/source-classifier.ts — classify `.gov` → OFFICIAL_GOV, config-listed domains → COURT_WEBSITE, else → SECONDARY per research R1
- [X] T004 [P] Add `sourceAuthority` (SourceAuthority) and `extractionMethod` (string) fields to `EnrichedJudgeRecord` type in scripts/harvest/config.ts

**Checkpoint**: Source classifier is importable by harvest pipeline, import pipeline, and re-scoring script. EnrichedJudgeRecord type includes new fields.

---

## Phase 3: User Story 4 — Source Authority Classification in Harvest Pipeline (Priority: P1)

**Goal**: During harvest, classify each source URL's authority level and tag each record with the classification and extraction method. Metadata flows through CSV into the import pipeline.

**Independent Test**: Run Florida harvest. Open output CSV. Confirm every record has Source Authority (OFFICIAL_GOV for `.flcourts.gov`, COURT_WEBSITE for circuit `.org` sites) and Extraction Method (deterministic or llm) columns. Verify confidence scores are higher than before for `.gov` sources.

### Implementation for User Story 4

- [X] T005 [P] [US4] Tag extraction method ("deterministic" or "llm") on extraction results in scripts/harvest/extractor.ts — set method based on whether deterministic extractor succeeded or LLM fallback was used
- [X] T006 [P] [US4] Update confidence formula in scripts/harvest/bio-enricher.ts — replace flat base 0.50 with source-authority-aware bases (OFFICIAL_GOV=0.65, COURT_WEBSITE=0.55, SECONDARY=0.45), add +0.10 bonus for deterministic extraction, update cap from 0.90 to 0.95
- [X] T007 [P] [US4] Add "Source Authority" and "Extraction Method" columns to CSV output in scripts/harvest/reporter.ts — append after existing columns per contracts/api-contract.md header row
- [X] T008 [US4] Propagate sourceAuthority and extractionMethod through harvest orchestrator in scripts/harvest/index.ts — call classifier on each roster URL, pass extraction method from extractor to enricher and through to final record

**Checkpoint**: `npx tsx scripts/harvest/index.ts --state florida --limit 3` produces CSV with Source Authority and Extraction Method columns populated. `.gov` sources show higher confidence scores than `.org` sources.

---

## Phase 4: User Story 1 — Source-Aware Auto-Verification During Import (Priority: P1) 🎯 MVP

**Goal**: Import pipeline reads source authority and extraction method from harvest CSV, applies tiered auto-verify thresholds, and auto-verifies trusted records. Old CSVs without new columns import with backward-compatible defaults.

**Independent Test**: Import a new Florida harvest CSV. Confirm `.gov`-sourced judges with no anomaly flags are created with `status: VERIFIED`, `autoVerified: true`. Confirm `.org`-sourced judges with low confidence remain UNVERIFIED. Import an old CSV — confirm it succeeds with COURT_WEBSITE defaults.

### Implementation for User Story 1

- [X] T009 [P] [US1] Parse "Source Authority", "Extraction Method", and "Roster URL" columns in scripts/import/csv-importer.ts — default to COURT_WEBSITE and null when columns are absent (backward compatibility per FR-012), map Roster URL to `rosterUrl` field
- [X] T010 [P] [US1] Implement source-aware auto-verify thresholds in scripts/import/quality-gate.ts — OFFICIAL_GOV ≥ 0.70, COURT_WEBSITE ≥ 0.75, SECONDARY ≥ 0.80; anomaly flags always force NEEDS_REVIEW (FR-007 through FR-010); set `autoVerified: true` and `verifiedAt` for auto-verified records
- [X] T011 [US1] Update import upsert in scripts/import/index.ts — remove hardcoded `sourceAuthority: 'COURT_WEBSITE'`, use parsed sourceAuthority from CSV (FR-013), persist `rosterUrl` and `extractionMethod` fields on Judge record (FR-024)

**Checkpoint**: Full harvest-to-import pipeline works end-to-end. `.gov` judges auto-verified, `.org` judges verified only with sufficient bio fields, old CSVs import successfully.

---

## Phase 5: User Story 2 — Re-Score and Promote Existing Unverified Records (Priority: P1)

**Goal**: Admin runs a re-scoring CLI command to evaluate all UNVERIFIED and flag-cleared NEEDS_REVIEW judges using the new confidence formula. Dry-run previews impact; apply mode promotes eligible records in batches.

**Independent Test**: Run `npx tsx scripts/maintenance/rescore-judges.ts --dry-run` — verify summary output. Run with `--apply` — verify promoted judges appear on public pages. Verify VERIFIED and REJECTED records are never modified.

### Implementation for User Story 2

- [X] T012 [US2] Create re-scoring script with CLI argument parsing (--dry-run, --apply, --batch-size, --state) in scripts/maintenance/rescore-judges.ts — validate mutually exclusive flags, default to dry-run per contracts/api-contract.md
- [X] T013 [US2] Implement candidate query in scripts/maintenance/rescore-judges.ts — fetch `status IN (UNVERIFIED, NEEDS_REVIEW)` where NEEDS_REVIEW only if `anomalyFlags` is empty array, skip VERIFIED and REJECTED (FR-016, FR-017)
- [X] T014 [US2] Implement dry-run summary output in scripts/maintenance/rescore-judges.ts — classify sourceAuthority from sourceUrl using source-classifier, recalculate confidence scores, report promotion counts per source authority tier and per state (FR-015)
- [X] T015 [US2] Implement apply mode with batched transactions in scripts/maintenance/rescore-judges.ts — process in batches of --batch-size (default 100) per transaction, update status/confidenceScore/sourceAuthority/autoVerified/verifiedAt, log progress per batch, ensure idempotency (FR-023, EC-003, EC-008)

**Checkpoint**: `npx tsx scripts/maintenance/rescore-judges.ts --dry-run` shows promotion preview. `--apply` promotes eligible records. Re-running produces same final state (idempotent).

---

## Phase 6: User Story 3 — Batch Verification by Source in Admin Panel (Priority: P2)

**Goal**: Admin sees a sources view grouping judges by source URL with status counts. "Verify All" button batch-promotes all UNVERIFIED judges from a source with confirmation.

**Independent Test**: Navigate to admin judges page sources view. Verify groupings show correct counts per source. Click "Verify All" on one source — confirm only UNVERIFIED judges from that source are promoted. Confirm NEEDS_REVIEW judges remain unchanged.

### Implementation for User Story 3

- [X] T016 [P] [US3] Create GET /api/admin/judges/sources endpoint in src/app/api/admin/judges/sources/route.ts — Prisma groupBy on sourceUrl, count by status (total, verified, unverified, needsReview), support stateId/countyId filters, paginate per contracts/api-contract.md
- [X] T017 [P] [US3] Create POST /api/admin/judges/batch-verify endpoint in src/app/api/admin/judges/batch-verify/route.ts — validate sourceUrl, update all matching UNVERIFIED judges to VERIFIED with verifiedAt timestamp, exclude NEEDS_REVIEW and REJECTED (FR-020, FR-022)
- [X] T018 [US3] Add Sources tab/view to admin judges page in src/app/admin/judges/page.tsx — table grouped by sourceUrl with source authority badge, total/verified/unverified/needs-review count columns, state/county filter dropdowns (FR-019)
- [X] T019 [US3] Implement "Verify All" button per source row with confirmation dialog in src/app/admin/judges/page.tsx — show source URL and count of records to verify, call batch-verify endpoint on confirm, refresh counts after success (FR-021, EC-004)

**Checkpoint**: Admin can view all sources with counts, batch-verify a source, and see updated counts. Newly verified judges appear on public pages.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validation, backward compatibility confirmation, and documentation

- [X] T020 [P] Validate backward compatibility by importing an old-format harvest CSV (without Source Authority and Extraction Method columns) through the full import pipeline
- [X] T021 Run end-to-end smoke test per specs/014-auto-verification/quickstart.md — harvest → import → re-score → batch verify → verify public pages
- [X] T022 [P] Update feature documentation with final implementation notes in specs/014-auto-verification/

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001-T002) — BLOCKS all user stories
- **US4 (Phase 3)**: Depends on Foundational (T003-T004) — BLOCKS US1
- **US1 (Phase 4)**: Depends on US4 (T005-T008) — harvest must produce new CSV columns before import can consume them
- **US2 (Phase 5)**: Depends on Foundational (T003) for classifier — can start after Phase 2 if needed, but logically follows US1
- **US3 (Phase 6)**: Depends on Setup (T001-T002) only — can start in parallel with US4/US1/US2
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

```
Phase 1 (Setup)
    │
    ▼
Phase 2 (Foundational: classifier + config type)
    │
    ├──────────────────────────────┐
    ▼                              ▼
Phase 3 (US4: harvest)        Phase 6 (US3: batch UI) ← independent
    │
    ▼
Phase 4 (US1: import) 🎯 MVP
    │
    ▼
Phase 5 (US2: re-score)
    │
    ▼
Phase 7 (Polish)
```

### Within Each Phase — Parallel Opportunities

**Phase 2**: T003 ‖ T004 (different files)
**Phase 3 (US4)**: T005 ‖ T006 ‖ T007 (different files) → T008 (orchestrator depends on all three)
**Phase 4 (US1)**: T009 ‖ T010 (different files) → T011 (import/index.ts depends on both)
**Phase 5 (US2)**: T012 → T013 → T014 → T015 (sequential within single file)
**Phase 6 (US3)**: T016 ‖ T017 (different files) → T018 → T019 (UI depends on API)
**Phase 7**: T020 ‖ T022 (independent) → T021 (end-to-end depends on all)

---

## Parallel Example: Phase 3 (US4) + Phase 6 (US3)

```bash
# These can run simultaneously after Phase 2 completes:

# Stream A: Harvest pipeline updates (US4)
Task T005: Tag extraction method in scripts/harvest/extractor.ts
Task T006: Update confidence formula in scripts/harvest/bio-enricher.ts
Task T007: Add CSV columns in scripts/harvest/reporter.ts
# then → T008 (orchestrator)

# Stream B: Batch verify API (US3 — independent of harvest changes)
Task T016: Sources aggregation endpoint in src/app/api/admin/judges/sources/route.ts
Task T017: Batch verify endpoint in src/app/api/admin/judges/batch-verify/route.ts
# then → T018, T019 (UI)
```

---

## Implementation Strategy

### MVP First (User Story 4 + User Story 1)

1. Complete Phase 1: Setup (schema migration)
2. Complete Phase 2: Foundational (classifier + config type)
3. Complete Phase 3: US4 (harvest pipeline produces new metadata)
4. Complete Phase 4: US1 (import auto-verifies trusted records)
5. **STOP and VALIDATE**: Run Florida harvest + import. Verify `.gov` judges auto-verified.
6. This is the MVP — the single highest-impact deliverable.

### Incremental Delivery

1. Setup + Foundational → Schema and utilities ready
2. US4 → Harvest produces source authority + extraction method metadata
3. US1 → Import auto-verifies → **MVP complete** (future imports auto-verify)
4. US2 → Re-score existing records → **Existing backlog unlocked** (3x more public judges)
5. US3 → Batch verify UI → **Admin tooling complete** (manual escape hatch)
6. Polish → Backward compatibility validated, smoke test passed

### Suggested MVP Scope

**US4 + US1** (Phases 1–4, tasks T001–T011): Delivers source-aware auto-verification for all future imports. This alone should push SC-001 (70%+ `.gov` auto-verification) from near-0% to target.

Add **US2** (Phase 5, tasks T012–T015) immediately after MVP to unlock existing records (SC-002: 3x more public judges).
