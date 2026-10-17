/**
 * Frozen identities for hosted inherited checked-record WIT/WASI evidence.
 * Null pins make both archiving and verification fail closed.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	inheritedCheckedRecordWitEvidenceSources
} from "./inherited-checked-record-wit-evidence-sources.mjs";

export const inheritedCheckedRecordWitEvidence
	= "docs/evidence/inherited-checked-record-wit-20261017";
export const inheritedCheckedRecordWitProducer = null;
export const inheritedCheckedRecordWitChecker = null;
export const inheritedCheckedRecordWitArchiver = null;
export const inheritedCheckedRecordWitLoadCeiling = 8;
export const inheritedCheckedRecordWitSelections = Object.freeze([
	["ordinary", "full"], ["reviewed", "full"]
	, ["ordinary", "result-only"], ["reviewed", "result-only"]
]);

/** Require all three source identities before reading archived evidence. */
export const inheritedCheckedRecordWitPinnedRevisions = () => {
	const revisions = {
		producer: inheritedCheckedRecordWitProducer
		, checker: inheritedCheckedRecordWitChecker
		, archiver: inheritedCheckedRecordWitArchiver
	};
	for(const [role, revision] of Object.entries(revisions))
		assert.match(revision ?? "", /^[a-f0-9]{40}$/u
			, `Pin the inherited checked-record WIT ${role} revision first`);
	return revisions;
};

/** Frozen source list for the producer, checker, and archive roles. */
export const inheritedCheckedRecordWitSelectedSources = () =>
	inheritedCheckedRecordWitEvidenceSources(
		inheritedCheckedRecordWitPinnedRevisions());
