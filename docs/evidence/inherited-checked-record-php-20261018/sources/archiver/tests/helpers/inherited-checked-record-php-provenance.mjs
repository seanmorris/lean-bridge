/**
 * Frozen identities for hosted inherited checked-record native PHP evidence.
 * Null pins make both archiving and verification fail closed.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	inheritedCheckedRecordPhpEvidenceSources
} from "./inherited-checked-record-php-evidence-sources.mjs";

export const inheritedCheckedRecordPhpEvidence
	= "docs/evidence/inherited-checked-record-php-20261018";
export const inheritedCheckedRecordPhpProducer = null;
export const inheritedCheckedRecordPhpChecker = null;
export const inheritedCheckedRecordPhpArchiver = null;
export const inheritedCheckedRecordPhpEvidenceLoadCeiling = 8;
export const inheritedCheckedRecordPhpEvidenceFloor = "2.38";
export const inheritedCheckedRecordPhpSelections = Object.freeze([
	["ordinary", "full"], ["reviewed", "full"]
	, ["ordinary", "result-only"], ["reviewed", "result-only"]
]);

/** Require all three source identities before reading archived evidence. */
export const inheritedCheckedRecordPhpPinnedRevisions = () => {
	const revisions = {
		producer: inheritedCheckedRecordPhpProducer
		, checker: inheritedCheckedRecordPhpChecker
		, archiver: inheritedCheckedRecordPhpArchiver
	};
	for(const [role, revision] of Object.entries(revisions))
		assert.match(revision ?? "", /^[a-f0-9]{40}$/u
			, `Pin the inherited checked-record native PHP ${role} revision first`);
	return revisions;
};

/** Frozen source list for the producer, checker, and archive roles. */
export const inheritedCheckedRecordPhpSelectedSources = () =>
	inheritedCheckedRecordPhpEvidenceSources(
		inheritedCheckedRecordPhpPinnedRevisions());
