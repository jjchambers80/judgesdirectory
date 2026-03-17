# Feature Specification: Pragmatic Auto-Verification

**Feature Branch**: `014-auto-verification`
**Created**: 2026-03-16
**Status**: Draft
**Input**: User description: "Pragmatic auto-verification: smarter confidence scoring based on source authority and extraction method, lower auto-verify thresholds for trusted .gov sources, re-score existing unverified records, and batch verify UI for admin"

## Context

The harvest pipeline collects thousands of judge records from official government court websites, but only hundreds become visible on the public site. The bottleneck is the verification pipeline: the confidence scoring formula starts every record at 0.50 and requires 6+ enriched bio fields to reach the auto-verify threshold of 0.80. Since most judges lack rich bio page data, the vast majority land in UNVERIFIED status where they remain invisible indefinitely — no human can manually click-verify thousands of records one by one.

The core insight is that data sourced from official `.gov` court rosters is inherently trustworthy. A judge name extracted from `flcourts.gov` via deterministic CSS parsing (no LLM involvement) is as reliable as data gets. The current system treats all sources identically and doesn't distinguish extraction methods, leaving this trust signal on the table.

This feature shifts from a "verify every record manually" model to a "verify by exception" model: auto-verify records from trusted government sources that pass quality checks, and reserve human review for genuinely ambiguous cases.

## Clarifications

### Session 2026-03-16

- Q: How should judges be grouped in the batch verify view — by exact source URL, domain, roster URL, or import batch? → A: Group by source URL (the URL stored on each judge record — typically the bio page or roster page). This is pragmatic because existing records lack a separate rosterUrl field; sourceUrl is always populated.
- Q: Should the re-scoring script promote NEEDS_REVIEW records whose anomaly flags have been manually cleared? → A: Yes, promote flag-cleared NEEDS_REVIEW records if they meet the confidence threshold
- Q: Should the re-scoring script process records in batches or single-pass? → A: Batch processing with progress logging (safe to interrupt)
- Q: Should extractionMethod be persisted to the Judge database record or kept in CSV only? → A: Persist it on the Judge record for future analytics and re-scoring
- Q: Should the batch verify sources view show NEEDS_REVIEW counts alongside verified/unverified? → A: Yes, show NEEDS_REVIEW as a separate count per source

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Source-Aware Auto-Verification During Import (Priority: P1) 🎯 MVP

When the admin runs the harvest-to-import pipeline for a state, the system evaluates each judge record's trustworthiness based on where the data came from (official government site vs. secondary source) and how it was extracted (deterministic parsing vs. LLM). Records from trusted `.gov` sources with no data quality anomalies are automatically marked as VERIFIED and immediately appear on public pages — no manual review step needed.

**Why this priority**: This is the single highest-impact change. It directly converts the existing pool of high-quality harvest data into publicly visible judge records without requiring any manual intervention. Every subsequent import also benefits automatically.

**Independent Test**: Run the Florida harvest and import pipeline. Confirm that judges extracted from `.flcourts.gov` pages with clean data (valid name, court type, no anomaly flags) are created with `status: VERIFIED` and `autoVerified: true`. Confirm they appear on the corresponding public county/court pages.

**Acceptance Scenarios**:

1. **Given** a judge record harvested from an official `.gov` court roster with a valid name, court type, and county, **When** the import pipeline processes the record, **Then** the record is created with status VERIFIED, autoVerified true, sourceAuthority set to OFFICIAL_GOV, and a verifiedAt timestamp.
2. **Given** a judge record harvested from a `.gov` source but with an anomaly flag (e.g., name too short, navigation text detected), **When** the import pipeline processes the record, **Then** the record is created with status NEEDS_REVIEW regardless of source authority.
3. **Given** a judge record harvested from a non-government source (e.g., a `.org` court site), **When** the import pipeline processes the record and the confidence score is between 0.70 and 0.79, **Then** the record is created with status UNVERIFIED (not auto-verified), because the lower threshold only applies to official government sources.
4. **Given** a judge record extracted via deterministic CSS parsing (no LLM involved) from a `.gov` source, **When** the confidence score is calculated, **Then** the score reflects a higher base than LLM-extracted records (deterministic extraction bonus applied).
5. **Given** a CSV from a previous harvest that lacks the new Source Authority and Extraction Method columns, **When** the import pipeline processes it, **Then** the import gracefully defaults to COURT_WEBSITE source authority and null extraction method, using the standard 0.80 auto-verify threshold.

