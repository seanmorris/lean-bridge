/**
 * Frozen identities for hosted inherited checked-record Perl evidence.
 * Null pins make both archiving and verification fail closed.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	inheritedCheckedRecordPerlEvidenceSources
} from "./inherited-checked-record-perl-evidence-sources.mjs";

export const inheritedCheckedRecordPerlEvidence
	= "docs/evidence/inherited-checked-record-perl-20261018";
export const inheritedCheckedRecordPerlProducer = null;
export const inheritedCheckedRecordPerlChecker = null;
export const inheritedCheckedRecordPerlArchiver = null;
export const inheritedCheckedRecordPerlEvidenceLoadCeiling = 8;
export const inheritedCheckedRecordPerlEvidenceFloor = "2.38";
export const inheritedCheckedRecordPerlSelections = Object.freeze([
	["ordinary", "full"], ["ordinary", "result-only"]
	, ["reviewed", "full"], ["reviewed", "result-only"]
]);

/** Require all three source identities before reading archived evidence. */
export const inheritedCheckedRecordPerlPinnedRevisions = () => {
	const revisions = {
		producer: inheritedCheckedRecordPerlProducer
		, checker: inheritedCheckedRecordPerlChecker
		, archiver: inheritedCheckedRecordPerlArchiver
	};
	for(const [role, revision] of Object.entries(revisions))
		assert.match(revision ?? "", /^[a-f0-9]{40}$/u
			, `Pin the inherited checked-record Perl ${role} revision first`);
	return revisions;
};

/** Frozen source list for the producer, checker, and archive roles. */
export const inheritedCheckedRecordPerlSelectedSources = () =>
	inheritedCheckedRecordPerlEvidenceSources(
		inheritedCheckedRecordPerlPinnedRevisions()
	);
