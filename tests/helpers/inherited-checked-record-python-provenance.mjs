/**
 * Frozen identities for hosted inherited checked-record Python evidence.
 * Null pins make both archiving and verification fail closed.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	inheritedCheckedRecordPythonEvidenceSources
} from "./inherited-checked-record-python-evidence-sources.mjs";

export const inheritedCheckedRecordPythonEvidence
	= "docs/evidence/inherited-checked-record-python-20261017";
export const inheritedCheckedRecordPythonProducer
	= "7cf1c5f993e8cdb1ce68265891b9c00a8950fb7d";
export const inheritedCheckedRecordPythonChecker
	= "7cf1c5f993e8cdb1ce68265891b9c00a8950fb7d";
export const inheritedCheckedRecordPythonArchiver
	= "7cf1c5f993e8cdb1ce68265891b9c00a8950fb7d";
export const inheritedCheckedRecordPythonEvidenceLoadCeiling = 6;
export const inheritedCheckedRecordPythonEvidenceFloor = "2.38";
export const inheritedCheckedRecordPythonSelections = Object.freeze([
	["ordinary", "full"], ["reviewed", "full"]
	, ["ordinary", "result-only"], ["reviewed", "result-only"]
]);

/** Require all three source identities before reading archived evidence. */
export const inheritedCheckedRecordPythonPinnedRevisions = () => {
	const revisions = {
		producer: inheritedCheckedRecordPythonProducer
		, checker: inheritedCheckedRecordPythonChecker
		, archiver: inheritedCheckedRecordPythonArchiver
	};
	for(const [role, revision] of Object.entries(revisions))
		assert.match(revision ?? "", /^[a-f0-9]{40}$/u
			, `Pin the inherited checked-record Python ${role} revision first`);
	return revisions;
};

/** Frozen source list for the producer, checker, and archive roles. */
export const inheritedCheckedRecordPythonSelectedSources = () =>
	inheritedCheckedRecordPythonEvidenceSources(
		inheritedCheckedRecordPythonPinnedRevisions());