---

### User Story 2 — Re-Score and Promote Existing Unverified Records (Priority: P1)

An admin runs a re-scoring command against the existing database to evaluate all UNVERIFIED and NEEDS_REVIEW judges using the new source-aware confidence formula. Records that now meet the auto-verification threshold are promoted to VERIFIED and become visible on public pages. The admin can preview the impact before committing changes.

**Why this priority**: Equally critical to Story 1. The database already contains thousands of harvested records stuck in UNVERIFIED status. Without re-scoring, only future imports benefit from the new logic — this story unlocks the existing data backlog immediately.

**Independent Test**: Run the re-scoring command in dry-run mode against the database. Verify it reports the count of records that would be promoted. Run again with the apply flag. Verify promoted judges now appear on public pages. Verify no VERIFIED or REJECTED records were modified.

**Acceptance Scenarios**:

1. **Given** 500 judges with status UNVERIFIED that have sourceUrl pointing to `.gov` domains and no anomaly flags, **When** the admin runs the re-scoring command with the apply flag, **Then** those records are updated to status VERIFIED with autoVerified true and verifiedAt set to the current timestamp.
2. **Given** the admin runs the re-scoring command with the dry-run flag (default), **When** the command completes, **Then** it outputs a summary showing the count of records that would be promoted per source authority tier and per state — but makes no database changes.
3. **Given** a judge with status VERIFIED (previously verified manually or by auto-verify), **When** the re-scoring command runs, **Then** that judge's status is not modified (never downgrade).
4. **Given** a judge with status REJECTED, **When** the re-scoring command runs, **Then** that judge's record is skipped entirely.
5. **Given** a judge with status NEEDS_REVIEW and one or more anomaly flags still present, **When** the re-scoring command evaluates the record, **Then** the record remains NEEDS_REVIEW because anomaly flags override source authority trust.
6. **Given** a judge with status NEEDS_REVIEW whose anomaly flags have been manually cleared (empty array) and whose sourceUrl is a `.gov` domain, **When** the re-scoring command evaluates the record and the new confidence score meets the OFFICIAL_GOV threshold, **Then** the record is promoted to VERIFIED — because cleared flags represent an implicit admin trust signal.
7. **Given** a judge with status UNVERIFIED whose sourceUrl is a non-government domain and confidence score is 0.65, **When** the re-scoring command runs, **Then** the record remains UNVERIFIED because it doesn't meet even the COURT_WEBSITE threshold of 0.75.

---

### User Story 3 — Batch Verification by Source in Admin Panel (Priority: P2)

An admin opens the judges admin page and sees a "Sources" view that groups all judges by their source URL (`sourceUrl` field). Each group shows the total count, how many are verified, and how many are still unverified. The admin can click "Verify All" on a trusted source to batch-promote all unverified judges from that source to VERIFIED status in one action. A confirmation dialog prevents accidental bulk changes.

**Why this priority**: Provides a manual bulk-verify escape hatch for sources that fall outside the auto-verification rules. An admin who has personally validated a court website can promote all records from that source at once instead of clicking verify on each one. This is the human-in-the-loop complement to auto-verification.

**Independent Test**: Import records from two different sources. Navigate to the admin judges page sources view. Verify groupings show correct counts. Click "Verify All" on one source. Confirm only judges from that source are promoted. Confirm the other source's judges remain unchanged.

**Acceptance Scenarios**:

1. **Given** the database contains judges from 5 different source URLs, **When** the admin views the sources grouping, **Then** they see 5 groups, each showing the source URL, total judge count, verified count, unverified count, and needs-review count.
2. **Given** a source group showing 30 unverified judges, **When** the admin clicks "Verify All" and confirms the action, **Then** all 30 unverified judges from that source are updated to VERIFIED, and the group's counts refresh to reflect the change.
3. **Given** a source group that contains a mix of UNVERIFIED and NEEDS_REVIEW judges, **When** the admin clicks "Verify All", **Then** only UNVERIFIED judges are promoted — NEEDS_REVIEW judges remain unchanged because they have anomalies that warrant individual attention.
4. **Given** the admin clicks "Verify All" on a source, **When** the confirmation dialog appears, **Then** it shows the source URL and the exact number of judges that will be verified, and the admin must confirm before the action proceeds.
5. **Given** the admin has just batch-verified a source, **When** they navigate to the public pages for the corresponding counties, **Then** the newly verified judges appear in the listings.

