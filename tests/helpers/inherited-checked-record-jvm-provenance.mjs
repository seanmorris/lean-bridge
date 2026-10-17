/**
 * Frozen identities for hosted inherited checked-record JVM evidence.
 * Null pins make both archiving and verification fail closed.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	inheritedCheckedRecordJvmEvidenceSources
} from "./inherited-checked-record-jvm-evidence-sources.mjs";

export const inheritedCheckedRecordJvmEvidence
	= "docs/evidence/inherited-checked-record-jvm-20261017";
export const inheritedCheckedRecordJvmProducer
	= "93ccc14cde12ecaf3d171f308f85dadeffaf3033";
export const inheritedCheckedRecordJvmChecker
	= "78ecf12b8266c1b591a76deeff1aac7540e5bdfd";
export const inheritedCheckedRecordJvmArchiver
	= "78ecf12b8266c1b591a76deeff1aac7540e5bdfd";
export const inheritedCheckedRecordJvmEvidenceLoadCeiling = 6;
export const inheritedCheckedRecordJvmEvidenceFloor = "2.38";
export const inheritedCheckedRecordJvmSelections = Object.freeze([
	["ordinary", "full"], ["reviewed", "full"]
	, ["ordinary", "result-only"], ["reviewed", "result-only"]
]);

/** Require all three source identities before reading archived evidence. */
export const inheritedCheckedRecordJvmPinnedRevisions = () => {
	const revisions = {
		producer: inheritedCheckedRecordJvmProducer
		, checker: inheritedCheckedRecordJvmChecker
		, archiver: inheritedCheckedRecordJvmArchiver
	};
	for(const [role, revision] of Object.entries(revisions))
		assert.match(revision ?? "", /^[a-f0-9]{40}$/u
			, `Pin the inherited checked-record JVM ${role} revision first`);
	return revisions;
};

/** Frozen source list for the producer, checker, and archive roles. */
export const inheritedCheckedRecordJvmSelectedSources = () =>
	inheritedCheckedRecordJvmEvidenceSources(
		inheritedCheckedRecordJvmPinnedRevisions());
