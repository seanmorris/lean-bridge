/**
 * Frozen identities for hosted inherited checked-record .NET evidence.
 * Null pins make both archiving and verification fail closed.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	inheritedCheckedRecordDotnetEvidenceSources
} from "./inherited-checked-record-dotnet-evidence-sources.mjs";

export const inheritedCheckedRecordDotnetEvidence
	= "docs/evidence/inherited-checked-record-dotnet-20261017";
export const inheritedCheckedRecordDotnetProducer
	= "7cf1c5f993e8cdb1ce68265891b9c00a8950fb7d";
export const inheritedCheckedRecordDotnetChecker
	= "7cf1c5f993e8cdb1ce68265891b9c00a8950fb7d";
export const inheritedCheckedRecordDotnetArchiver
	= "fd6cec142b01c9b6ac9537bfd728a46045a4e8c9";
export const inheritedCheckedRecordDotnetEvidenceLoadCeiling = 6;
export const inheritedCheckedRecordDotnetEvidenceFloor = "2.38";
export const inheritedCheckedRecordDotnetSelections = Object.freeze([
	["ordinary", "full"], ["reviewed", "full"]
	, ["ordinary", "result-only"], ["reviewed", "result-only"]
]);

/** Require all three source identities before reading archived evidence. */
export const inheritedCheckedRecordDotnetPinnedRevisions = () => {
	const revisions = {
		producer: inheritedCheckedRecordDotnetProducer
		, checker: inheritedCheckedRecordDotnetChecker
		, archiver: inheritedCheckedRecordDotnetArchiver
	};
	for(const [role, revision] of Object.entries(revisions))
		assert.match(revision ?? "", /^[a-f0-9]{40}$/u
			, `Pin the inherited checked-record .NET ${role} revision first`);
	return revisions;
};

/** Frozen source list for the producer, checker, and archive roles. */
export const inheritedCheckedRecordDotnetSelectedSources = () =>
	inheritedCheckedRecordDotnetEvidenceSources(
		inheritedCheckedRecordDotnetPinnedRevisions());