---

### User Story 4 — Source Authority Classification in Harvest Pipeline (Priority: P1)

During harvest, the system classifies each source URL's authority level (official government, known court website, or secondary source) and tags each judge record with this classification and the extraction method used (deterministic parsing or LLM). This metadata flows through the CSV output into the import pipeline, enabling source-aware auto-verification decisions.

**Why this priority**: This is the foundational data enrichment that Stories 1 and 2 depend on. Without source authority classification, the import pipeline has no basis for differentiated trust levels. Without extraction method tracking, the confidence formula can't reward hallucination-free deterministic extraction.

**Independent Test**: Run the Florida harvest. Open the output CSV. Confirm that every record has a Source Authority column (OFFICIAL_GOV for `.flcourts.gov` URLs, COURT_WEBSITE for circuit `.org` sites) and an Extraction Method column (deterministic or llm). Verify confidence scores are higher than before for `.gov` sources.

**Acceptance Scenarios**:

1. **Given** a court roster URL on a `.gov` domain, **When** the harvest pipeline processes the page, **Then** all extracted judge records are tagged with source authority OFFICIAL_GOV.
2. **Given** a court roster URL on a known court `.org` domain (listed in the state's court configuration), **When** the harvest pipeline processes the page, **Then** records are tagged with source authority COURT_WEBSITE.
3. **Given** a URL from a secondary source (e.g., Ballotpedia, bar association), **When** the harvest pipeline processes it, **Then** records are tagged with source authority SECONDARY.
4. **Given** a page where the deterministic extractor successfully parses judge data from structured HTML, **When** the record is tagged, **Then** the extraction method is set to "deterministic".
5. **Given** a page that falls back to LLM extraction, **When** the record is tagged, **Then** the extraction method is set to "llm".
6. **Given** a harvest run completes, **When** the CSV is written, **Then** it includes "Source Authority" and "Extraction Method" columns for every record.
7. **Given** a `.gov` source with deterministic extraction, **When** the base confidence score is calculated, **Then** it starts at 0.75 (0.65 base + 0.10 deterministic bonus) before any bio field adjustments.

---

### Edge Cases

- **EC-001**: A judge record has a sourceUrl that is null or empty — classify as SECONDARY (lowest trust), use the highest auto-verify threshold (0.80). The re-scoring script treats these as non-promotable unless confidence ≥ 0.80 (the SECONDARY threshold) from bio field enrichment alone.
- **EC-002**: A `.gov` URL redirects to a non-`.gov` domain — classify based on the original configured URL, not the final redirect target, since the redirect is controlled by the government entity.
- **EC-003**: The re-scoring script is run multiple times — each run is idempotent. Records already promoted to VERIFIED are skipped. Running it twice produces the same final state.
- **EC-004**: A source URL appears in the batch-verify UI with zero unverified judges (all already verified) — show the source with 0 unverified, disable the "Verify All" button.
- **EC-005**: An admin batch-verifies a source, then new unverified records are imported from the same source — the new records are evaluated by the auto-verify pipeline independently. Previous batch verification does not automatically apply to future imports from the same source.
- **EC-006**: The confidence cap (0.95) is reached through a combination of high source authority + deterministic extraction + many bio fields — the score clamps at 0.95 and does not exceed it. A perfect 1.0 is reserved for human-verified records (future consideration).
- **EC-007**: An existing UNVERIFIED record was manually edited by an admin (e.g., corrected a name) — the re-scoring script still evaluates it. The corrected data may improve its quality evaluation. Manual edits are not overwritten.
- **EC-008**: The re-scoring script is interrupted mid-run (e.g., process killed) — records already processed in completed batches retain their updates; unprocessed records remain unchanged. Re-running the script picks up where it left off because already-promoted VERIFIED records are skipped (idempotent).

## Requirements *(mandatory)*

### Functional Requirements

**Confidence Scoring:**

- **FR-001**: System MUST assign a source authority classification to every harvested judge record based on the source URL domain: OFFICIAL_GOV for `.gov` domains, COURT_WEBSITE for known court organization domains, SECONDARY for all others.
- **FR-002**: System MUST track the extraction method (deterministic or LLM) used to produce each harvested judge record.
- **FR-003**: System MUST calculate base confidence scores that vary by source authority: 0.65 for OFFICIAL_GOV, 0.55 for COURT_WEBSITE, 0.45 for SECONDARY sources.
- **FR-004**: System MUST apply a confidence bonus of 0.10 for records extracted via deterministic parsing (no LLM involvement).
- **FR-005**: System MUST continue applying a confidence bonus of 0.05 per enriched bio field, unchanged from current behavior.
- **FR-006**: System MUST cap confidence scores at 0.95 regardless of combined bonuses.

**Auto-Verification Thresholds:**

- **FR-007**: System MUST auto-verify records from OFFICIAL_GOV sources when the confidence score is 0.70 or higher and zero anomaly flags are present.
- **FR-008**: System MUST auto-verify records from COURT_WEBSITE sources when the confidence score is 0.75 or higher and zero anomaly flags are present.
- **FR-009**: System MUST auto-verify records from SECONDARY or unknown sources only when the confidence score is 0.80 or higher and zero anomaly flags are present — maintaining the current threshold for less-trusted sources.
- **FR-010**: System MUST force NEEDS_REVIEW status for any record with one or more anomaly flags, regardless of source authority or confidence score.

**Import Pipeline:**

- **FR-011**: System MUST include Source Authority and Extraction Method columns in the harvest CSV output.
- **FR-012**: System MUST parse Source Authority and Extraction Method from the harvest CSV during import, defaulting to COURT_WEBSITE and null respectively when columns are absent (backward compatibility).
- **FR-013**: System MUST use the parsed source authority (not a hardcoded value) when setting the sourceAuthority field on imported judge records.
- **FR-024**: System MUST persist the extraction method (deterministic or LLM) as a field on the Judge database record during import, enabling future analytics and re-scoring without CSV dependency.

**Re-Scoring:**

- **FR-014**: System MUST provide a re-scoring command that evaluates all UNVERIFIED and NEEDS_REVIEW judges using the new confidence and auto-verification logic. NEEDS_REVIEW records with zero remaining anomaly flags are eligible for promotion; those with active anomaly flags remain NEEDS_REVIEW.
- **FR-015**: System MUST support a dry-run mode for the re-scoring command that reports impact without making database changes.
- **FR-016**: System MUST never downgrade a VERIFIED record during re-scoring.
- **FR-017**: System MUST never modify a REJECTED record during re-scoring.
- **FR-018**: System MUST classify source authority from the existing sourceUrl field when re-scoring (since existing records lack a stored sourceAuthority).
- **FR-023**: System MUST process re-scoring in batches with progress logging, so the operation is safe to interrupt and resume without leaving the database in an inconsistent state.

**Batch Verification:**

- **FR-019**: System MUST provide an admin interface that groups judges by source URL (`sourceUrl` field) and displays per-source-URL counts of total, verified, unverified, and needs-review records.
- **FR-020**: System MUST allow admins to batch-verify all UNVERIFIED judges from a specific source URL in a single action.
- **FR-021**: System MUST require confirmation before executing a batch verification, showing the source URL and count of records that will be affected.
- **FR-022**: Batch verification MUST only promote UNVERIFIED records — NEEDS_REVIEW and REJECTED records are excluded from batch operations.

### Key Entities

- **Source Authority**: A classification of how trustworthy a data source is. Four tiers: OFFICIAL_GOV (government `.gov` sites), COURT_WEBSITE (official court organization sites), ELECTION_RECORDS (Secretary of State data), SECONDARY (news, bar associations, Ballotpedia). Already modeled as an enum in the data model.
- **Extraction Method**: How a judge record was derived from a source page. Two values: "deterministic" (structured HTML pattern matching, zero hallucination risk) or "llm" (AI-based extraction with schema validation). Persisted as a field on the Judge database record alongside source authority.
- **Confidence Score**: A composite 0.0–0.95 score representing data reliability. Composed of: source authority base + extraction method bonus + bio field enrichment bonuses. Used by the quality gate to determine auto-verification eligibility.
- **Judge Status**: The record lifecycle state. VERIFIED (visible on public pages), UNVERIFIED (imported but not yet trusted), NEEDS_REVIEW (anomalies detected, requires human attention), REJECTED (determined to be invalid data).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 70% of judges harvested from official `.gov` sources with no anomaly flags are auto-verified on import (currently near 0% due to conservative thresholds).
- **SC-002**: The number of publicly visible judge records increases by at least 3x after running the re-scoring command on the existing database.
- **SC-003**: Admin time spent on manual verification is reduced by at least 80% — the admin reviews only anomaly-flagged records and non-government sources rather than every imported record.
- **SC-004**: Zero false positives in REJECTED records are promoted — the re-scoring command and batch verification never modify REJECTED status.
- **SC-005**: The batch verification workflow allows an admin to verify an entire source's worth of judges in under 30 seconds (compared to individual click verification at ~10 seconds per judge).
- **SC-006**: Existing harvest CSVs without the new columns import successfully with no errors (backward compatibility maintained).

## Assumptions

- Official `.gov` court roster pages are authoritative sources for judge listings. A judge name found on a `.gov` roster page is presumed to be a real, sitting judge unless anomaly detection flags indicate otherwise.
- The existing anomaly detection (navigation text patterns, name length validation, person-name heuristics) is sufficient as a safety net. Records that pass all anomaly checks from a `.gov` source are safe to auto-verify.
- Deterministic extraction (structured HTML parsing) produces more reliable results than LLM extraction because it cannot hallucinate data — it only extracts what is explicitly present in the page structure.
- The confidence cap of 0.95 (not 1.0) reserves headroom for a future "human-verified" or "multi-source-corroborated" confidence tier.
- Re-scoring existing records from their sourceUrl is viable because the vast majority of existing records have a non-null sourceUrl that can be domain-classified.
- The admin panel is not publicly accessible and does not require additional authorization checks for batch operations beyond existing admin authentication.

---

## Implementation Notes (2026-03-16)

**Status**: ✅ Fully implemented on branch `014-auto-verification`

### Files Modified/Created

| File | Action | Purpose |
|------|--------|---------|
| `prisma/schema.prisma` | Modified | Added `rosterUrl` and `extractionMethod` nullable fields |
| `scripts/harvest/source-classifier.ts` | Created | `classifySourceAuthority()` — .gov/config/secondary classification |
| `scripts/harvest/config.ts` | Modified | Added `sourceAuthority`, `extractionMethod` to `EnrichedJudgeRecord` |
| `scripts/harvest/extractor.ts` | Modified | Tags extraction method (deterministic/llm) on results |
| `scripts/harvest/bio-enricher.ts` | Modified | Source-authority-aware confidence formula, cap 0.95 |
| `scripts/harvest/index.ts` | Modified | Orchestrator propagation — classifier, extraction method, CSV columns |
| `scripts/import/csv-importer.ts` | Modified | Parses new CSV columns with backward-compatible defaults |
| `scripts/import/quality-gate.ts` | Modified | Tiered auto-verify thresholds per source authority |
| `scripts/import/index.ts` | Modified | Passes parsed sourceAuthority, persists new fields |
| `scripts/maintenance/rescore-judges.ts` | Created | CLI for re-scoring/promoting existing unverified records |
| `src/app/api/admin/judges/sources/route.ts` | Created | GET — source aggregation with status counts |
| `src/app/api/admin/judges/batch-verify/route.ts` | Created | POST — batch promote UNVERIFIED by sourceUrl |
| `src/app/admin/judges/page.tsx` | Modified | Sources view tab with Verify All per source |

### Validation Results

- **TypeScript compilation**: Clean (`npx tsc --noEmit`)
- **Backward compatibility**: Old CSVs (no Source Authority/Extraction Method) parse with defaults (COURT_WEBSITE/null)
- **Re-score dry run**: 2641 candidates, 128 would promote (4.8%) — Texas 100%, Florida 5.5%, California 0.3%
- **Migration applied**: `20260316055340_add_roster_url_and_extraction_method`
