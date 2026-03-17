/**
 * Quality Gate for Judge Import
 * 
 * Determines judge status based on confidence score and anomaly detection.
 * Flags records for manual review when data quality is questionable.
 * 
 * @module scripts/import/quality-gate
 */

import { JudgeStatus } from '@prisma/client';
import type { ParsedJudge } from './csv-importer';

// Confidence thresholds — source-aware (per data-model.md)
const SOURCE_THRESHOLDS: Record<string, number> = {
  OFFICIAL_GOV: 0.70,
  COURT_WEBSITE: 0.75,
  ELECTION_RECORDS: 0.75,
  SECONDARY: 0.80,
};
const DEFAULT_THRESHOLD = 0.80;
const UNVERIFIED_THRESHOLD = 0.60;

// Known navigation/junk text patterns that indicate bad extraction
const NAVIGATION_PATTERNS = [
  /^human resources$/i,
  /^clerks? office$/i,
  /^jurors? info(rmation)?$/i,
  /^media information$/i,
  /^website feedback$/i,
  /^professionalism panel$/i,
  /^instructional videos$/i,
  /^ordering transcripts$/i,
  /^people first$/i,
  /^all judiciary$/i,
  /^chief judge$/i,
  /^county vacant$/i,
  /^vacant$/i,
  /^\(\d+\)$/,  // Just a number like "(1)"
  /^home$/i,
  /^contact$/i,
  /^about$/i,
  /^news$/i,
  /^calendar$/i,
  /^forms$/i,
  /^self.?help$/i,
  /^resources$/i,
  /^directories?$/i,
  /^administration$/i,
];

// Minimum name length for a valid judge name
const MIN_NAME_LENGTH = 4;

// Maximum name length (catches scraped paragraphs)
const MAX_NAME_LENGTH = 80;

export interface QualityResult {
  status: JudgeStatus;
  autoVerified: boolean;
  verifiedAt: Date | null;
  anomalyFlags: string[];
  reviewReason: string | null;
  shouldSkip: boolean;
}

/**
 * Check if name looks like navigation text
 */
function isNavigationText(name: string): boolean {
  return NAVIGATION_PATTERNS.some(pattern => pattern.test(name.trim()));
}

/**
 * Check if name is too short to be valid
 */
function isNameTooShort(name: string): boolean {
  return name.trim().length < MIN_NAME_LENGTH;
}

/**
 * Check if name is too long (probably scraped paragraph)
 */
function isNameTooLong(name: string): boolean {
  return name.trim().length > MAX_NAME_LENGTH;
}

/**
 * Check if name looks like a real person's name
 */
function looksLikePersonName(name: string): boolean {
  // Should have at least two words (first and last name)
  const words = name.trim().split(/\s+/);
  if (words.length < 2) {
    return false;
  }

  // Should not be all caps (often headers)
  if (name === name.toUpperCase() && name.length > 10) {
    return false;
  }

  // Should start with a capital letter
  if (!/^[A-Z]/.test(name.trim())) {
    return false;
  }

  return true;
}

/**
 * Determine judge status and flags based on data quality
 */
export function evaluateQuality(judge: ParsedJudge): QualityResult {
  const anomalyFlags: string[] = [];
  let reviewReason: string | null = null;
  let shouldSkip = false;

  // Check for navigation text
  if (isNavigationText(judge.fullName)) {
    anomalyFlags.push('NAV_TEXT');
    reviewReason = 'Name appears to be navigation text';
    shouldSkip = true;  // Don't import obvious navigation items
  }

  // Check name length
  if (isNameTooShort(judge.fullName)) {
    anomalyFlags.push('NAME_TOO_SHORT');
    reviewReason = reviewReason || 'Name is too short to be valid';
    shouldSkip = true;
  }

  if (isNameTooLong(judge.fullName)) {
    anomalyFlags.push('NAME_TOO_LONG');
    reviewReason = reviewReason || 'Name is too long (possible scraping error)';
    shouldSkip = true;
  }

  // Check if it looks like a person name
  if (!shouldSkip && !looksLikePersonName(judge.fullName)) {
    anomalyFlags.push('NOT_PERSON_NAME');
    reviewReason = reviewReason || 'Name does not look like a person name';
  }

  // Check for missing court type
  if (!judge.courtType) {
    anomalyFlags.push('NO_COURT_TYPE');
    reviewReason = reviewReason || 'Missing court type';
  }

  // Check for missing source URL with low confidence
  if (!judge.sourceUrl && judge.confidenceScore < UNVERIFIED_THRESHOLD) {
    anomalyFlags.push('NO_SOURCE_LOW_CONF');
    reviewReason = reviewReason || 'No source URL and low confidence score';
  }

  // Determine status based on confidence, anomalies, and source authority
  let status: JudgeStatus;
  let autoVerified = false;
  let verifiedAt: Date | null = null;

  // Resolve source-aware threshold
  const verifyThreshold = SOURCE_THRESHOLDS[judge.sourceAuthority] ?? DEFAULT_THRESHOLD;

  if (shouldSkip) {
    // Items to skip entirely get REJECTED status
    status = 'REJECTED';
  } else if (anomalyFlags.length > 0) {
    // Any anomalies trigger review (FR-007 through FR-010)
    status = 'NEEDS_REVIEW';
  } else if (judge.confidenceScore >= verifyThreshold) {
    // Source-aware threshold met with no anomalies = auto-verified
    status = 'VERIFIED';
    autoVerified = true;
    verifiedAt = new Date();
  } else if (judge.confidenceScore >= UNVERIFIED_THRESHOLD) {
    // Medium confidence = unverified but acceptable
    status = 'UNVERIFIED';
  } else {
    // Low confidence = needs review
    status = 'NEEDS_REVIEW';
    reviewReason = reviewReason || `Low confidence score: ${judge.confidenceScore.toFixed(2)}`;
  }

  return {
    status,
    autoVerified,
    verifiedAt,
    anomalyFlags,
    reviewReason,
    shouldSkip,
  };
}

/**
 * Get quality stats for a batch of judges
 */
export function getQualityStats(results: QualityResult[]): {
  verified: number;
  unverified: number;
  needsReview: number;
  rejected: number;
  skipped: number;
  autoVerified: number;
  anomalyCounts: Record<string, number>;
} {
  const stats = {
    verified: 0,
    unverified: 0,
    needsReview: 0,
    rejected: 0,
    skipped: 0,
    autoVerified: 0,
    anomalyCounts: {} as Record<string, number>,
  };

  for (const result of results) {
    switch (result.status) {
      case 'VERIFIED':
        stats.verified++;
        break;
      case 'UNVERIFIED':
        stats.unverified++;
        break;
      case 'NEEDS_REVIEW':
        stats.needsReview++;
        break;
      case 'REJECTED':
        stats.rejected++;
        break;
    }

    if (result.shouldSkip) {
      stats.skipped++;
    }

    if (result.autoVerified) {
      stats.autoVerified++;
    }

    for (const flag of result.anomalyFlags) {
      stats.anomalyCounts[flag] = (stats.anomalyCounts[flag] || 0) + 1;
    }
  }

  return stats;
}
