/**
 * Frozen identities for hosted value-index checked-record .NET evidence.
 * Null pins keep both archive validation and support claims fail-closed.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	checkedRecordValueIndexDotnetEvidenceSources
} from "./checked-record-value-index-dotnet-evidence-sources.mjs";

export const checkedRecordValueIndexDotnetEvidence
	= "docs/evidence/checked-record-value-index-dotnet-20261018";
export const checkedRecordValueIndexDotnetProducer = null;
export const checkedRecordValueIndexDotnetConsumer = null;
export const checkedRecordValueIndexDotnetChecker = null;
export const checkedRecordValueIndexDotnetArchiver = null;
export const checkedRecordValueIndexDotnetEvidenceLoadCeiling = 6;
export const checkedRecordValueIndexDotnetEvidenceFloor = "2.38";
export const checkedRecordValueIndexDotnetSelections = Object.freeze([
	"ordinary-source", "reviewed-ir"
	, "result-only-ordinary-source", "result-only-reviewed-ir"
]);

/** Require all four source identities before reading archived evidence. */
export const checkedRecordValueIndexDotnetPinnedRevisions = () => {
	const revisions = {
		producer: checkedRecordValueIndexDotnetProducer
		, consumer: checkedRecordValueIndexDotnetConsumer
		, checker: checkedRecordValueIndexDotnetChecker
		, archiver: checkedRecordValueIndexDotnetArchiver
	};
	for(const [role, revision] of Object.entries(revisions))
		assert.match(revision ?? "", /^[a-f0-9]{40}$/u
			, `Pin the value-index checked-record .NET ${role} revision first`);
	return revisions;
};

/** Frozen source list for producer, consumer, checker, and archiver roles. */
export const checkedRecordValueIndexDotnetSelectedSources = () =>
	checkedRecordValueIndexDotnetEvidenceSources(
		checkedRecordValueIndexDotnetPinnedRevisions());
