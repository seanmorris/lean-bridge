/**
 * Frozen identities for hosted inherited checked-record Ruby evidence.
 * Null pins make both archiving and verification fail closed.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	inheritedCheckedRecordRubyEvidenceSources
} from "./inherited-checked-record-ruby-evidence-sources.mjs";

export const inheritedCheckedRecordRubyEvidence
	= "docs/evidence/inherited-checked-record-ruby-20261017";
export const inheritedCheckedRecordRubyProducer = null;
export const inheritedCheckedRecordRubyChecker = null;
export const inheritedCheckedRecordRubyArchiver = null;
export const inheritedCheckedRecordRubyEvidenceLoadCeiling = 8;
export const inheritedCheckedRecordRubyEvidenceFloor = "2.38";
export const inheritedCheckedRecordRubySelections = Object.freeze([
	["ordinary", "full"], ["reviewed", "full"]
	, ["ordinary", "result-only"], ["reviewed", "result-only"]
]);

/** Require all three source identities before reading archived evidence. */
export const inheritedCheckedRecordRubyPinnedRevisions = () => {
	const revisions = {
		producer: inheritedCheckedRecordRubyProducer
		, checker: inheritedCheckedRecordRubyChecker
		, archiver: inheritedCheckedRecordRubyArchiver
	};
	for(const [role, revision] of Object.entries(revisions))
		assert.match(revision ?? "", /^[a-f0-9]{40}$/u
			, `Pin the inherited checked-record Ruby ${role} revision first`);
	return revisions;
};

/** Frozen source list for the producer, checker, and archive roles. */
export const inheritedCheckedRecordRubySelectedSources = () =>
	inheritedCheckedRecordRubyEvidenceSources(
		inheritedCheckedRecordRubyPinnedRevisions());
